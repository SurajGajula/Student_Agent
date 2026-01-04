import { createClient, SupabaseClient } from '@supabase/supabase-js'
import Constants from 'expo-constants'

// Runtime configuration interface
interface AppConfig {
  supabaseUrl: string
  supabasePublishableKey: string
  stripePublishableKey?: string
  apiUrl: string
}

// Cache for runtime config
let runtimeConfig: AppConfig | null = null
let supabaseClient: SupabaseClient | null = null
let configPromise: Promise<AppConfig> | null = null

/**
 * Get API base URL - works in both browser and Node.js
 */
function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    // In browser, use the current origin
    return window.location.origin
  }
  // Fallback for server-side rendering
  return process.env.API_URL || 'http://localhost:3001'
}

/**
 * Fetch configuration from backend API at runtime
 * This avoids build-time environment variable issues
 */
async function fetchRuntimeConfig(): Promise<AppConfig> {
  if (runtimeConfig) {
    return runtimeConfig
  }

  if (configPromise) {
    return configPromise
  }

  configPromise = (async (): Promise<AppConfig> => {
    try {
      const apiUrl = getApiBaseUrl()
      const response = await fetch(`${apiUrl}/api/config`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch config: ${response.status} ${response.statusText}`)
      }

      const config = await response.json()
      
      if (!config.supabaseUrl || !config.supabasePublishableKey) {
        throw new Error('Config missing required Supabase credentials')
      }

      runtimeConfig = config
      return config
    } catch (error) {
      console.error('[supabase.ts] Failed to fetch runtime config:', error)
      
      // Fallback to build-time config if available
      const fallbackUrl = getEnvVar('SUPABASE_URL') || getEnvVar('VITE_SUPABASE_URL')
      const fallbackKey = getEnvVar('SUPABASE_PUBLISHABLE_KEY') || getEnvVar('VITE_SUPABASE_PUBLISHABLE_KEY')
      
      if (fallbackUrl && fallbackKey) {
        console.warn('[supabase.ts] Using fallback build-time config')
        runtimeConfig = {
          supabaseUrl: fallbackUrl,
          supabasePublishableKey: fallbackKey,
          apiUrl: getApiBaseUrl()
        }
        return runtimeConfig
      }
      
      throw error
    }
  })()

  return configPromise
}

/**
 * Legacy function for build-time environment variable access
 * Kept for backward compatibility and fallback
 */
function getEnvVar(key: string): string | undefined {
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

/**
 * Initialize Supabase client with runtime configuration
 * This should be called before using the supabase client
 */
export async function initSupabase(): Promise<SupabaseClient> {
  if (supabaseClient) {
    return supabaseClient
  }

  const config = await fetchRuntimeConfig()
  
  supabaseClient = createClient(config.supabaseUrl, config.supabasePublishableKey)
  
  if (typeof window !== 'undefined') {
    console.log('[supabase.ts] Supabase client initialized with runtime config')
    console.log('[supabase.ts] Supabase URL:', config.supabaseUrl.substring(0, 30) + '...')
  }
  
  return supabaseClient
}

/**
 * Get Supabase client (synchronous access)
 * Note: This will throw if initSupabase() hasn't been called yet
 * For async initialization, use initSupabase() instead
 */
export function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    throw new Error(
      'Supabase client not initialized. Call initSupabase() first, or ensure it has been initialized.'
    )
  }
  return supabaseClient
}

/**
 * Legacy export for backward compatibility
 * This will use the runtime client if available, otherwise fall back to build-time config
 * For new code, use initSupabase() and getSupabase() instead
 */
function getLegacySupabase(): SupabaseClient {
  // First, try to use the runtime client if it's been initialized
  if (supabaseClient) {
    return supabaseClient
  }

  // If runtime config is available, use it
  if (runtimeConfig) {
    supabaseClient = createClient(runtimeConfig.supabaseUrl, runtimeConfig.supabasePublishableKey)
    return supabaseClient
  }

  // Fallback to build-time config
  const supabaseUrl = getEnvVar('SUPABASE_URL') || getEnvVar('VITE_SUPABASE_URL')
  const supabasePublishableKey = getEnvVar('SUPABASE_PUBLISHABLE_KEY') || getEnvVar('VITE_SUPABASE_PUBLISHABLE_KEY')

  if (!supabaseUrl || !supabasePublishableKey) {
    const errorMsg = `Missing Supabase environment variables. 
      SUPABASE_URL: ${supabaseUrl ? 'SET' : 'MISSING'}
      SUPABASE_PUBLISHABLE_KEY: ${supabasePublishableKey ? 'SET' : 'MISSING'}
      Constants.expoConfig?.extra: ${JSON.stringify(Constants.expoConfig?.extra || {})}
      Please set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY as environment variables (or EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_ANON_KEY).
      Alternatively, ensure the backend /api/config endpoint is accessible and initSupabase() has been called.`
    console.error('[supabase.ts]', errorMsg)
    throw new Error(errorMsg)
  }

  supabaseClient = createClient(supabaseUrl, supabasePublishableKey)
  return supabaseClient
}

// Export legacy supabase as a getter for backward compatibility
// This will use runtime config if available, otherwise fall back to build-time config
// New code should use initSupabase() and getSupabase() instead
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getLegacySupabase()
    const value = (client as any)[prop]
    if (typeof value === 'function') {
      return value.bind(client)
    }
    return value
  }
})
