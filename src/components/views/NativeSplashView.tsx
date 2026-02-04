import { View, Text, StyleSheet, Image, Dimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import LoginModal from '../modals/LoginModal'
import logoSource from './logoSource'

interface NativeSplashViewProps {
  onCloseLoginModal?: () => void
}

function NativeSplashView({ onCloseLoginModal }: NativeSplashViewProps) {
  const insets = useSafeAreaInsets()
  const windowWidth = Dimensions.get('window').width
  const isMobile = windowWidth <= 768

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.content}>
        <Image 
          source={logoSource} 
          style={[styles.logo, isMobile && styles.logoMobile]}
          resizeMode="contain"
        />
        <Text style={[styles.title, isMobile && styles.titleMobile]}>Student Agent</Text>
        <Text style={[styles.subtitle, isMobile && styles.subtitleMobile]}>
          Your AI-powered study companion
        </Text>
        <Text style={[styles.description, isMobile && styles.descriptionMobile]}>
          Organize notes, create flashcards, generate tests, and plan your career path
        </Text>
      </View>
      <LoginModal isOpen={true} onClose={onCloseLoginModal || (() => {})} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  content: {
    alignItems: 'center',
    marginBottom: 60,
    maxWidth: 600,
    width: '100%',
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 24,
  },
  logoMobile: {
    width: 80,
    height: 80,
    marginBottom: 20,
  },
  title: {
    fontSize: 42,
    fontWeight: '300',
    color: '#0f0f0f',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -1,
  },
  titleMobile: {
    fontSize: 32,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '300',
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitleMobile: {
    fontSize: 16,
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    fontWeight: '300',
    color: '#888',
    textAlign: 'center',
    lineHeight: 24,
  },
  descriptionMobile: {
    fontSize: 14,
    lineHeight: 20,
  },
})

export default NativeSplashView
