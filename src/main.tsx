import React from 'react'
import ReactDOM from 'react-dom/client'
import { AppRegistry } from 'react-native-web'
import App from './App'
import './styles.css'
import { useAuthStore } from './stores/authStore'

// Initialize auth before rendering app
const initializeApp = async () => {
  await useAuthStore.getState().initializeAuth()
  
  // For React Native Web, we can use either ReactDOM or AppRegistry
  // Using ReactDOM for now to maintain compatibility
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

initializeApp()
