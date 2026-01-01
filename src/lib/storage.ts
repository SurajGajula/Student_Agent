import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Platform-aware storage adapter for Zustand persist
// Uses AsyncStorage on native, localStorage on web
export const getStorage = () => {
  if (Platform.OS === 'web') {
    // Web: use localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage
    }
    // Fallback: return a no-op storage if localStorage is not available
    return {
      getItem: async () => null,
      setItem: async () => {},
      removeItem: async () => {},
    }
  } else {
    // Native: use AsyncStorage
    return AsyncStorage
  }
}

