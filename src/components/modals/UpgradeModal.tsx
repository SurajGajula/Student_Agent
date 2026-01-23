import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, Modal, Pressable, Platform, ScrollView, Dimensions } from 'react-native'
import { createPortal } from 'react-dom'
import { Svg, Line } from 'react-native-svg'
import { useAuthStore } from '../../stores/authStore'
import { useUsageStore } from '../../stores/usageStore'
import { supabase } from '../../lib/supabase'
import { getApiBaseUrl } from '../../lib/platform'
import { openURL, showAlert } from '../../lib/platformHelpers'

// IAP Product ID - matches the subscription in App Store Connect
const IAP_PRODUCT_ID = 'com.studentagent.app.pro'

const IAP_ENABLED = true

// Lazy load IAP module to avoid crashes if module isn't installed
// Note: This module requires native code to be linked via pod install and native rebuild
let iapModuleCache: any = null
let iapModuleChecked = false
let iapModuleFailed = false

const getInAppPurchases = (): any => {
  // Temporarily disabled until native rebuild
  if (!IAP_ENABLED) {
    return null
  }
  
  if (Platform.OS !== 'ios') {
    return null
  }
  
  // If we've already determined it failed, don't try again
  if (iapModuleFailed) {
    return null
  }
  
  // Only check once
  if (iapModuleChecked) {
    return iapModuleCache
  }
  
  iapModuleChecked = true
  
  try {
    const iapModule = require('expo-in-app-purchases')
    const targetModule = iapModule.InAppPurchases || iapModule
    
    const hasCoreMethods = targetModule &&
      typeof targetModule === 'object' &&
      typeof targetModule.connectAsync === 'function' &&
      typeof targetModule.purchaseItemAsync === 'function' &&
      typeof targetModule.setPurchaseListener === 'function'

    if (hasCoreMethods) {
      iapModuleCache = targetModule
      return targetModule
    } else {
      iapModuleFailed = true
    }
  } catch (error: any) {
    iapModuleFailed = true
    iapModuleCache = null
  }
  
  return null
}

interface UpgradeModalProps {
  isOpen: boolean
  onClose: () => void
}

const CloseIcon = () => (
  <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Line x1="18" y1="6" x2="6" y2="18" />
    <Line x1="6" y1="6" x2="18" y2="18" />
  </Svg>
)

function UpgradeModal({ isOpen, onClose }: UpgradeModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isUnsubscribing, setIsUnsubscribing] = useState(false)
  const [isIAPLoading, setIsIAPLoading] = useState(false)
  const [iapAvailable, setIapAvailable] = useState(false)
  const [iapConnected, setIapConnected] = useState(false)
  const { user } = useAuthStore()
  const { planName, fetchUsage } = useUsageStore()

  // Initialize IAP on iOS and set up purchase listener
  useEffect(() => {
    let isMounted = true
    let iapModule: any = null

    if (Platform.OS === 'ios' && isOpen) {
      // Lazy load the module only when needed
      iapModule = getInAppPurchases()

      if (iapModule) {
        // Wrap async initialization in a safe way
        const initIAP = async () => {
          try {
            const isAvailable = typeof iapModule.isAvailableAsync === 'function'
              ? await iapModule.isAvailableAsync()
              : true // If method not exposed, assume available and let connectAsync fail if not

            if (isMounted) setIapAvailable(isAvailable)
            
            if (isAvailable && isMounted) {
              if (!iapConnected) {
                try {
                  await iapModule.connectAsync()
                  if (isMounted) setIapConnected(true)
                } catch (err: any) {
                  // If already connected, mark as connected and continue
                  if (String(err?.message || '').includes('Already connected') || err?.code === 'ERR_IN_APP_PURCHASES_CONNECTION') {
                    if (isMounted) setIapConnected(true)
                  } else {
                    throw err
                  }
                }
              }
              
              // Set up purchase listener once
              iapModule.setPurchaseListener(async ({ response, errorCode }: any) => {
                if (errorCode) {
                  if (errorCode === iapModule.IAPResponseCode?.USER_CANCELED) {
                    showAlert('Purchase Canceled', 'Purchase was canceled')
                  } else {
                    showAlert('Purchase Error', `Purchase failed: ${errorCode}`)
                  }
                  setIsIAPLoading(false)
                  return
                }

                if (response && response.length > 0) {
                  // Verify receipt with backend
                  await verifyIAPReceipt(response[0])
                } else {
                  setIsIAPLoading(false)
                }
              })
            }
          } catch (error) {
            if (isMounted) setIapAvailable(false)
          }
        }

        initIAP().catch(() => {
          if (isMounted) setIapAvailable(false)
        })
      } else {
        // Module not available, set IAP as unavailable
        if (isMounted) setIapAvailable(false)
      }
    } else {
      // Not iOS, IAP not available
      if (isMounted) setIapAvailable(false)
    }

    return () => {
      isMounted = false
      // Don't disconnect - keep the connection alive for future purchases
      // Disconnecting and reconnecting causes "Must be connected" errors
    }
  }, [isOpen, iapConnected])

  const handleIAPPurchase = async () => {
    if (!user) {
      showAlert('Upgrade', 'Please log in to upgrade')
      return
    }

    const iapModule = getInAppPurchases()
    if (!iapModule || !iapAvailable) {
      showAlert('Error', 'In-App Purchases are not available. Please try the web payment option.')
      return
    }

    setIsIAPLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('Not authenticated')
      }

      // Ensure IAP is connected
      try {
        await iapModule.connectAsync()
        setIapConnected(true)
      } catch (err: any) {
        if (String(err?.message || '').includes('Already connected') || err?.code === 'ERR_IN_APP_PURCHASES_CONNECTION') {
          setIapConnected(true)
        } else {
          throw err
        }
      }
      
      // Wait for connection to stabilize
      await new Promise(resolve => setTimeout(resolve, 100))

      // Fetch product from App Store with timeout
      const timeoutDuration = 30000 // 30 seconds
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout: App Store not responding. Please try again.')), timeoutDuration)
      )
      
      const { results, errorCode } = await Promise.race([
        iapModule.getProductsAsync([IAP_PRODUCT_ID]),
        timeoutPromise
      ]) as any
      
      if (errorCode) {
        throw new Error(`Failed to fetch product: ${errorCode}`)
      }
      
      if (!results || results.length === 0) {
        throw new Error('Product not found in App Store.')
      }

      // Purchase the subscription (listener handles the rest)
      await iapModule.purchaseItemAsync(IAP_PRODUCT_ID)
    } catch (error) {
      showAlert('Error', error instanceof Error ? error.message : 'Failed to start purchase')
      setIsIAPLoading(false)
    }
  }

  const verifyIAPReceipt = async (purchase: any) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      const API_BASE_URL = getApiBaseUrl()
      const response = await fetch(`${API_BASE_URL}/api/iap/verify-receipt`, {
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

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || error.error || 'Failed to verify purchase')
      }

      const data = await response.json()
      if (data.success) {
        showAlert('Success', 'Subscription activated successfully!')
        await fetchUsage()
        onClose()
      } else {
        throw new Error(data.error || 'Purchase verification failed')
      }
    } catch (error) {
      console.error('Receipt verification error:', error)
      showAlert('Error', error instanceof Error ? error.message : 'Failed to verify purchase')
    } finally {
      setIsIAPLoading(false)
    }
  }

  const handleUpgrade = async () => {
    if (!user) {
      showAlert('Upgrade', 'Please log in to upgrade')
      return
    }

    setIsLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('Not authenticated')
      }

      const API_BASE_URL = getApiBaseUrl()
      const response = await fetch(`${API_BASE_URL}/api/stripe/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || error.error || 'Failed to create checkout session')
      }

      const { url } = await response.json()
      
      if (url) {
        await openURL(url)
      } else {
        throw new Error('No checkout URL received')
      }
    } catch (error) {
      console.error('Error creating checkout session:', error)
      showAlert('Error', error instanceof Error ? error.message : 'Failed to start checkout')
      setIsLoading(false)
    }
  }

  const handleUnsubscribe = async () => {
    if (!user) {
      return
    }

    setIsUnsubscribing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('Not authenticated')
      }

      const API_BASE_URL = getApiBaseUrl()
      const response = await fetch(`${API_BASE_URL}/api/stripe/cancel-subscription`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || error.error || 'Failed to cancel subscription')
      }

      await fetchUsage()
      onClose()
    } catch (error) {
      console.error('Error canceling subscription:', error)
    } finally {
      setIsUnsubscribing(false)
    }
  }

  const isPro = planName === 'pro'
  
  // On web, render modal directly without using React Native Modal
  if (Platform.OS === 'web') {
    if (!isOpen) return null
    
    const modalContent = (
      <View style={styles.modalContainer}>
        <Pressable style={styles.overlay} onPress={onClose}>
          <View style={styles.contentWrapper}>
            <Pressable style={styles.content} onPress={(e) => e.stopPropagation()}>
              <View style={styles.header}>
                <Text style={styles.title}>Upgrade Plan</Text>
                <Pressable onPress={onClose} style={styles.closeButton}>
                  <CloseIcon />
                </Pressable>
              </View>
              
              <View style={styles.plansContainer}>
                <View style={[styles.planCard, styles.freePlan]}>
                  <View style={styles.planHeader}>
                    <Text style={styles.planName}>Free</Text>
                    <View style={styles.planPriceContainer}>
                      <Text style={styles.planPrice}>$0</Text>
                      <Text style={styles.planPeriod}>/month</Text>
                    </View>
                  </View>
                  <View style={styles.benefitsList}>
                    <Text style={styles.benefitItem}>10 items per category</Text>
                    <Text style={styles.benefitItem}>Limited AI usage</Text>
                    <Text style={styles.benefitItem}>~10 hours YouTube transcription</Text>
                  </View>
                  <Pressable 
                    style={[styles.planButton, styles.currentPlanButton]}
                    onPress={isPro ? handleUnsubscribe : undefined}
                    disabled={!isPro || isUnsubscribing}
                  >
                    <Text style={styles.currentPlanButtonText}>
                      {isPro ? (isUnsubscribing ? 'Canceling...' : 'Unsubscribe') : 'Current Plan'}
                    </Text>
                  </Pressable>
                </View>
                
                <View style={[styles.planCard, styles.proPlan]}>
                  <View style={styles.planHeader}>
                    <Text style={styles.planName}>Pro</Text>
                    <View style={styles.planPriceContainer}>
                      <Text style={styles.planPrice}>$9.99</Text>
                      <Text style={styles.planPeriod}>/month</Text>
                    </View>
                  </View>
                  <View style={styles.benefitsList}>
                    <Text style={styles.benefitItem}>Unlimited items per category</Text>
                    <Text style={styles.benefitItem}>10x AI usage</Text>
                    <Text style={styles.benefitItem}>~100 hours YouTube transcription</Text>
                    <Text style={styles.benefitItem}>Priority support/feature requests</Text>
                  </View>
                  {isPro ? (
                    <Pressable style={[styles.planButton, styles.proPlanButton]} disabled>
                      <Text style={styles.proPlanButtonText}>Current Plan</Text>
                    </Pressable>
                  ) : (
                    <Pressable 
                      style={[styles.planButton, styles.proPlanButton]}
                      onPress={handleUpgrade}
                      disabled={isLoading}
                    >
                      <Text style={styles.proPlanButtonText}>
                        {isLoading ? 'Loading...' : 'Upgrade to Pro'}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </View>
    )

    return typeof document !== 'undefined' 
      ? createPortal(modalContent, document.body)
      : modalContent
  }

  // Native Modal
  if (!isOpen) return null

  const windowWidth = Dimensions.get('window').width
  const windowHeight = Dimensions.get('window').height
  const isMobile = windowWidth <= 768

  return (
      <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
    >
      <Pressable style={styles.overlayNative} onPress={onClose}>
        <View style={styles.contentWrapperNative}>
          <Pressable 
            style={[
              styles.content, 
              isMobile && styles.contentMobile,
              !isMobile && styles.contentTablet
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.header}>
              <Text style={styles.title}>Upgrade Plan</Text>
              <Pressable onPress={onClose} style={styles.closeButton}>
                <CloseIcon />
              </Pressable>
            </View>
            
            <ScrollView 
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={true}
              bounces={true}
              scrollEnabled={true}
            >
          <View style={styles.plansContainer}>
            <View style={[styles.planCard, styles.freePlan]}>
              <View style={styles.planHeader}>
                <Text style={styles.planName}>Free</Text>
                <View style={styles.planPriceContainer}>
                  <Text style={styles.planPrice}>$0</Text>
                  <Text style={styles.planPeriod}>/month</Text>
                </View>
              </View>
              <View style={styles.benefitsList}>
                <Text style={styles.benefitItem}>10 items per category</Text>
                <Text style={styles.benefitItem}>Limited AI usage</Text>
                <Text style={styles.benefitItem}>~10 hours YouTube transcription</Text>
              </View>
              <Pressable 
                style={[styles.planButton, styles.currentPlanButton]}
                onPress={isPro ? handleUnsubscribe : undefined}
                disabled={!isPro || isUnsubscribing}
              >
                <Text style={styles.currentPlanButtonText}>
                  {isPro ? (isUnsubscribing ? 'Canceling...' : 'Unsubscribe') : 'Current Plan'}
                </Text>
              </Pressable>
            </View>
            
            <View style={[styles.planCard, styles.proPlan]}>
              <View style={styles.planHeader}>
                <Text style={styles.planName}>Pro</Text>
                <View style={styles.planPriceContainer}>
                  <Text style={styles.planPrice}>$9.99</Text>
                  <Text style={styles.planPeriod}>/month</Text>
                </View>
              </View>
                  <View style={styles.benefitsList}>
                    <Text style={styles.benefitItem}>Unlimited items per category</Text>
                    <Text style={styles.benefitItem}>10x AI usage</Text>
                    <Text style={styles.benefitItem}>~100 hours YouTube transcription</Text>
                    <Text style={styles.benefitItem}>Priority support/feature requests</Text>
                  </View>
              {isPro ? (
                <Pressable style={[styles.planButton, styles.proPlanButton]} disabled>
                  <Text style={styles.proPlanButtonText}>Current Plan</Text>
                </Pressable>
              ) : (
                <View style={styles.buttonContainer}>
                  {Platform.OS === 'ios' ? (
                    // On iOS, ONLY show App Store subscription to comply with Guideline 3.1.1
                    <Pressable 
                      style={[styles.planButton, styles.proPlanButton, styles.iapButton]}
                      onPress={handleIAPPurchase}
                      disabled={isIAPLoading || !iapAvailable}
                    >
                      <Text style={styles.proPlanButtonText}>
                        {!IAP_ENABLED ? 'IAP Disabled' : 
                         !iapAvailable ? 'IAP Not Available' :
                         isIAPLoading ? 'Processing...' : 'Subscribe via App Store'}
                      </Text>
                    </Pressable>
                  ) : (
                    // On Web/Android, show standard Stripe checkout
                <Pressable 
                  style={[styles.planButton, styles.proPlanButton]}
                  onPress={handleUpgrade}
                  disabled={isLoading}
                >
                  <Text style={styles.proPlanButtonText}>
                    {isLoading ? 'Loading...' : 'Upgrade to Pro'}
                  </Text>
                </Pressable>
                  )}
                </View>
              )}
            </View>
          </View>
          </ScrollView>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalContainer: {
    ...(Platform.OS === 'web' && {
      position: 'fixed' as any,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 2147483647,
      pointerEvents: 'none',
    }),
  } as any,
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    ...(Platform.OS === 'web' && {
      position: 'fixed' as any,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100%',
      height: '100%',
      zIndex: 2147483646,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      pointerEvents: 'auto',
    }),
  } as any,
  overlayNative: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    ...(Platform.OS !== 'web' && {
      padding: 16, // Less padding on mobile for more space
    }),
  },
  contentWrapperNative: {
    width: '100%',
    maxWidth: 700,
    maxHeight: '90%',
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS !== 'web' && {
      width: '100%',
      maxWidth: 700,
    }),
  },
  contentWrapper: {
    ...(Platform.OS === 'web' && {
      width: '100%',
      maxWidth: 700,
      zIndex: 2147483647,
      pointerEvents: 'auto',
      position: 'relative',
    }),
  },
  content: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    width: '100%',
    flexDirection: 'column',
    ...(Platform.OS === 'web' && {
      maxWidth: 700,
      position: 'relative',
      zIndex: 2147483647,
      pointerEvents: 'auto',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
    }),
    ...(Platform.OS !== 'web' && {
      maxHeight: '100%',
    }),
  },
  contentMobile: {
    maxWidth: '100%',
    width: '100%',
  },
  contentTablet: {
    maxWidth: 700,
  },
  scrollView: {
    flexGrow: 1,
    flexShrink: 1,
  },
  scrollContent: {
    paddingBottom: 20,
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#d0d0d0',
  },
  title: {
    fontSize: 20,
    fontWeight: '300',
    color: '#0f0f0f',
  },
  closeButton: {
    padding: 4,
  },
  plansContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 20,
    ...(Platform.OS !== 'web' && {
      flexDirection: 'column',
    }),
  },
  planCard: {
    flex: 1,
    padding: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    gap: 16,
  },
  freePlan: {
    backgroundColor: '#f8f9fa',
  },
  proPlan: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#0f0f0f',
  },
  planHeader: {
    gap: 8,
  },
  planName: {
    fontSize: 24,
    fontWeight: '300',
    color: '#0f0f0f',
  },
  planPriceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  planPrice: {
    fontSize: 32,
    fontWeight: '300',
    color: '#0f0f0f',
  },
  planPeriod: {
    fontSize: 16,
    fontWeight: '300',
    color: '#666',
  },
  benefitsList: {
    gap: 8,
    marginTop: 8,
  },
  benefitItem: {
    fontSize: 14,
    fontWeight: '300',
    color: '#0f0f0f',
  },
  planButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  currentPlanButton: {
    backgroundColor: '#e8e8e8',
    borderWidth: 1,
    borderColor: '#d0d0d0',
  },
  currentPlanButtonText: {
    fontSize: 16,
    fontWeight: '300',
    color: '#0f0f0f',
  },
  proPlanButton: {
    backgroundColor: '#0f0f0f',
  },
  proPlanButtonText: {
    fontSize: 16,
    fontWeight: '300',
    color: '#f0f0f0',
  },
  buttonContainer: {
    gap: 12,
  },
  iapButton: {
    backgroundColor: '#0f0f0f',
  },
  externalButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#0f0f0f',
  },
  externalButtonText: {
    fontSize: 16,
    fontWeight: '300',
    color: '#0f0f0f',
  },
})

export default UpgradeModal
