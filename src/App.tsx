import React, { useState, useEffect } from 'react'
import { View, StyleSheet, Pressable, Dimensions, Platform } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useAuthStore } from './stores/authStore'
import Sidebar from './components/Sidebar'
import MobileMenuButton from './components/MobileMenuButton'
import NotesView from './components/views/NotesView'
import TestsView from './components/views/TestsView'
import FlashcardsView from './components/views/FlashcardsView'
import SettingsView from './components/views/SettingsView'
import ChatBar from './components/ChatBar'
import LoginModal from './components/modals/LoginModal'
import UpgradeModal from './components/modals/UpgradeModal'
import { DetailModeProvider, useDetailMode } from './contexts/DetailModeContext'

// Helper function to get view from URL
const getViewFromUrl = (): string => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const path = window.location.pathname
    if (path === '/settings') return 'settings'
    if (path === '/tests') return 'tests'
    if (path === '/flashcards') return 'flashcards'
    if (path === '/notes' || path === '/') return 'notes'
  }
  return 'notes'
}

function AppContent() {
  const [currentView, setCurrentView] = useState<string>(getViewFromUrl())
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

  // Sync auth state from actual session when tab becomes visible (web only)
  // This prevents phantom logouts by always checking the real Supabase session
  // If session check hangs, reload the page to reset state
  useEffect(() => {
    if (Platform.OS !== 'web') return

    let visibilityTimeout: NodeJS.Timeout | null = null

    const handleVisibilityChange = async () => {
      if (!document.hidden) {
        console.log('[App] Tab/window became visible, syncing auth state...')
        
        // Set a timeout - if session sync takes too long, reload the page
        visibilityTimeout = setTimeout(() => {
          console.warn('[App] ⚠️ Session sync timed out after tab change, reloading page to reset state')
          window.location.reload()
        }, 2000) // 2 second timeout
        
        try {
          const { initSupabase } = await import('./lib/supabase')
          await initSupabase()
          // Sync Zustand state with actual session to prevent phantom logouts
          await useAuthStore.getState().syncFromSession()
          
          // Clear timeout if sync completed successfully
          if (visibilityTimeout) {
            clearTimeout(visibilityTimeout)
            visibilityTimeout = null
          }
          console.log('[App] ✓ Auth state synced successfully after tab change')
        } catch (err) {
          console.error('[App] Error syncing auth on visibility change:', err)
          // Clear timeout and reload on error
          if (visibilityTimeout) {
            clearTimeout(visibilityTimeout)
            visibilityTimeout = null
          }
          console.warn('[App] Reloading page due to auth sync error')
          window.location.reload()
        }
      } else {
        // Tab became hidden, clear any pending timeout
        if (visibilityTimeout) {
          clearTimeout(visibilityTimeout)
          visibilityTimeout = null
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (visibilityTimeout) {
        clearTimeout(visibilityTimeout)
      }
    }
  }, [])

  // Handle window resize for responsive behavior
  useEffect(() => {
    if (Platform.OS === 'web') {
      const updateDimensions = () => {
        setWindowWidth(window.innerWidth)
      }
      window.addEventListener('resize', updateDimensions)
      return () => window.removeEventListener('resize', updateDimensions)
    }
  }, [])

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
    console.log('[App] handleNavigate called with view:', view)
    setCurrentView(view)
    console.log('[App] currentView set to:', view)
    
    // Update URL to reflect current view (web only)
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const path = view === 'notes' ? '/' : `/${view}`
      window.history.pushState({ view }, '', path)
    }
  }

  // Listen for browser back/forward buttons
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return

    const handlePopState = (event: PopStateEvent) => {
      const view = getViewFromUrl()
      console.log('[App] Browser navigation detected, switching to view:', view)
      setCurrentView(view)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  return (
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
        {currentView === 'notes' && <NotesView onOpenLoginModal={openLoginModal} />}
        {currentView === 'tests' && <TestsView />}
        {currentView === 'flashcards' && <FlashcardsView />}
        {currentView === 'settings' && (() => {
          console.log('[App] Rendering SettingsView, currentView:', currentView)
          return <SettingsView />
        })()}
        <ChatBar onOpenLoginModal={openLoginModal} />
      </View>
      <LoginModal isOpen={isLoginModalOpen} onClose={closeLoginModal} />
      <UpgradeModal isOpen={isUpgradeModalOpen} onClose={closeUpgradeModal} />
    </View>
    </SafeAreaProvider>
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
