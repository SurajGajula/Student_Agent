import React, { useState, useEffect } from 'react'
import { View, StyleSheet, Pressable, Dimensions, Platform, AppState, AppStateStatus } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import { useAuthStore } from './stores/authStore'
import Sidebar from './components/Sidebar'
import MobileMenuButton from './components/MobileMenuButton'
import NotesView from './components/views/NotesView'
import TestsView from './components/views/TestsView'
import FlashcardsView from './components/views/FlashcardsView'
import GoalsView from './components/views/GoalsView'
import SettingsView from './components/views/SettingsView'
import PrivacyPolicyView from './components/views/PrivacyPolicyView'
import TermsOfServiceView from './components/views/TermsOfServiceView'
import ChatBar from './components/ChatBar'
import LoginModal from './components/modals/LoginModal'
import UpgradeModal from './components/modals/UpgradeModal'
import { DetailModeProvider, useDetailMode } from './contexts/DetailModeContext'

// Helper function to get view from URL
const getViewFromUrl = (): string => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const path = window.location.pathname
    if (path === '/terms') return 'terms'
    if (path === '/privacy') return 'privacy'
    if (path === '/settings') return 'settings'
    if (path === '/tests') return 'tests'
    if (path === '/flashcards') return 'flashcards'
    if (path === '/goals') return 'goals'
    if (path === '/notes' || path === '/') return 'notes'
  }
  return 'notes'
}

function AppContent() {
  const [currentView, setCurrentView] = useState<string>(getViewFromUrl())
  const [navCounter, setNavCounter] = useState(0)
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [windowWidth, setWindowWidth] = useState(Dimensions.get('window').width)
  const { isInDetailMode } = useDetailMode()

  // Initialize Supabase and auth on all platforms
  useEffect(() => {
    const init = async () => {
      try {
        // Initialize Supabase with runtime config first
        const { initSupabase } = await import('./lib/supabase')
        await initSupabase()
        
        // Then initialize auth
        await useAuthStore.getState().initializeAuth()
      } catch (err) {
        console.error('Initialization error:', err)
      }
    }
    init()
  }, [])

  // Refresh session when app becomes active and sync all stores
  useEffect(() => {
    let lastRefreshTime = 0
    const REFRESH_COOLDOWN = 2000 // 2 second cooldown
    let isHandlingTabReturn = false // Guard to prevent concurrent execution

    const refreshSessionOnTabReturn = async (): Promise<boolean> => {
      const now = Date.now()
      // Skip if we just refreshed recently
      if (now - lastRefreshTime < REFRESH_COOLDOWN) {
        console.log('[App] Skipping refresh due to cooldown')
        return false
      }
      lastRefreshTime = now

      console.log('[App] App became active - refreshing session...')
      try {
        const { getSupabase } = await import('./lib/supabase')
        const client = getSupabase()
        
        // Check if we have a session
        const { data: { session } } = await client.auth.getSession()
        if (session) {
          console.log('[App] Found session, calling refreshSession...')
          
          // Force a refresh by directly calling the Supabase auth API
          const supabaseModule = await import('./lib/supabase')
          await supabaseModule.initSupabase() // Ensure initialized
          
          // Get config from runtime config cache
          const config = supabaseModule.getRuntimeConfig()
          
          if (!config || !config.supabaseUrl || !config.supabasePublishableKey) {
            console.warn('[App] Could not get Supabase config, falling back to refreshSession')
            const { data, error } = await client.auth.refreshSession(session)
            if (error) {
              console.warn('[App] refreshSession failed:', error.message)
              return false
            } else if (data?.session) {
              console.log('[App] ✓ refreshSession succeeded')
              // Update auth store with new session
              const { useAuthStore } = await import('./stores/authStore')
              useAuthStore.getState().setSession(data.session)
              return true
            }
            return false
          }
          
          const refreshToken = session.refresh_token
          
          if (!refreshToken) {
            console.warn('[App] No refresh token found, cannot force refresh')
            return false
          }
          
          console.log('[App] Making direct refresh token request to force network call...')
          
          try {
            // Directly call the Supabase token refresh endpoint
            const response = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': config.supabasePublishableKey,
              },
              body: JSON.stringify({
                refresh_token: refreshToken
              })
            })
            
            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}))
              console.warn('[App] Direct refresh request failed:', response.status, errorData)
              // Fall back to Supabase's refreshSession
              const { data, error } = await client.auth.refreshSession(session)
              if (error) {
                console.warn('[App] Fallback refreshSession also failed:', error.message)
                return false
              } else if (data?.session) {
                console.log('[App] ✓ Fallback refreshSession succeeded')
                const { useAuthStore } = await import('./stores/authStore')
                useAuthStore.getState().setSession(data.session)
                return true
              }
              return false
            } else {
              const refreshData = await response.json()
              console.log('[App] ✓ Direct refresh request succeeded')
              
              // Update the session with the new tokens
              const { data: { session: updatedSession }, error: updateError } = await client.auth.setSession({
                access_token: refreshData.access_token,
                refresh_token: refreshData.refresh_token || refreshToken,
              })
              
              if (updateError) {
                console.warn('[App] Failed to update session after refresh:', updateError.message)
                return false
              } else if (updatedSession) {
                console.log('[App] ✓ Session updated with new tokens')
                // Update auth store with new session
                const { useAuthStore } = await import('./stores/authStore')
                useAuthStore.getState().setSession(updatedSession)
                return true
              }
              return false
            }
          } catch (fetchError) {
            console.error('[App] Error making direct refresh request:', fetchError)
            // Fall back to Supabase's refreshSession
            const { data, error } = await client.auth.refreshSession(session)
            if (error) {
              console.warn('[App] Fallback refreshSession failed:', error.message)
              return false
            } else if (data?.session) {
              console.log('[App] ✓ Fallback refreshSession succeeded')
              const { useAuthStore } = await import('./stores/authStore')
              useAuthStore.getState().setSession(data.session)
              return true
            }
            return false
          }
        } else {
          console.log('[App] No session found, skipping refresh')
          return false
        }
      } catch (err) {
        console.error('[App] Error refreshing session on tab return:', err)
        return false
      }
    }

    const onTabReturn = async () => {
      // Prevent concurrent execution
      if (isHandlingTabReturn) {
        console.log('[App] Tab return already being handled, skipping duplicate call')
        return
      }
      
      isHandlingTabReturn = true
      try {
        const refreshed = await refreshSessionOnTabReturn()
        if (refreshed) {
          console.log('[App] Session refreshed, syncing all stores...')
          // Reset store guards to allow re-fetch
          const { useUsageStore } = await import('./stores/usageStore')
          const { useNotesStore } = await import('./stores/notesStore')
          const { useFolderStore } = await import('./stores/folderStore')
          const { useFlashcardsStore } = await import('./stores/flashcardsStore')
          const { useTestsStore } = await import('./stores/testsStore')
          const { useGoalsStore } = await import('./stores/goalsStore')
          
          // Reset stores to clear guards
          useUsageStore.getState().reset?.()
          // Note: Other stores don't have reset methods yet, but guards will be cleared by sync
          
          // Sync all stores after refresh
          const { syncAllStores } = await import('./stores/authStore')
          await syncAllStores()
        }
      } finally {
        isHandlingTabReturn = false
      }
    }

    // Use AppState for React Native compatibility (works on web too)
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        onTabReturn()
      }
    })

    // Also handle web-specific events as fallback
    // Note: On web, AppState also fires, so we'll get both events
    // The guard in onTabReturn prevents duplicate execution
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleFocus = () => onTabReturn()
      window.addEventListener('focus', handleFocus)
      
      return () => {
        subscription.remove()
        window.removeEventListener('focus', handleFocus)
      }
    }

    return () => {
      subscription.remove()
    }
  }, [])

  // Handle window resize for responsive behavior
  useEffect(() => {
    if (Platform.OS === 'web') {
      const updateDimensions = () => {
        const newWidth = window.innerWidth
        setWindowWidth(newWidth)
        // Close sidebar when switching from mobile to desktop
        if (newWidth > 768 && isSidebarOpen) {
          setIsSidebarOpen(false)
        }
      }
      window.addEventListener('resize', updateDimensions)
      return () => window.removeEventListener('resize', updateDimensions)
    } else {
      // For native platforms, use Dimensions API
      const subscription = Dimensions.addEventListener('change', ({ window }) => {
        setWindowWidth(window.width)
        // Close sidebar when switching from mobile to desktop
        if (window.width > 768 && isSidebarOpen) {
          setIsSidebarOpen(false)
        }
      })
      return () => subscription?.remove()
    }
  }, [isSidebarOpen])

  // Close sidebar when view changes on mobile (but not on initial render)
  const prevViewRef = React.useRef<string | null>(null)
  useEffect(() => {
    if (windowWidth <= 768 && isSidebarOpen && prevViewRef.current !== null && prevViewRef.current !== currentView) {
      setIsSidebarOpen(false)
    }
    prevViewRef.current = currentView
  }, [currentView, windowWidth, isSidebarOpen])

  // Close sidebar on escape key (web only)
  useEffect(() => {
    if (Platform.OS !== 'web') return
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSidebarOpen) {
        setIsSidebarOpen(false)
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isSidebarOpen])

  // Prevent body scroll when sidebar is open on mobile (web only)
  useEffect(() => {
    if (Platform.OS !== 'web') return
    
    if (isSidebarOpen && windowWidth <= 768) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isSidebarOpen, windowWidth])

  const openLoginModal = () => {
    setIsLoginModalOpen(true)
  }

  const closeLoginModal = () => {
    setIsLoginModalOpen(false)
  }

  const openUpgradeModal = () => {
    setIsUpgradeModalOpen(true)
  }

  const closeUpgradeModal = () => {
    setIsUpgradeModalOpen(false)
  }

  const handleNavigate = (view: string) => {
    setCurrentView(view)
    setNavCounter(c => c + 1) // Increment nav counter to trigger view reset
    
    // Update URL to reflect current view (web only)
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const path = view === 'notes' ? '/' : `/${view}`
      window.history.pushState({ view }, '', path)
    }
  }

  // Listen for browser back/forward buttons
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return

    const handlePopState = () => {
      const view = getViewFromUrl()
      setCurrentView(view)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  return (
    <KeyboardProvider>
    <SafeAreaProvider>
    <View style={styles.app}>
      {windowWidth <= 768 && !isInDetailMode && (
        <MobileMenuButton 
          onPress={() => setIsSidebarOpen(!isSidebarOpen)}
          isOpen={isSidebarOpen}
        />
      )}
      {isSidebarOpen && windowWidth <= 768 && (
        <Pressable 
          style={styles.sidebarOverlay}
          onPress={() => setIsSidebarOpen(false)}
          hitSlop={{ top: 50, left: 50, right: 50, bottom: 50 }}
        />
      )}
      <Sidebar 
        onNavigate={handleNavigate}
        onClose={() => setIsSidebarOpen(false)}
        isOpen={isSidebarOpen}
        onOpenUpgradeModal={openUpgradeModal}
        onOpenLoginModal={openLoginModal}
      />
      <View style={styles.mainContent}>
        {currentView === 'notes' && <NotesView onOpenLoginModal={openLoginModal} onOpenUpgradeModal={openUpgradeModal} />}
        {currentView === 'tests' && <TestsView onOpenLoginModal={openLoginModal} />}
        {currentView === 'flashcards' && <FlashcardsView onOpenLoginModal={openLoginModal} />}
        {currentView === 'goals' && <GoalsView key={`goals-view-${navCounter}`} onOpenLoginModal={openLoginModal} onOpenUpgradeModal={openUpgradeModal} />}
        {currentView === 'settings' && <SettingsView onNavigate={handleNavigate} />}
        {currentView === 'privacy' && <PrivacyPolicyView onNavigate={handleNavigate} />}
        {currentView === 'terms' && <TermsOfServiceView onNavigate={handleNavigate} />}
        {currentView !== 'privacy' && currentView !== 'terms' && <ChatBar onOpenLoginModal={openLoginModal} />}
      </View>
      <LoginModal isOpen={isLoginModalOpen} onClose={closeLoginModal} />
      <UpgradeModal isOpen={isUpgradeModalOpen} onClose={closeUpgradeModal} />
    </View>
    </SafeAreaProvider>
    </KeyboardProvider>
  )
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    ...(Platform.OS === 'web' && {
      height: '100vh' as any,
      width: '100vw' as any,
    }),
  } as any,
  sidebarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 998,
    ...(Platform.OS === 'web' && {
      display: 'flex',
    }),
  },
  mainContent: {
    flex: 1,
    paddingLeft: 0,
    ...(Platform.OS === 'web' && {
      paddingLeft: 0,
    }),
  },
})

function App() {
  return (
    <DetailModeProvider>
      <AppContent />
    </DetailModeProvider>
  )
}

export default App
