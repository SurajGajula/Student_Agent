import { Platform as RNPlatform } from 'react-native'
import Constants from 'expo-constants'

// Platform detection utilities
export const Platform = {
  OS: RNPlatform.OS,
  isWeb: RNPlatform.OS === 'web',
  isIOS: RNPlatform.OS === 'ios',
  isAndroid: RNPlatform.OS === 'android',
  select: RNPlatform.select,
}

// Environment variable access that works on both web and native (Expo)
export const getEnvVar = (key: string): string | undefined => {
  // First, try Expo extra config (app.config.js) - this is the primary source
  if (Constants.expoConfig?.extra) {
    // Remove any prefix and convert to camelCase to match app.config.js keys
    const extraKey = key.replace(/^VITE_|^EXPO_PUBLIC_/, '').toLowerCase()
    const extraKeyCamel = extraKey.replace(/_([a-z])/g, (g) => g[1].toUpperCase())
    if (Constants.expoConfig.extra[extraKeyCamel]) {
      return Constants.expoConfig.extra[extraKeyCamel]
    }
  }
  
  // Then try process.env without any prefix first
  if (typeof process !== 'undefined' && process.env) {
    // Try direct key (no prefix) first
    const keyWithoutPrefix = key.replace(/^VITE_|^EXPO_PUBLIC_/, '')
    if (process.env[keyWithoutPrefix]) {
      return process.env[keyWithoutPrefix]
    }
    // Fallback to original key (might have prefix)
    if (process.env[key]) {
      return process.env[key]
    }
    // Last resort: try with EXPO_PUBLIC_ prefix
    const expoKey = key.replace(/^VITE_/, 'EXPO_PUBLIC_')
    if (process.env[expoKey] && key.startsWith('VITE_')) {
      return process.env[expoKey]
    }
  }
  
  // Note: import.meta.env is not supported in Metro bundler
  // We rely on Expo Constants and process.env instead
  
  return undefined
}

// API URL getter
export const getApiBaseUrl = (): string => {
  // Try environment variables first
  const envApiUrl = getEnvVar('API_URL') || 
                    getEnvVar('VITE_API_URL') || 
                    getEnvVar('EXPO_PUBLIC_API_URL')
  
  if (envApiUrl && envApiUrl !== 'http://localhost:3001') {
    return envApiUrl
  }
  
  // In browser, use window.location.origin for same-origin setups
  if (typeof window !== 'undefined' && window.location) {
    // If on the same domain (production), use same origin
    if (window.location.hostname === 'studentagent.site' || 
        window.location.hostname === 'www.studentagent.site') {
      return window.location.origin // Same domain - use relative paths
    }
    // Development - check if we're on a frontend dev server port
    if (window.location.hostname === 'localhost' || 
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.startsWith('192.168.')) {
      // Frontend dev server ports (Expo Metro, Vite, etc.)
      const frontendDevPorts = [8081, 5173, 19006, 3000]
      const currentPort = parseInt(window.location.port) || 80
      
      // If we're on a frontend dev server port, use backend API port (3001) instead
      if (frontendDevPorts.includes(currentPort)) {
        return `http://${window.location.hostname}:3001`
      }
      // Not a known frontend dev port, might be backend itself or custom setup
      return window.location.origin
    }
  }
  
  // Fallback: Use production URL for native builds, localhost for development
  // Native builds (iOS/Android) should use production URL by default
  // Web development can use localhost
  const isNative = Platform.isIOS || Platform.isAndroid;
  return isNative ? 'https://studentagent.site' : 'http://localhost:3001';
}

