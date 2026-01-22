import { useEffect, useState, useRef } from 'react'
import { View, Text, StyleSheet, ScrollView, Platform, Dimensions, Pressable, Linking, Alert } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useUsageStore } from '../../stores/usageStore'
import { useAuthStore } from '../../stores/authStore'
import { supabase } from '../../lib/supabase'
import { getApiBaseUrl } from '../../lib/platform'

// Lazy load IAP module to avoid crashes if module isn't installed
const getInAppPurchases = (): any => {
  if (Platform.OS !== 'ios') {
    return null
  }
  
  try {
    const iapModule = require('expo-in-app-purchases')
    if (iapModule && 
        typeof iapModule === 'object' && 
        typeof iapModule.isAvailableAsync === 'function') {
      return iapModule
    }
  } catch (error) {
    // Silently fail if module isn't available
    return null
  }
  
  return null
}

interface SubscriptionDetails {
  hasSubscription: boolean
  subscription: {
    id: string
    status: string
    currentPeriodStart: number
    currentPeriodEnd: number
    cancelAtPeriodEnd: boolean
    canceledAt: number | null
  } | null
}

interface SettingsViewProps {
  onNavigate?: (view: string) => void
}

function SettingsView({ onNavigate }: SettingsViewProps) {
  const { planName, tokensUsed, monthlyLimit, remaining, isLoading, error, fetchUsage } = useUsageStore()
  const { isLoggedIn } = useAuthStore()
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [cancelMessage, setCancelMessage] = useState<string | null>(null)
  const [subscriptionDetails, setSubscriptionDetails] = useState<SubscriptionDetails | null>(null)
  const [loadingSubscription, setLoadingSubscription] = useState(false)
  const [restoringPurchases, setRestoringPurchases] = useState(false)
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const { signOut } = useAuthStore()
  const insets = useSafeAreaInsets()
  const windowWidth = Dimensions.get('window').width
  const isMobile = windowWidth <= 768
  
  // Track if subscription details are being fetched to prevent duplicate calls
  const [isFetchingSubscription, setIsFetchingSubscription] = useState(false)
  // Track if we've already fetched on this mount to prevent duplicate calls
  const hasFetchedOnMountRef = useRef(false)
  // Button center calculation: button is at top (insets.top + 8 on iOS, 50 on web), height is 40px (8px padding + 24px icon + 8px padding)
  // Button center = (insets.top + 8) + 20 = insets.top + 28 on iOS, or 50 + 20 = 70 on web
  // Title is 32px tall, so half-height is 16px
  // For iOS: paddingTop = (insets.top + 28) - 16 = insets.top + 12
  // For web: paddingTop = 70 - 16 = 54
  const mobilePaddingTop = Platform.OS === 'ios' 
    ? Math.max(insets.top + 12, 20) 
    : Math.max(54, 20)

  const fetchSubscriptionDetails = async () => {
    if (!isLoggedIn) return
    
    // Prevent duplicate calls
    if (isFetchingSubscription) {
      console.log('[SettingsView] Subscription details already being fetched, skipping duplicate call')
      return
    }
    
    setIsFetchingSubscription(true)
    setLoadingSubscription(true)
    try {
      let session, error
      
      try {
        const result = await supabase.auth.getSession()
        session = result.data.session
        error = result.error
      } catch (err: any) {
        const { initSupabase, getSupabase } = await import('../../lib/supabase')
        await initSupabase()
        const supabaseClient = getSupabase()
        const result = await supabaseClient.auth.getSession()
        session = result.data.session
        error = result.error
      }
      
      if (error) {
        setLoadingSubscription(false)
        return
      }
      
      if (!session) {
        setLoadingSubscription(false)
        return
      }

      const API_BASE_URL = getApiBaseUrl()
      
      // Check if API URL is localhost on native - this won't work on physical devices
      if (Platform.OS !== 'web' && API_BASE_URL.includes('localhost')) {
        console.warn('API URL is localhost on native device. Network requests may fail.')
        setLoadingSubscription(false)
        return
      }
      
      const response = await fetch(`${API_BASE_URL}/api/stripe/subscription-details`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setSubscriptionDetails(data)
      } else {
        console.warn('Failed to fetch subscription details:', response.status, response.statusText)
      }
    } catch (error) {
      // Only log error, don't throw - this is expected if backend isn't running
      if (error instanceof TypeError && error.message === 'Network request failed') {
        console.warn('Network request failed - backend may not be accessible')
      } else {
      console.error('Error fetching subscription details:', error)
      }
    } finally {
      setLoadingSubscription(false)
      setIsFetchingSubscription(false)
    }
  }

  useEffect(() => {
    console.log('[SettingsView] Component mounted - syncing auth and resetting loading state')
    
    // Reset loading state if it's stuck (common after tab changes)
    if (isLoading) {
      console.log('[SettingsView] isLoading is true on mount, resetting to false')
      // We can't directly set it, but we can trigger a fresh fetch
    }
    
    // Sync auth state from actual session when component mounts (in case it's out of sync)
    // Note: Don't call fetchSubscriptionDetails here - let the isLoggedIn useEffect handle it
    // to avoid duplicate calls
    const syncAuth = async () => {
      try {
        const { useAuthStore } = await import('../../stores/authStore')
        await useAuthStore.getState().syncFromSession()
        // The isLoggedIn useEffect will handle fetching subscription details
      } catch (err) {
        console.error('[SettingsView] Error syncing auth state:', err)
      }
    }
    syncAuth()
  }, [])

  useEffect(() => {
    console.log('[SettingsView] useEffect triggered', {
      isLoggedIn,
      isLoading,
      fetchUsageExists: !!fetchUsage,
      hasFetchedOnMount: hasFetchedOnMountRef.current,
      timestamp: new Date().toISOString()
    })
    
    if (isLoggedIn && !hasFetchedOnMountRef.current) {
      console.log('[SettingsView] isLoggedIn is true, calling fetchSubscriptionDetails')
      hasFetchedOnMountRef.current = true
      // Note: fetchUsage is already called by syncAllStores in initializeAuth,
      // so we only need to fetch subscription details here
      fetchSubscriptionDetails()
    } else if (!isLoggedIn) {
      // Reset the ref when logged out so it can fetch again when logging back in
      hasFetchedOnMountRef.current = false
      console.log('[SettingsView] isLoggedIn is false, skipping API calls')
    } else {
      console.log('[SettingsView] Already fetched on mount, skipping duplicate call')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]) // Only depend on isLoggedIn - fetchUsage is stable from Zustand

  // Check for success/cancel parameters in URL (web only)
  useEffect(() => {
    if (Platform.OS !== 'web') return
    
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === 'true') {
      setSuccessMessage('Payment successful! Your subscription has been activated.')
      if (isLoggedIn) {
        const syncAndRefresh = async () => {
          try {
            const { data: { session } } = await supabase.auth.getSession()
            
            if (!session) {
              console.error('No session found')
              return
            }

            const API_BASE_URL = getApiBaseUrl()
            
            const syncResponse = await fetch(`${API_BASE_URL}/api/stripe/sync-subscription`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
            })

            if (syncResponse.ok) {
              const syncData = await syncResponse.json()
              console.log('Subscription sync result:', syncData)
            }

            setTimeout(() => {
              fetchUsage()
              fetchSubscriptionDetails()
            }, 500)
            setTimeout(() => {
              fetchUsage()
              fetchSubscriptionDetails()
            }, 2000)
            setTimeout(() => {
              fetchUsage()
              fetchSubscriptionDetails()
            }, 4000)
          } catch (error) {
            console.error('Error syncing subscription:', error)
            fetchUsage()
          }
        }
        
        syncAndRefresh()
      }
      window.history.replaceState({}, '', window.location.pathname)
    } else if (params.get('canceled') === 'true') {
      setCancelMessage('Payment was canceled. No charges were made.')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [isLoggedIn, fetchUsage])

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M'
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K'
    }
    return num.toString()
  }

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp * 1000)
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  }

  const formatSubscriptionStatus = (status: string): string => {
    return status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')
  }

  const handleRestorePurchases = async () => {
    if (!isLoggedIn) {
      setRestoreMessage('Please log in to restore purchases')
      setTimeout(() => setRestoreMessage(null), 3000)
      return
    }

    setRestoringPurchases(true)
    setRestoreMessage(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('Not authenticated')
      }

      const API_BASE_URL = getApiBaseUrl()
      
      // Check if API URL is localhost on native - this won't work on physical devices
      if (Platform.OS !== 'web' && API_BASE_URL.includes('localhost')) {
        setRestoreMessage('Cannot restore purchases: API URL is localhost. Please check your configuration.')
        setRestoringPurchases(false)
        return
      }

      let restored = false

      // On iOS, try to restore IAP purchases first
      const InAppPurchases = getInAppPurchases()
      if (Platform.OS === 'ios' && InAppPurchases) {
        try {
          const isAvailable = await InAppPurchases.isAvailableAsync()
          if (isAvailable) {
            await InAppPurchases.connectAsync()
            const history = await InAppPurchases.getPurchaseHistoryAsync()
            
            if (history.results && history.results.length > 0) {
              // Verify each purchase receipt
              for (const purchase of history.results) {
                try {
                  const verifyResponse = await fetch(`${API_BASE_URL}/api/iap/verify-receipt`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
                    body: JSON.stringify({
                      receipt: purchase.receipt || purchase.transactionReceipt,
                      productId: purchase.productId,
                      transactionId: purchase.orderId || purchase.transactionId,
                    }),
                  })

                  if (verifyResponse.ok) {
                    const verifyData = await verifyResponse.json()
                    if (verifyData.success) {
                      restored = true
                      break // Found active subscription
                    }
                  }
                } catch (err) {
                  console.error('Error verifying IAP purchase:', err)
                }
              }
            }
            await InAppPurchases.disconnectAsync()
          }
        } catch (iapError) {
          console.error('IAP restore error:', iapError)
          // Continue to try Stripe restore
        }
      }

      // Also try Stripe restore (for web/external subscriptions)
      try {
        const response = await fetch(`${API_BASE_URL}/api/stripe/sync-subscription`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        })

        if (response.ok) {
      const data = await response.json()
      if (data.success && data.hasSubscription) {
            restored = true
          }
        }
      } catch (stripeError) {
        console.error('Stripe restore error:', stripeError)
      }

      if (restored) {
        setRestoreMessage('Purchases restored successfully! Your subscription has been activated.')
        // Refresh subscription details and usage
        await fetchSubscriptionDetails()
        await fetchUsage()
      } else {
        setRestoreMessage('No active subscription found. If you have a subscription, please ensure you\'re logged in with the correct account.')
      }
    } catch (error) {
      console.error('Error restoring purchases:', error)
      setRestoreMessage(error instanceof Error ? error.message : 'Failed to restore purchases. Please try again.')
    } finally {
      setRestoringPurchases(false)
      // Clear message after 5 seconds
      setTimeout(() => setRestoreMessage(null), 5000)
    }
  }

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone and will permanently delete all your notes, tests, flashcards, goals, and other data.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingAccount(true)
            try {
              const { data: { session } } = await supabase.auth.getSession()
              
              if (!session) {
                throw new Error('Not authenticated')
              }

              const API_BASE_URL = getApiBaseUrl()
              
              // Check if API URL is localhost on native - this won't work on physical devices
              if (Platform.OS !== 'web' && API_BASE_URL.includes('localhost')) {
                Alert.alert('Error', 'Cannot delete account: API URL is localhost. Please check your configuration.')
                setDeletingAccount(false)
                return
              }

              const response = await fetch(`${API_BASE_URL}/api/user/delete`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${session.access_token}`,
                  'Content-Type': 'application/json',
                },
              })

              if (!response.ok) {
                const error = await response.json()
                throw new Error(error.message || error.error || 'Failed to delete account')
              }

              // Account deleted successfully, sign out
              await signOut()
              
              Alert.alert('Account Deleted', 'Your account has been successfully deleted.')
            } catch (error) {
              console.error('Error deleting account:', error)
              Alert.alert(
                'Error',
                error instanceof Error ? error.message : 'Failed to delete account. Please try again.'
              )
            } finally {
              setDeletingAccount(false)
            }
          },
        },
      ],
      { cancelable: true }
    )
  }

  const usagePercentage = monthlyLimit > 0 ? (tokensUsed / monthlyLimit) * 100 : 0

  if (!isLoggedIn) {
    return (
      <View style={styles.container}>
        <View style={[
          styles.content,
          isMobile && {
            paddingTop: Math.max(insets.top + 12, 20), // Center title with button: button center is at insets.top + 28, title is 32px (16px half-height), so paddingTop = insets.top + 28 - 16 = insets.top + 12
            paddingLeft: 16, // Align with sidebar button (left: 16)
            paddingRight: 20,
          }
        ]}>
          <Text style={[
            styles.title,
            isMobile && styles.titleMobile
          ]}>Settings</Text>
          <Text style={styles.message}>Please log in to view your usage and settings.</Text>
        </View>
      </View>
    )
  }

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={[
        styles.scrollContent,
        isMobile && {
          paddingTop: mobilePaddingTop,
          paddingLeft: 16, // Align with sidebar button (left: 16)
          paddingRight: 20,
        }
      ]}
    >
      <View style={styles.content}>
        <Text style={[
          styles.title,
          isMobile && styles.titleMobile
        ]}>Settings</Text>
        
        {successMessage && (
          <View style={styles.successMessage}>
            <Text style={styles.successText}>{successMessage}</Text>
          </View>
        )}
        
        {cancelMessage && (
          <View style={styles.cancelMessage}>
            <Text style={styles.cancelText}>{cancelMessage}</Text>
          </View>
        )}
        
        {restoreMessage && (
          <View style={restoreMessage.includes('successfully') ? styles.successMessage : styles.cancelMessage}>
            <Text style={restoreMessage.includes('successfully') ? styles.successText : styles.cancelText}>
              {restoreMessage}
            </Text>
          </View>
        )}
        
        {isLoading ? (
          <Text style={styles.loading}>Loading usage data...</Text>
        ) : error ? (
          <Text style={styles.error}>Error: {error}</Text>
        ) : (
          <View style={styles.settingsContent}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Usage</Text>
              
              <View style={styles.usageInfo}>
                <View style={styles.usagePlan}>
                  <Text style={styles.usageLabel}>Current Plan:</Text>
                  <Text style={[styles.usageValue, styles.planName]}>{planName.toUpperCase()}</Text>
                </View>
                
                <View style={styles.usageStats}>
                  <View style={styles.usageStat}>
                    <Text style={styles.usageLabel}>Tokens Used:</Text>
                    <Text style={styles.usageValue}>{formatNumber(tokensUsed)}</Text>
                  </View>
                  
                  <View style={styles.usageStat}>
                    <Text style={styles.usageLabel}>Monthly Limit:</Text>
                    <Text style={styles.usageValue}>{formatNumber(monthlyLimit)}</Text>
                  </View>
                  
                  <View style={styles.usageStat}>
                    <Text style={styles.usageLabel}>Remaining:</Text>
                    <Text style={styles.usageValue}>{formatNumber(remaining)}</Text>
                  </View>
                </View>
                
                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <View 
                      style={[styles.progressFill, { width: `${Math.min(usagePercentage, 100)}%` }]}
                    />
                  </View>
                  <Text style={styles.progressText}>
                    {usagePercentage.toFixed(1)}% used
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Subscription</Text>
              
              {/* Restore Purchases Button - Always visible as required by App Store */}
              <Pressable
                onPress={handleRestorePurchases}
                disabled={restoringPurchases || !isLoggedIn}
                style={({ pressed }) => [
                  styles.restoreButton,
                  (restoringPurchases || !isLoggedIn) && styles.restoreButtonDisabled,
                  pressed && !restoringPurchases && isLoggedIn && styles.restoreButtonPressed
                ]}
              >
                <Text style={[
                  styles.restoreButtonText,
                  (restoringPurchases || !isLoggedIn) && styles.restoreButtonTextDisabled
                ]}>
                  {restoringPurchases ? 'Restoring...' : 'Restore Purchases'}
                </Text>
              </Pressable>
              
              {planName === 'pro' && (
                <>
                  {loadingSubscription ? (
                    <Text>Loading subscription details...</Text>
                  ) : subscriptionDetails?.hasSubscription && subscriptionDetails.subscription ? (
                    <View style={styles.subscriptionInfo}>
                      <View style={styles.subscriptionRow}>
                        <Text style={styles.subscriptionLabel}>Status:</Text>
                        <View style={[
                          styles.statusBadge,
                          subscriptionDetails.subscription.status === 'active' 
                            ? styles.statusActive 
                            : styles.statusInactive
                        ]}>
                          <Text style={[
                            styles.statusText,
                            subscriptionDetails.subscription.status === 'active' 
                              ? styles.statusActiveText 
                              : styles.statusInactiveText
                          ]}>
                          {formatSubscriptionStatus(subscriptionDetails.subscription.status)}
                          </Text>
                        </View>
                        {subscriptionDetails.subscription.cancelAtPeriodEnd && (
                          <View style={styles.cancelingBadge}>
                            <Text style={styles.cancelingText}>Canceling at period end</Text>
                          </View>
                        )}
                      </View>
                      
                      <View style={styles.subscriptionRow}>
                        <Text style={styles.subscriptionLabel}>Current Period:</Text>
                        <Text style={styles.subscriptionValue}>
                          {formatDate(subscriptionDetails.subscription.currentPeriodStart)} - {formatDate(subscriptionDetails.subscription.currentPeriodEnd)}
                        </Text>
                      </View>
                      
                      {subscriptionDetails.subscription.cancelAtPeriodEnd && (
                        <View style={styles.cancelNotice}>
                          <Text style={styles.cancelNoticeText}>
                          Your subscription will end on {formatDate(subscriptionDetails.subscription.currentPeriodEnd)}. 
                          You'll retain Pro access until then.
                          </Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    <View style={styles.noSubscription}>
                      <Text style={styles.noSubscriptionText}>No active subscription found.</Text>
                    </View>
                  )}
                </>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Legal</Text>
              <Pressable 
                onPress={() => {
                  if (onNavigate) {
                    onNavigate('privacy')
                  } else if (Platform.OS === 'web' && typeof window !== 'undefined') {
                    window.location.href = '/privacy'
                  } else {
                    // For native, open in browser
                    Linking.openURL('https://studentagent.site/privacy').catch(err => 
                      console.error('Failed to open privacy policy:', err)
                    )
                  }
                }}
                style={styles.linkButton}
              >
                <Text style={styles.linkText}>Privacy Policy</Text>
                <Text style={styles.linkArrow}>→</Text>
              </Pressable>
              <Pressable 
                onPress={() => {
                  if (onNavigate) {
                    onNavigate('terms')
                  } else if (Platform.OS === 'web' && typeof window !== 'undefined') {
                    window.location.href = '/terms'
                  } else {
                    // For native, open in browser
                    Linking.openURL('https://studentagent.site/terms').catch(err => 
                      console.error('Failed to open terms of service:', err)
                    )
                  }
                }}
                style={styles.linkButton}
              >
                <Text style={styles.linkText}>Terms of Service</Text>
                <Text style={styles.linkArrow}>→</Text>
              </Pressable>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Account</Text>
              <Pressable
                onPress={handleDeleteAccount}
                disabled={deletingAccount || !isLoggedIn}
                style={({ pressed }) => [
                  styles.deleteButton,
                  (deletingAccount || !isLoggedIn) && styles.deleteButtonDisabled,
                  pressed && !deletingAccount && isLoggedIn && styles.deleteButtonPressed
                ]}
              >
                <Text style={[
                  styles.deleteButtonText,
                  (deletingAccount || !isLoggedIn) && styles.deleteButtonTextDisabled
                ]}>
                  {deletingAccount ? 'Deleting...' : 'Delete Account'}
                </Text>
              </Pressable>
              <Text style={styles.deleteWarning}>
                This will permanently delete your account and all associated data. This action cannot be undone.
              </Text>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  content: {
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '300',
    letterSpacing: -0.5,
    color: '#0f0f0f',
    marginBottom: 30,
  },
  titleMobile: {
    paddingLeft: 64, // Position title to the right of sidebar button (16px button left + 40px button width + 8px gap = 64px)
  },
  message: {
    fontSize: 16,
    color: '#666',
    fontWeight: '300',
  },
  successMessage: {
    padding: 12,
    marginBottom: 16,
    backgroundColor: '#d4edda',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#c3e6cb',
  },
  successText: {
    color: '#155724',
    fontSize: 14,
  },
  cancelMessage: {
    padding: 12,
    marginBottom: 16,
    backgroundColor: '#fff3cd',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ffeaa7',
  },
  cancelText: {
    color: '#856404',
    fontSize: 14,
  },
  loading: {
    fontSize: 16,
    color: '#666',
  },
  error: {
    fontSize: 16,
    color: '#c62828',
  },
  settingsContent: {
    gap: 30,
  },
  section: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '300',
    letterSpacing: -0.3,
    color: '#0f0f0f',
  },
  usageInfo: {
    gap: 16,
  },
  usagePlan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  usageStats: {
    flexDirection: 'row',
    gap: 24,
    flexWrap: 'wrap',
  },
  usageStat: {
    gap: 4,
  },
  usageLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '300',
  },
  usageValue: {
    fontSize: 18,
    color: '#0f0f0f',
    fontWeight: '300',
  },
  planName: {
    fontSize: 16,
    fontWeight: '400',
  },
  progressContainer: {
    gap: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#d0d0d0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#0f0f0f',
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '300',
  },
  subscriptionInfo: {
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginTop: 16,
    gap: 12,
  },
  subscriptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  subscriptionLabel: {
    fontWeight: '600',
    marginRight: 8,
    color: '#0f0f0f',
  },
  subscriptionValue: {
    fontSize: 15,
    color: '#0f0f0f',
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  statusActive: {
    backgroundColor: '#d4edda',
  },
  statusInactive: {
    backgroundColor: '#fff3cd',
  },
  statusText: {
    fontSize: 14,
  },
  statusActiveText: {
    color: '#155724',
  },
  statusInactiveText: {
    color: '#856404',
  },
  cancelingBadge: {
    marginLeft: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: '#f8d7da',
  },
  cancelingText: {
    fontSize: 14,
    color: '#721c24',
  },
  cancelNotice: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#fff3cd',
    borderRadius: 4,
  },
  cancelNoticeText: {
    fontSize: 14,
    color: '#856404',
  },
  noSubscription: {
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginTop: 16,
  },
  noSubscriptionText: {
    fontSize: 14,
    color: '#6c757d',
  },
  linkButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  linkText: {
    fontSize: 16,
    color: '#0f0f0f',
    fontWeight: '400',
  },
  linkArrow: {
    fontSize: 18,
    color: '#666',
  },
  restoreButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#0f0f0f',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    minHeight: 44, // Minimum touch target for iOS
  },
  restoreButtonPressed: {
    backgroundColor: '#333',
    opacity: 0.9,
  },
  restoreButtonDisabled: {
    backgroundColor: '#999',
    opacity: 0.6,
  },
  restoreButtonText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '400',
  },
  restoreButtonTextDisabled: {
    color: '#cccccc',
  },
  deleteButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#dc3545',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 44, // Minimum touch target for iOS
  },
  deleteButtonPressed: {
    backgroundColor: '#c82333',
    opacity: 0.9,
  },
  deleteButtonDisabled: {
    backgroundColor: '#999',
    opacity: 0.6,
  },
  deleteButtonText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '400',
  },
  deleteButtonTextDisabled: {
    color: '#cccccc',
  },
  deleteWarning: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
  },
})

export default SettingsView
