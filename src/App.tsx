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

function AppContent() {
  const [currentView, setCurrentView] = useState<string>('notes')
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [windowWidth, setWindowWidth] = useState(Dimensions.get('window').width)
  const { isInDetailMode } = useDetailMode()

  // Initialize auth on all platforms
  useEffect(() => {
    useAuthStore.getState().initializeAuth().catch(err => {
      console.error('Auth initialization error:', err)
    })
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
    setCurrentView(view)
  }

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
        {currentView === 'settings' && <SettingsView />}
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
