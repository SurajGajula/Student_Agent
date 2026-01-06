import { createClient, SupabaseClient } from '@supabase/supabase-js'
import Constants from 'expo-constants'
import { getApiBaseUrl as getPlatformApiBaseUrl } from './platform'

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
let initPromise: Promise<SupabaseClient> | null = null // Prevent multiple simultaneous initializations

/**
 * Get API base URL - works in both browser and Node.js
 * Tries multiple sources in order of preference
 */
function getApiBaseUrl(): string {
  // 1. Try window.__API_URL__ (set via script tag in index.html)
  if (typeof window !== 'undefined' && (window as any).__API_URL__) {
    return (window as any).__API_URL__
  }
  
  // 2. Try environment variables (set at build time or runtime)
  const envApiUrl = getPlatformApiBaseUrl()
  if (envApiUrl && envApiUrl !== 'http://localhost:3001') {
    return envApiUrl
  }
  
  // 3. In browser, use window.location.origin for same-origin setups (frontend and backend on same domain)
  if (typeof window !== 'undefined') {
    // If we're on the same domain (production), use relative URLs
    if (window.location.hostname === 'studentagent.site' || 
        window.location.hostname === 'www.studentagent.site') {
      return window.location.origin // Same domain - use relative paths
    }
    // Development - use localhost
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return window.location.origin
    }
    // Fallback for other cases
    return 'https://studentagent.site'
  }
  
  // 5. Fallback for server-side rendering
  return 'http://localhost:3001'
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
    // Try multiple API URLs in order of preference
    const apiUrlsToTry: string[] = []
    
    // 1. Try window.__API_URL__ (injected by build script)
    if (typeof window !== 'undefined' && (window as any).__API_URL__) {
      apiUrlsToTry.push((window as any).__API_URL__)
    }
    
    // 2. For same-domain setups, use window.location.origin FIRST (same domain = no CORS)
    if (typeof window !== 'undefined') {
      // If on the same domain (production), use same origin
      if (window.location.hostname === 'studentagent.site' || 
          window.location.hostname === 'www.studentagent.site') {
        apiUrlsToTry.unshift(window.location.origin) // Add to front of array (highest priority)
      }
      // Development - use localhost origin
      else if (window.location.hostname === 'localhost' || 
               window.location.hostname === '127.0.0.1' ||
               window.location.hostname.startsWith('192.168.')) {
        apiUrlsToTry.push(window.location.origin)
      }
    }
    
    // 3. Try environment variable (if set in Amplify)
    const envApiUrl = getPlatformApiBaseUrl()
    if (envApiUrl && envApiUrl !== 'http://localhost:3001') {
      // Only add if not already in the list
      if (!apiUrlsToTry.includes(envApiUrl)) {
        apiUrlsToTry.push(envApiUrl)
      }
    }
    
    // 4. If we have a cached apiUrl from previous config, try that
    if (runtimeConfig?.apiUrl) {
      if (!apiUrlsToTry.includes(runtimeConfig.apiUrl)) {
        apiUrlsToTry.unshift(runtimeConfig.apiUrl)
      }
    }
    
    // 5. Ensure we have at least one URL to try (fallback)
    if (apiUrlsToTry.length === 0) {
      // Fallback: use the local getApiBaseUrl function
      const fallbackUrl = getApiBaseUrl()
      if (fallbackUrl && !apiUrlsToTry.includes(fallbackUrl)) {
        apiUrlsToTry.push(fallbackUrl)
      }
    }
    
    console.log(`[supabase.ts] Will try ${apiUrlsToTry.length} API URLs:`, apiUrlsToTry)
    
    let lastError: Error | null = null
    
    for (const apiUrl of apiUrlsToTry) {
      try {
        console.log(`[supabase.ts] Trying to fetch config from: ${apiUrl}/api/config`)
        
        // Note: If you get "Mixed Content" errors, it's because HTTPS pages (Amplify) 
        // cannot access HTTP backends. You'll need to set up HTTPS on EC2.
        const response = await fetch(`${apiUrl}/api/config`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          // Use 'omit' to avoid sending credentials in cross-origin requests
          credentials: 'omit',
        })
        
        if (!response.ok) {
          throw new Error(`Failed to fetch config: ${response.status} ${response.statusText}`)
        }

        const config = await response.json()
        
        if (!config.supabaseUrl || !config.supabasePublishableKey) {
          throw new Error('Config missing required Supabase credentials')
        }

        // Use the apiUrl from the config response if provided, otherwise use the one we tried
        runtimeConfig = {
          ...config,
          apiUrl: config.apiUrl || apiUrl
        }
        console.log(`[supabase.ts] Successfully fetched config from: ${apiUrl}`)
        console.log(`[supabase.ts] Config apiUrl: ${runtimeConfig.apiUrl}`)
        return runtimeConfig
      } catch (error) {
        const errorDetails = error instanceof Error ? error.message : String(error)
        console.error(`[supabase.ts] Failed to fetch from ${apiUrl}:`, errorDetails)
        if (error instanceof TypeError && error.message.includes('fetch')) {
          console.error(`[supabase.ts] Network error - check CORS, SSL, or network connectivity`)
        }
        lastError = error as Error
        // Continue to next URL
        continue
      }
    }
    
    // If all URLs failed, try fallback to build-time config
    console.error('[supabase.ts] Failed to fetch runtime config from all URLs:', lastError)
    
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
    
    throw lastError || new Error('Failed to fetch config from all available URLs')
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
  // Return existing client if already initialized
  if (supabaseClient) {
    return supabaseClient
  }

  // If initialization is in progress, wait for it
  if (initPromise) {
    return initPromise
  }

  // Start initialization
  initPromise = (async () => {
  const config = await fetchRuntimeConfig()
  
    // For web, explicitly use localStorage for cross-tab synchronization
    // For mobile/native, use default storage (AsyncStorage)
    const storage = typeof window !== 'undefined' && window.localStorage 
      ? window.localStorage 
      : undefined
    
    // Check BroadcastChannel availability for cross-tab sync
    if (typeof window !== 'undefined') {
      if ('BroadcastChannel' in window) {
        console.log('[supabase.ts] ✓ BroadcastChannel available for cross-tab synchronization')
      } else {
        console.warn('[supabase.ts] ⚠ BroadcastChannel NOT available - cross-tab sync may not work')
      }
    }
    
    supabaseClient = createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: {
        storage: storage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      }
    })
  
  if (typeof window !== 'undefined') {
    console.log('[supabase.ts] Supabase client initialized with runtime config')
    console.log('[supabase.ts] Supabase URL:', config.supabaseUrl.substring(0, 30) + '...')
      console.log('[supabase.ts] Using localStorage for session persistence:', !!storage)
  }
  
  return supabaseClient
  })()

  return initPromise
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
 * Get a fresh session, refreshing if necessary
 * This ensures the session token is valid before making API calls
 */
export async function getFreshSession() {
  await initSupabase()
  const client = getSupabase()
  
  // Get current session
  const { data: { session }, error } = await client.auth.getSession()
  
  if (error) {
    console.error('[supabase.ts] Error getting session:', error)
    throw new Error(`Failed to get session: ${error.message}`)
  }
  
  if (!session) {
    console.warn('[supabase.ts] No active session found')
    throw new Error('No active session')
  }
  
  // Check if session is expired or about to expire (within 5 minutes)
  const expiresAt = session.expires_at
  if (expiresAt) {
    const expiresIn = expiresAt - Math.floor(Date.now() / 1000)
    if (expiresIn < 300) { // Less than 5 minutes
      console.log('[supabase.ts] Session expiring soon, refreshing...', { expiresIn })
      // Try to refresh the session
      const { data: { session: refreshedSession }, error: refreshError } = await client.auth.refreshSession()
      if (refreshError || !refreshedSession) {
        console.error('[supabase.ts] Failed to refresh session:', refreshError)
        throw new Error('Session expired and could not be refreshed')
      }
      console.log('[supabase.ts] Session refreshed successfully')
      return refreshedSession
    }
  }
  
  return session
}

/**
 * Ensure a valid session exists before making API calls
 * This is a wrapper that checks and refreshes the session if needed
 */
export async function ensureValidSession() {
  try {
    const session = await getFreshSession()
    return session
  } catch (error) {
    console.error('[supabase.ts] ensureValidSession failed:', error)
    throw error
  }
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

  // If initialization is in progress, wait for it (synchronously we can't await, so use build-time config)
  if (initPromise || configPromise) {
    // Don't create a new client - wait for initSupabase to complete
    // Use build-time config as temporary fallback only if absolutely necessary
    const supabaseUrl = getEnvVar('SUPABASE_URL') || getEnvVar('VITE_SUPABASE_URL')
    const supabasePublishableKey = getEnvVar('SUPABASE_PUBLISHABLE_KEY') || getEnvVar('VITE_SUPABASE_PUBLISHABLE_KEY')
    
    if (supabaseUrl && supabasePublishableKey && !supabaseClient) {
      console.warn('[supabase.ts] Creating temporary client with build-time config (init in progress)')
      const storage = typeof window !== 'undefined' && window.localStorage ? window.localStorage : undefined
      supabaseClient = createClient(supabaseUrl, supabasePublishableKey, {
        auth: {
          storage: storage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        }
      })
      return supabaseClient
    }
  }

  // If runtime config is available, use it
  if (runtimeConfig && !supabaseClient) {
    console.warn('[supabase.ts] Creating client from runtime config (init not called yet)')
    const storage = typeof window !== 'undefined' && window.localStorage ? window.localStorage : undefined
    supabaseClient = createClient(runtimeConfig.supabaseUrl, runtimeConfig.supabasePublishableKey, {
      auth: {
        storage: storage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      }
    })
    return supabaseClient
  }

  // If we still don't have a client, try build-time config one more time
  if (!supabaseClient) {
    const buildTimeUrl = getEnvVar('SUPABASE_URL') || getEnvVar('VITE_SUPABASE_URL')
    const buildTimeKey = getEnvVar('SUPABASE_PUBLISHABLE_KEY') || getEnvVar('VITE_SUPABASE_PUBLISHABLE_KEY')

    if (buildTimeUrl && buildTimeKey) {
      console.warn('[supabase.ts] Creating client from build-time config (fallback)')
      const storage = typeof window !== 'undefined' && window.localStorage ? window.localStorage : undefined
      supabaseClient = createClient(buildTimeUrl, buildTimeKey, {
        auth: {
          storage: storage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        }
      })
    return supabaseClient
  }

    // No config available - this should not happen if initSupabase() was called
    throw new Error(
      'Supabase client not initialized. Please ensure initSupabase() has been called and completed.'
    )
  }
  
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
