import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import { useAuthStore } from './stores/authStore'

// Handle service worker errors gracefully
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  // Suppress service worker cache errors
  const originalConsoleError = console.error
  console.error = (...args: any[]) => {
    // Filter out service worker cache errors
    const message = args[0]?.toString() || ''
    if (
      message.includes('sw.js') ||
      message.includes('service-worker') ||
      message.includes('Cache.put()') ||
      message.includes('NetworkError') ||
      message.includes('Failed to execute')
    ) {
      // Silently ignore service worker cache errors
      return
    }
    // Log other errors normally
    originalConsoleError.apply(console, args)
  }

  // Also catch unhandled promise rejections from service workers
  window.addEventListener('unhandledrejection', (event) => {
    const message = event.reason?.toString() || ''
    if (
      message.includes('sw.js') ||
      message.includes('service-worker') ||
      message.includes('Cache.put()') ||
      message.includes('NetworkError')
    ) {
      event.preventDefault()
      // Silently ignore service worker errors
      return
    }
  })
}

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
