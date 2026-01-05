import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Platform, Dimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useUsageStore } from '../../stores/usageStore'
import { useAuthStore } from '../../stores/authStore'
import { supabase } from '../../lib/supabase'
import { getApiBaseUrl } from '../../lib/platform'

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

function SettingsView() {
  const { planName, tokensUsed, monthlyLimit, remaining, isLoading, error, fetchUsage } = useUsageStore()
  const { isLoggedIn } = useAuthStore()
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [cancelMessage, setCancelMessage] = useState<string | null>(null)
  const [subscriptionDetails, setSubscriptionDetails] = useState<SubscriptionDetails | null>(null)
  const [loadingSubscription, setLoadingSubscription] = useState(false)
  const insets = useSafeAreaInsets()
  const windowWidth = Dimensions.get('window').width
  const isMobile = windowWidth <= 768

  // Debug logging
  useEffect(() => {
    console.log('[SettingsView] Component mounted/updated', {
      isLoggedIn,
      isLoading,
      error,
      hasSession: 'checking...'
    })
    
    // Check actual session
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        console.log('[SettingsView] Actual session check:', {
          hasSession: !!session,
          userId: session?.user?.id,
          isLoggedIn,
          mismatch: !!session !== isLoggedIn
        })
      } catch (err) {
        console.error('[SettingsView] Error checking session:', err)
      }
    })()
  }, [isLoggedIn, isLoading, error])
  // Button center calculation: button is at top (insets.top + 8 on iOS, 50 on web), height is 40px (8px padding + 24px icon + 8px padding)
  // Button center = (insets.top + 8) + 20 = insets.top + 28 on iOS, or 50 + 20 = 70 on web
  // Title is 32px tall, so half-height is 16px
  // For iOS: paddingTop = (insets.top + 28) - 16 = insets.top + 12
  // For web: paddingTop = 70 - 16 = 54
  const mobilePaddingTop = Platform.OS === 'ios' 
    ? Math.max(insets.top + 12, 20) 
    : Math.max(54, 20)

  const fetchSubscriptionDetails = async () => {
    if (!isLoggedIn) {
      console.log('[SettingsView] fetchSubscriptionDetails called but isLoggedIn is false')
      return
    }

    setLoadingSubscription(true)
    try {
      // Ensure Supabase is initialized before getting session
      const { initSupabase, getSupabase } = await import('../../lib/supabase')
      await initSupabase()
      const supabaseClient = getSupabase()
      
      console.log('[SettingsView] Getting session for subscription details...')
      const { data: { session }, error } = await supabaseClient.auth.getSession()
      console.log('[SettingsView] Session check completed', { hasSession: !!session, hasError: !!error })
      
      if (error) {
        console.error('[SettingsView] Error getting session in fetchSubscriptionDetails:', error)
        setLoadingSubscription(false)
        return
      }
      
      if (!session) {
        console.warn('[SettingsView] ⚠️ fetchSubscriptionDetails: NO SESSION/TOKEN found')
        setLoadingSubscription(false)
        return
      }
      
      console.log('[SettingsView] ✓ fetchSubscriptionDetails: Session found', {
        userId: session.user?.id,
        expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'N/A'
      })

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
    const syncAuth = async () => {
      try {
        const { useAuthStore } = await import('../../stores/authStore')
        await useAuthStore.getState().syncFromSession()
      } catch (err) {
        console.error('[SettingsView] Error syncing auth state:', err)
      }
    }
    syncAuth()
  }, [])

  useEffect(() => {
    console.log('[SettingsView] useEffect for fetchUsage triggered', {
      isLoggedIn,
      isLoading,
      fetchUsageExists: !!fetchUsage,
      timestamp: new Date().toISOString()
    })
    
    if (isLoggedIn) {
      console.log('[SettingsView] isLoggedIn is true, calling fetchUsage and fetchSubscriptionDetails')
      // Use the current fetchUsage directly (Zustand functions are stable)
      fetchUsage().then(() => {
        console.log('[SettingsView] fetchUsage completed successfully')
      }).catch(err => {
        console.error('[SettingsView] fetchUsage failed:', err)
      })
      fetchSubscriptionDetails()
    } else {
      console.log('[SettingsView] isLoggedIn is false, skipping API calls')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]) // Only depend on isLoggedIn - fetchUsage is stable from Zustand

  // Also trigger fetch when component becomes visible (for tab switching)
  useEffect(() => {
    if (Platform.OS !== 'web') return

    const handleVisibilityChange = () => {
      if (!document.hidden && isLoggedIn) {
        console.log('[SettingsView] Tab/window became visible, refreshing data', {
          currentIsLoading: isLoading
        })
        // Use the current fetchUsage directly
        fetchUsage().then(() => {
          console.log('[SettingsView] fetchUsage on visibility change completed')
        }).catch(err => {
          console.error('[SettingsView] fetchUsage on visibility change failed:', err)
        })
        fetchSubscriptionDetails()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]) // Only depend on isLoggedIn

  // Safety timeout: if isLoading is true for more than 15 seconds, log a warning
  useEffect(() => {
    if (isLoading) {
      const timeout = setTimeout(() => {
        console.warn('[SettingsView] ⚠️ isLoading has been true for 15+ seconds, this may indicate a stuck API call')
        // Force a re-fetch attempt
        if (isLoggedIn) {
          console.log('[SettingsView] Attempting to force refresh usage data')
          fetchUsage().catch(err => {
            console.error('[SettingsView] Force refresh failed:', err)
          })
        }
      }, 15000)
      return () => clearTimeout(timeout)
    }
  }, [isLoading, isLoggedIn, fetchUsage])

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

  const usagePercentage = monthlyLimit > 0 ? (tokensUsed / monthlyLimit) * 100 : 0

  console.log('[SettingsView] Rendering with isLoggedIn:', isLoggedIn, 'isLoading:', isLoading)

  if (!isLoggedIn) {
    console.log('[SettingsView] Rendering logged-out view')
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

  console.log('[SettingsView] Rendering logged-in view')
  
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

            {planName === 'pro' && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Subscription</Text>
                
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
              </View>
            )}
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
})

export default SettingsView
