import { useState } from 'react'
import { View, Text, StyleSheet, Modal, Pressable, Platform, ScrollView, Dimensions } from 'react-native'
import { createPortal } from 'react-dom'
import { Svg, Line } from 'react-native-svg'
import { useAuthStore } from '../../stores/authStore'
import { useUsageStore } from '../../stores/usageStore'
import { supabase } from '../../lib/supabase'
import { getApiBaseUrl } from '../../lib/platform'
import { openURL, showAlert } from '../../lib/platformHelpers'

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
  const { user } = useAuthStore()
  const { planName, fetchUsage } = useUsageStore()

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
                    <Text style={styles.benefitItem}>10 notes</Text>
                    <Text style={styles.benefitItem}>10 flashcards/tests/goals</Text>
                    <Text style={styles.benefitItem}>Limited AI usage</Text>
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
                    <Text style={styles.benefitItem}>Unlimited notes</Text>
                    <Text style={styles.benefitItem}>10x AI usage</Text>
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
  const isMobile = windowWidth <= 768

  return (
      <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlayNative} onPress={onClose}>
        <Pressable 
          style={[
            styles.content, 
            isMobile && styles.contentMobile
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
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
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
                <Text style={styles.benefitItem}>10 notes</Text>
                <Text style={styles.benefitItem}>Limited AI usage</Text>
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
                <Text style={styles.benefitItem}>Unlimited notes</Text>
                <Text style={styles.benefitItem}>Unlimited flashcards/tests/goals</Text>
                <Text style={styles.benefitItem}>10x AI usage</Text>
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
          </ScrollView>
        </Pressable>
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
    maxWidth: 700,
    flexDirection: 'column',
    ...(Platform.OS === 'web' && {
      maxWidth: 700,
      position: 'relative',
      zIndex: 2147483647,
      pointerEvents: 'auto',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
    }),
  },
  contentMobile: {
    maxWidth: '100%',
    width: '100%',
    maxHeight: '90%',
  },
  scrollContent: {
    paddingBottom: 20,
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
})

export default UpgradeModal
