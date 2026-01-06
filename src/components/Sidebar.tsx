import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, Pressable, ScrollView, Platform, Dimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuthStore } from '../stores/authStore'
import { useUsageStore } from '../stores/usageStore'
import UpgradeModal from './modals/UpgradeModal'
import { NotesIcon, TestsIcon, FlashcardsIcon, SettingsIcon, LogoutIcon, LoginIcon } from './icons'

interface SidebarProps {
  onNavigate: (view: string) => void
  onClose?: () => void
  isOpen?: boolean
  onOpenUpgradeModal?: () => void
  onOpenLoginModal?: () => void
}

function Sidebar({ onNavigate, onClose, isOpen, onOpenUpgradeModal, onOpenLoginModal }: SidebarProps) {
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false)
  const { isLoggedIn, username, signOut } = useAuthStore()
  const { planName } = useUsageStore()
  const [windowWidth, setWindowWidth] = useState(Dimensions.get('window').width)
  const isMobile = windowWidth <= 768
  const insets = useSafeAreaInsets()

  // Update window width on resize
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setWindowWidth(window.width)
    })
    return () => subscription?.remove()
  }, [])


  const handleLogout = async () => {
    await signOut()
  }

  const handleUpgrade = () => {
    if (onOpenUpgradeModal) {
      onOpenUpgradeModal()
    } else {
    setIsUpgradeModalOpen(true)
    }
  }

  const handleSettings = () => {
    onNavigate('settings')
    onClose?.()
  }

  const handleNavigate = (view: string) => {
    onNavigate(view)
    onClose?.()
  }

  const sidebarStyle = [
    styles.sidebar,
    isMobile && styles.sidebarMobile,
    isMobile && isOpen && styles.sidebarOpen,
    !isMobile && styles.sidebarDesktop,
    Platform.OS === 'ios' && isMobile && { paddingTop: insets.top },
  ]

  return (
    <View style={[sidebarStyle, isMobile && { flex: 1, height: '100%' }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.sidebarNav}>
          <Pressable 
            style={styles.sidebarButton}
            onPress={() => handleNavigate('notes')}
        >
            <View style={styles.iconWrapper}>
              <NotesIcon />
            </View>
            <Text style={styles.sidebarButtonText}>Notes</Text>
          </Pressable>
          
          <Pressable 
            style={styles.sidebarButton}
            onPress={() => handleNavigate('tests')}
        >
            <View style={styles.iconWrapper}>
              <TestsIcon />
            </View>
            <Text style={styles.sidebarButtonText}>Tests</Text>
          </Pressable>
          
          <Pressable 
            style={styles.sidebarButton}
            onPress={() => handleNavigate('flashcards')}
        >
            <View style={styles.iconWrapper}>
              <FlashcardsIcon />
            </View>
            <Text style={styles.sidebarButtonText}>Flashcards</Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={styles.sidebarAuthSection}>
      {isLoggedIn ? (
          <>
            <View style={styles.sidebarUserInfo}>
              <Text style={styles.sidebarUsername}>{username}</Text>
              <Pressable 
                style={styles.sidebarUpgradeButton}
                onPress={handleUpgrade}
            >
                <Text style={styles.sidebarUpgradeButtonText}>
              {planName === 'pro' ? 'Pro' : 'Upgrade'}
                </Text>
              </Pressable>
            </View>
            <Pressable 
              style={styles.sidebarButton}
              onPress={handleSettings}
          >
              <View style={styles.iconWrapper}>
                <SettingsIcon />
              </View>
              <Text style={styles.sidebarButtonText}>Settings</Text>
            </Pressable>
            <Pressable 
              style={styles.sidebarButton}
              onPress={handleLogout}
          >
              <View style={styles.iconWrapper}>
                <LogoutIcon />
              </View>
              <Text style={styles.sidebarButtonText}>Logout</Text>
            </Pressable>
          </>
      ) : (
          <Pressable 
            style={styles.sidebarButton}
            onPress={() => {
              if (onOpenLoginModal) {
                onOpenLoginModal()
              }
            }}
        >
            <View style={styles.iconWrapper}>
              <LoginIcon />
            </View>
            <Text style={styles.sidebarButtonText}>Login</Text>
          </Pressable>
        )}
      </View>

      {/* UpgradeModal is now rendered at App level for proper z-index */}
      {!onOpenUpgradeModal && (
      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
      />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  sidebar: {
    backgroundColor: '#e8e8e8',
    borderRightWidth: 1,
    borderRightColor: '#d0d0d0',
    flexDirection: 'column',
    ...(Platform.OS === 'web' && {
      height: '100vh' as any,
    }),
  } as any,
  sidebarDesktop: {
    width: 250,
    padding: 20,
    ...(Platform.OS === 'web' && {
      position: 'relative',
      zIndex: 10, // Higher than flashcard container to stay in front
    }),
  },
  sidebarMobile: {
    position: 'absolute',
    left: -250,
    top: 0,
    bottom: 0,
    width: 250,
    zIndex: 1000,
    height: '100%',
    ...(Platform.OS === 'web' && {
      transition: 'left 0.3s ease',
      boxShadow: '2px 0 10px rgba(0, 0, 0, 0.2)',
      height: '100vh' as any,
    }),
  } as any,
  sidebarOpen: {
    left: 0,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  sidebarNav: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 20,
    alignItems: 'flex-start',
    ...(Platform.OS === 'ios' && {
      paddingTop: 60,
    }),
    ...(Platform.OS !== 'web' && {
      paddingLeft: 16, // Align with sidebar button (left: 16)
      paddingRight: 16,
    }),
  },
  sidebarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
    ...(Platform.OS === 'web' && {
      paddingVertical: 18,
      paddingHorizontal: 22,
    }),
  },
  iconWrapper: {
    ...(Platform.OS === 'web' && {
      transform: [{ scale: 1.15 }],
    }),
  },
  sidebarButtonText: {
    color: '#0f0f0f',
    fontSize: 16,
    fontWeight: '300',
    textAlign: 'left',
    ...(Platform.OS === 'web' && {
      fontSize: 19,
    }),
  },
  sidebarAuthSection: {
    borderTopWidth: 1,
    borderTopColor: '#d0d0d0',
    padding: 20,
    gap: 12,
    backgroundColor: '#e8e8e8',
    alignItems: 'flex-start',
    ...(Platform.OS !== 'web' && {
      paddingLeft: 16, // Align with sidebar button (left: 16)
      paddingRight: 16,
    }),
  },
  sidebarUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    width: '100%',
    ...(Platform.OS === 'web' && {
      paddingVertical: 14,
      paddingHorizontal: 18,
    }),
  },
  sidebarUsername: {
    color: '#0f0f0f',
    fontSize: 15,
    fontWeight: '300',
    flex: 1,
    textAlign: 'left',
    ...(Platform.OS === 'web' && {
      fontSize: 16,
    }),
  },
  sidebarUpgradeButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#0f0f0f',
    borderRadius: 6,
    ...(Platform.OS === 'web' && {
      paddingVertical: 8,
      paddingHorizontal: 14,
    }),
  },
  sidebarUpgradeButtonText: {
    color: '#f0f0f0',
    fontSize: 14,
    fontWeight: '300',
    textAlign: 'center',
    ...(Platform.OS === 'web' && {
      fontSize: 15,
    }),
  },
})

export default Sidebar
