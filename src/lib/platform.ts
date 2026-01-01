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
  return getEnvVar('API_URL') || 
         getEnvVar('VITE_API_URL') || 
         getEnvVar('EXPO_PUBLIC_API_URL') || 
         'http://localhost:3001'
}

