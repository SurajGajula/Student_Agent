import { Platform } from 'react-native'
import WebSplashView from './WebSplashView'
import NativeSplashView from './NativeSplashView'

interface HomeViewProps {
  onCloseLoginModal?: () => void
  onOpenLoginModal?: () => void
}

function HomeView({ onCloseLoginModal, onOpenLoginModal }: HomeViewProps) {
  // Render platform-specific splash screens
  if (Platform.OS === 'web') {
    return <WebSplashView onOpenLoginModal={onOpenLoginModal} />
  }
  
  return <NativeSplashView onCloseLoginModal={onCloseLoginModal} />
}

export default HomeView
