import { createClient, SupabaseClient, Session, AuthError } from '@supabase/supabase-js'
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
let authStateChangeSubscription: { unsubscribe: () => void } | null = null // Track auth state change subscription

/**
 * Get the current runtime config (if available)
 * This is useful for accessing Supabase URL and keys
 */
export function getRuntimeConfig(): AppConfig | null {
  return runtimeConfig
}

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
  if (typeof window !== 'undefined' && window.location) {
    // If we're on the same domain (production), use relative URLs
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
    // Fallback for other cases
    return 'https://studentagent.site'
  }
  
  // 5. Fallback for server-side rendering
  return 'http://localhost:3001'
}

/**
 * Reset the cached runtime config and Supabase client to force a fresh fetch
 * Useful when returning from a different window/tab
 */
export function resetRuntimeConfig(): void {
  runtimeConfig = null
  configPromise = null
  supabaseClient = null
  initPromise = null
}

/**
 * Fetch configuration from backend API at runtime
 * This avoids build-time environment variable issues
 * @param force - If true, force a fresh fetch even if config is cached
 */
async function fetchRuntimeConfig(force: boolean = false): Promise<AppConfig> {
  // If forcing, clear cached config and promise to ensure fresh fetch
  if (force) {
    runtimeConfig = null
    configPromise = null
  }
  
  if (runtimeConfig && !force) {
    return runtimeConfig
  }

  if (configPromise && !force) {
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
    if (typeof window !== 'undefined' && window.location) {
      // If on the same domain (production), use same origin
      if (window.location.hostname === 'studentagent.site' || 
          window.location.hostname === 'www.studentagent.site') {
        apiUrlsToTry.unshift(window.location.origin) // Add to front of array (highest priority)
      }
      // Development - check if we're on a frontend dev server port
      else if (window.location.hostname === 'localhost' || 
               window.location.hostname === '127.0.0.1' ||
               window.location.hostname.startsWith('192.168.')) {
        // Frontend dev server ports (Expo Metro, Vite, etc.)
        const frontendDevPorts = [8081, 5173, 19006, 3000]
        const currentPort = parseInt(window.location.port) || 80
        
        // If we're on a frontend dev server port, use backend API port (3001) instead
        if (frontendDevPorts.includes(currentPort)) {
          const backendUrl = `${window.location.protocol}//${window.location.hostname}:3001`
          if (!apiUrlsToTry.includes(backendUrl)) {
            apiUrlsToTry.unshift(backendUrl) // Prioritize backend API URL
          }
        } else {
          // Not a known frontend dev port, might be backend itself or custom setup
          apiUrlsToTry.push(window.location.origin)
        }
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
    // On native platforms (iOS/Android), window.location doesn't exist, so we need to ensure we have a URL
    if (apiUrlsToTry.length === 0) {
      // Fallback: use the local getApiBaseUrl function
      const fallbackUrl = getApiBaseUrl()
      if (fallbackUrl && !apiUrlsToTry.includes(fallbackUrl)) {
        apiUrlsToTry.push(fallbackUrl)
      }
      // If still empty (e.g., on native where getApiBaseUrl returns localhost), try environment variable directly
      if (apiUrlsToTry.length === 0) {
        const envUrl = getEnvVar('API_URL') || getEnvVar('VITE_API_URL') || getEnvVar('EXPO_PUBLIC_API_URL')
        if (envUrl) {
          apiUrlsToTry.push(envUrl)
        } else {
          // Last resort: use default localhost (for development)
          apiUrlsToTry.push('http://localhost:3001')
        }
      }
    }
    
    // 6. In dev mode, always ensure localhost:3001 is in the list (backend API)
    if (typeof window !== 'undefined' && window.location && 
        (window.location.hostname === 'localhost' || 
         window.location.hostname === '127.0.0.1' ||
         window.location.hostname.startsWith('192.168.'))) {
      const backendDevUrl = `http://${window.location.hostname}:3001`
      if (!apiUrlsToTry.includes(backendDevUrl)) {
        apiUrlsToTry.push(backendDevUrl) // Add backend URL as fallback
      }
    }
    
    // Check for build-time config first (in dev mode, backend might not be running)
    const fallbackUrl = getEnvVar('SUPABASE_URL') || getEnvVar('VITE_SUPABASE_URL')
    const fallbackKey = getEnvVar('SUPABASE_PUBLISHABLE_KEY') || getEnvVar('VITE_SUPABASE_PUBLISHABLE_KEY')
    
    // In dev mode, if backend isn't available, use build-time config immediately
    const isDevMode = typeof window !== 'undefined' && window.location && 
      (window.location.hostname === 'localhost' || 
       window.location.hostname === '127.0.0.1' ||
       window.location.hostname.startsWith('192.168.'))
    
    let lastError: Error | null = null
    let connectionRefused = false
    
    for (const apiUrl of apiUrlsToTry) {
      try {
        // Add timeout to fetch (5 seconds)
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)
        
        try {
          // Log when we're making the API call (especially useful when force=true)
          if (force) {
            console.log(`[supabase.ts] Force fetching config from: ${apiUrl}/api/config`)
          }
          
          // Note: If you get "Mixed Content" errors, it's because HTTPS pages (Amplify) 
          // cannot access HTTP backends. You'll need to set up HTTPS on EC2.
          const response = await fetch(`${apiUrl}/api/config`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
            // Use 'omit' to avoid sending credentials in cross-origin requests
            credentials: 'omit',
            signal: controller.signal,
          })
          
          clearTimeout(timeoutId)
          
          if (!response.ok) {
            throw new Error(`Failed to fetch config: ${response.status} ${response.statusText}`)
          }

          // Check if response is actually JSON (not HTML error page)
          const contentType = response.headers.get('content-type') || ''
          const text = await response.text()
          
          // Detect HTML responses (common when hitting wrong endpoint or dev server)
          if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
            throw new Error(`Received HTML instead of JSON (likely wrong endpoint or dev server)`)
          }
          
          // Try to parse as JSON
          let config
          try {
            config = JSON.parse(text)
          } catch (parseError) {
            throw new Error(`Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : String(parseError)}`)
          }
          
          if (!config.supabaseUrl || !config.supabasePublishableKey) {
            throw new Error('Config missing required Supabase credentials')
          }

          // Use the apiUrl from the config response if provided, otherwise use the one we tried
          runtimeConfig = {
            ...config,
            apiUrl: config.apiUrl || apiUrl
          }
          return runtimeConfig
        } catch (fetchError) {
          clearTimeout(timeoutId)
          throw fetchError
        }
      } catch (error) {
        const errorDetails = error instanceof Error ? error.message : String(error)
        
        // Detect connection refused or network errors
        const isConnectionError = 
          error instanceof TypeError && 
          (error.message.includes('fetch') || 
           error.message.includes('Failed to fetch') ||
           error.message.includes('ERR_CONNECTION_REFUSED') ||
           error.message.includes('network') ||
           error.name === 'AbortError')
        
        if (isConnectionError) {
          connectionRefused = true
          if (isDevMode) {
            console.warn(`[supabase.ts] Backend not available at ${apiUrl} (connection refused). This is normal if the backend server isn't running.`)
          } else {
            console.error(`[supabase.ts] Network error connecting to ${apiUrl}:`, errorDetails)
          }
        } else {
          console.error(`[supabase.ts] Failed to fetch from ${apiUrl}:`, errorDetails)
        }
        
        lastError = error as Error
        
        // In dev mode, if connection is refused, try build-time config immediately
        if (isDevMode && connectionRefused && fallbackUrl && fallbackKey) {
          console.warn('[supabase.ts] Backend unavailable in dev mode, using build-time config')
          runtimeConfig = {
            supabaseUrl: fallbackUrl,
            supabasePublishableKey: fallbackKey,
            apiUrl: getApiBaseUrl()
          }
          return runtimeConfig
        }
        
        // Continue to next URL
        continue
      }
    }
    
    // If all URLs failed, try fallback to build-time config
    if (fallbackUrl && fallbackKey) {
      console.warn('[supabase.ts] Failed to fetch runtime config, using fallback build-time config')
      runtimeConfig = {
        supabaseUrl: fallbackUrl,
        supabasePublishableKey: fallbackKey,
        apiUrl: getApiBaseUrl()
      }
      return runtimeConfig
    }
    
    // Only throw if we have no fallback config
    const errorMessage = isDevMode && connectionRefused
      ? 'Backend server not running. Please start the backend server on port 3001, or ensure build-time environment variables are set.'
      : 'Failed to fetch config from all available URLs and no build-time config available'
    
    throw lastError || new Error(errorMessage)
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
 * @param force - If true, force re-initialization even if client already exists
 * @param refreshConfig - If true, refresh the config but reuse existing client if config hasn't changed
 */
export async function initSupabase(force: boolean = false, refreshConfig: boolean = false): Promise<SupabaseClient> {
  // If we have an existing client and we're just refreshing config (not forcing full re-init)
  if (supabaseClient && !force && refreshConfig) {
    // Fetch fresh config to check if it changed
    const oldConfig = runtimeConfig
    const newConfig = await fetchRuntimeConfig(true) // Force fetch
    
    // Only create new client if config actually changed
    if (oldConfig && (
      oldConfig.supabaseUrl !== newConfig.supabaseUrl ||
      oldConfig.supabasePublishableKey !== newConfig.supabasePublishableKey
    )) {
      console.log('[supabase.ts] Config changed, will create new client')
      // Config changed, need to force re-initialization
      force = true
    } else {
      // Config unchanged, just return existing client
      return supabaseClient
    }
  }
  
  // Return existing client if already initialized (unless forcing)
  if (supabaseClient && !force) {
    return supabaseClient
  }

  // If initialization is in progress and not forcing, wait for it
  if (initPromise && !force) {
    return initPromise
  }
  
  // If forcing, clear the old client and promise before creating a new one
  if (force) {
    // Clear the old client reference to prevent multiple instances
    const oldClient = supabaseClient
    supabaseClient = null
    initPromise = null
    
    // Clean up any existing auth state change subscriptions
    if (authStateChangeSubscription) {
      try {
        authStateChangeSubscription.unsubscribe()
      } catch (e) {
        // Ignore errors during cleanup
      }
      authStateChangeSubscription = null
    }
    
    // If there's an old client, log that we're cleaning it up
    if (oldClient && typeof window !== 'undefined') {
      console.log('[supabase.ts] Clearing old Supabase client before re-initialization to prevent multiple instances')
    }
  }

  // Start initialization
  initPromise = (async () => {
  const config = await fetchRuntimeConfig(force || refreshConfig)
  
    // For web, explicitly use localStorage for cross-tab synchronization
    // For mobile/native, use default storage (AsyncStorage)
    const storage = typeof window !== 'undefined' && window.localStorage 
      ? window.localStorage 
      : undefined
    
    // Check BroadcastChannel availability for cross-tab sync
    if (typeof window !== 'undefined' && !('BroadcastChannel' in window)) {
      console.warn('[supabase.ts] ⚠ BroadcastChannel NOT available - cross-tab sync may not work')
    }
    
    // Only create a new client if we don't already have one (unless forcing)
    if (!supabaseClient || force) {
      supabaseClient = createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: {
        storage: storage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        // Ensure session persists across app restarts and page reloads
        // This is the key setting for "remember me" functionality
        storageKey: 'supabase.auth.token',
      }
    })
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
 * Get session, ensuring Supabase is initialized first
 * Use this instead of supabase.auth.getSession() directly to avoid race conditions
 */
export async function getSession(): Promise<{ data: { session: Session | null }, error: AuthError | null }> {
  await initSupabase()
  const client = getSupabase()
  return await client.auth.getSession()
}

/**
 * Get a valid session, refreshing if needed
 * This ensures the session token is valid before making API calls
 * Use this in stores before making API requests
 */
export async function getValidSession(): Promise<Session | null> {
  await initSupabase()
  const client = getSupabase()
  
  // Get current session
  const { data: { session }, error } = await client.auth.getSession()
  
  if (error || !session) {
    return null
  }
  
  // Force refresh by passing the current session
  // This ensures a network request is made even if Supabase thinks the token is still valid
  // This is important after switching tabs/windows when the token might be stale
  try {
    const { data: { session: refreshedSession }, error: refreshError } = await client.auth.refreshSession(session)
    if (refreshError) {
      // If refresh fails, return the existing session (it might still be valid)
      return session
    }
    return refreshedSession || session
  } catch (refreshError) {
    // If refresh fails, return the existing session (it might still be valid)
    return session
  }
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

  // IMPORTANT: Don't create fallback clients here - this causes multiple instances
  // Instead, throw an error and let the caller handle initialization properly
  // The proxy will handle initialization before calling methods
  
  // If initialization is in progress, we should wait for it
  // But since this is synchronous, we can't await - so we throw an error
  if (initPromise || configPromise) {
    throw new Error(
      'Supabase client initialization in progress. Please wait for initSupabase() to complete, or use the async supabase proxy methods.'
    )
  }

  // No client available and no initialization in progress
  throw new Error(
    'Supabase client not initialized. Please ensure initSupabase() has been called and completed.'
  )
}

// Export legacy supabase as a getter for backward compatibility
// This will use runtime config if available, otherwise fall back to build-time config
// New code should use initSupabase() and getSupabase() instead
// The proxy ensures Supabase is initialized before accessing auth methods
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    // If accessing auth, create a proxy that ensures initialization before method calls
    if (prop === 'auth') {
      // Return a proxy that ensures initialization before calling auth methods
      return new Proxy({} as any, {
        get(_authTarget, authProp) {
          // Special handling for synchronous methods that return subscriptions
          // These are typically called during initialization when client already exists
          const syncMethods = ['onAuthStateChange', 'onTokenRefresh']
          
          // Try to get the auth object from existing client first
          try {
            const client = getLegacySupabase()
            const auth = (client as any).auth
            const methodOrValue = (auth as any)[authProp]
            
            // If it exists and is a function, handle it based on type
            if (typeof methodOrValue === 'function') {
              // For synchronous methods like onAuthStateChange, return directly (client already exists)
              if (syncMethods.includes(authProp as string)) {
                return methodOrValue.bind(auth)
              }
              
              // For async methods like getSession, wrap to ensure initialization
              return async function(...args: any[]) {
                // Ensure Supabase is initialized (might already be, but ensure it's done)
                await initSupabase()
                const initializedClient = getSupabase()
                const initializedAuth = (initializedClient as any).auth
                const method = (initializedAuth as any)[authProp]
                return method.apply(initializedAuth, args)
              }
            }
            
            // For non-function properties, return them directly
            return methodOrValue
          } catch {
            // If client doesn't exist yet, handle based on method type
            if (syncMethods.includes(authProp as string)) {
              // For synchronous methods, client must exist (shouldn't happen in practice)
              // Return a function that throws if client doesn't exist
              return function(...args: any[]) {
                try {
                  const client = getLegacySupabase()
                  const auth = (client as any).auth
                  const method = (auth as any)[authProp]
                  return method.apply(auth, args)
                } catch {
                  throw new Error(`Cannot call ${String(authProp)} before Supabase is initialized. Call initSupabase() first.`)
                }
              }
            }
            
            // For async methods, create a function that initializes first
            return async function(...args: any[]) {
              await initSupabase()
              const client = getSupabase()
              const auth = (client as any).auth
              const methodOrValue = (auth as any)[authProp]
              
              if (typeof methodOrValue === 'function') {
                return methodOrValue.apply(auth, args)
              }
              
              return methodOrValue
            }
          }
        }
      })
    }
    
    // For non-auth properties, try to get from existing client
    try {
      const client = getLegacySupabase()
      const value = (client as any)[prop]
      if (typeof value === 'function') {
        return value.bind(client)
      }
      return value
    } catch (error) {
      // If client doesn't exist yet, throw a helpful error
      if (typeof prop === 'string' && prop !== 'auth') {
        throw new Error(`Cannot access '${prop}' before Supabase is initialized. Call initSupabase() first.`)
      }
      throw error
    }
  }
})
