import { createClient } from '@supabase/supabase-js'

import Constants from 'expo-constants'

// Platform-aware environment variable access
const getEnvVar = (key: string): string | undefined => {
  // First, try Expo extra config (app.config.js) - this is the primary source
  if (Constants.expoConfig?.extra) {
    // Map keys from app.config.js
    // SUPABASE_URL -> supabaseUrl
    // SUPABASE_PUBLISHABLE_KEY -> supabaseAnonKey (app.config.js uses this name)
    if (key === 'SUPABASE_URL' || key === 'VITE_SUPABASE_URL') {
      if (Constants.expoConfig.extra.supabaseUrl) {
        return Constants.expoConfig.extra.supabaseUrl
      }
    }
    if (key === 'SUPABASE_PUBLISHABLE_KEY' || key === 'VITE_SUPABASE_PUBLISHABLE_KEY') {
      if (Constants.expoConfig.extra.supabaseAnonKey) {
        return Constants.expoConfig.extra.supabaseAnonKey
      }
    }
    
    // Fallback: try converting key to camelCase
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
  
  return undefined
}

const supabaseUrl = getEnvVar('SUPABASE_URL') || getEnvVar('VITE_SUPABASE_URL')
const supabasePublishableKey = getEnvVar('SUPABASE_PUBLISHABLE_KEY') || getEnvVar('VITE_SUPABASE_PUBLISHABLE_KEY')

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Missing Supabase environment variables. Please set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in frontend.env'
  )
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey)
