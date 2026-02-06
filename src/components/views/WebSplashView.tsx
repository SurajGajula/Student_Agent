import { View, Text, StyleSheet, Image, Pressable, Dimensions, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import LoginModal from '../modals/LoginModal'
import { useState } from 'react'
import logoSource from './logoSource'

interface WebSplashViewProps {
  onOpenLoginModal?: () => void
}

function WebSplashView({ onOpenLoginModal }: WebSplashViewProps) {
  const insets = useSafeAreaInsets()
  const windowWidth = Dimensions.get('window').width
  const isMobile = windowWidth <= 768
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)

  const handleOpenLogin = () => {
    setIsLoginModalOpen(true)
    if (onOpenLoginModal) {
      onOpenLoginModal()
    }
  }

  const handleCloseLogin = () => {
    setIsLoginModalOpen(false)
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Header with login button */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.logoContainer}>
            <Image 
              source={logoSource} 
              style={styles.headerLogo}
              resizeMode="contain"
            />
          </View>
          <Pressable 
            style={styles.loginButton}
            onPress={handleOpenLogin}
          >
            <Text style={styles.loginButtonText}>Login</Text>
          </Pressable>
        </View>
      </View>

      {/* Main content */}
      <View style={styles.content}>
        <Text style={[styles.title, isMobile && styles.titleMobile]}>Student Agent</Text>
        <Text style={[styles.subtitle, isMobile && styles.subtitleMobile]}>
          Your AI-powered study companion
        </Text>
        <Text style={[styles.description, isMobile && styles.descriptionMobile]}>
          Organize notes, create flashcards, generate tests, and plan your career path
        </Text>
      </View>

      <LoginModal isOpen={isLoginModalOpen} onClose={handleCloseLogin} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    ...(Platform.OS === 'web' ? { minHeight: '100vh' as any } : {}),
  },
  header: {
    width: '100%',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerContent: {
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoContainer: {
    height: 40,
  },
  headerLogo: {
    width: 40,
    height: 40,
  },
  loginButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#0f0f0f',
    borderRadius: 6,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '400',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
    },
  title: {
    fontSize: 56,
    fontWeight: '300',
    color: '#0f0f0f',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: -1.5,
  },
  titleMobile: {
    fontSize: 40,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 24,
    fontWeight: '300',
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  subtitleMobile: {
    fontSize: 18,
    marginBottom: 20,
  },
  description: {
    fontSize: 18,
    fontWeight: '300',
    color: '#888',
    textAlign: 'center',
    lineHeight: 28,
    maxWidth: 600,
  },
  descriptionMobile: {
    fontSize: 16,
    lineHeight: 24,
  },
})

export default WebSplashView
