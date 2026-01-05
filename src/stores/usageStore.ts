import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { getApiBaseUrl } from '../lib/platform'

interface UsageStore {
  planName: string
  tokensUsed: number
  monthlyLimit: number
  remaining: number
  isLoading: boolean
  error: string | null
  fetchUsage: () => Promise<void>
  refreshUsage: () => Promise<void>
}

export const useUsageStore = create<UsageStore>((set, get) => ({
  planName: 'free',
  tokensUsed: 0,
  monthlyLimit: 100000,
  remaining: 100000,
  isLoading: false,
  error: null,

  fetchUsage: async () => {
    console.log('[usageStore] fetchUsage called, setting isLoading to true')
    set({ isLoading: true, error: null })
    try {
      // Try to get session - if Supabase isn't initialized, it will throw and we'll catch it
      console.log('[usageStore] Getting session from Supabase...')
      let session, sessionError
      
      try {
        // Try using the existing supabase client first (faster)
        const result = await supabase.auth.getSession()
        session = result.data.session
        sessionError = result.error
      } catch (err: any) {
        // If that fails, ensure Supabase is initialized
        console.log('[usageStore] Existing client failed, initializing Supabase...', err.message)
        const { initSupabase, getSupabase } = await import('../lib/supabase')
        await initSupabase()
        const supabaseClient = getSupabase()
        const result = await supabaseClient.auth.getSession()
        session = result.data.session
        sessionError = result.error
      }
      
      console.log('[usageStore] Session check completed', { hasSession: !!session, hasError: !!sessionError })
      
      if (sessionError) {
        console.error('[usageStore] Error getting session:', sessionError)
        set({ isLoading: false, error: 'Session error: ' + sessionError.message })
        return
      }
      
      if (!session) {
        console.warn('[usageStore] ⚠️ fetchUsage: NO SESSION/TOKEN found')
        set({ isLoading: false, error: 'Not authenticated' })
        return
      }
      
      console.log('[usageStore] ✓ fetchUsage: Session found', {
        userId: session.user?.id,
        expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'N/A'
      })

      const API_BASE_URL = getApiBaseUrl()
      console.log('[usageStore] Fetching usage from:', `${API_BASE_URL}/api/usage`)
      
      // Add timeout to prevent hanging
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        controller.abort()
      }, 10000) // 10 second timeout
      
      let response: Response
      try {
        response = await fetch(`${API_BASE_URL}/api/usage`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          },
          signal: controller.signal
        })
        clearTimeout(timeoutId)
      } catch (fetchError: any) {
        clearTimeout(timeoutId)
        if (fetchError.name === 'AbortError') {
          throw new Error('Request timeout - API took too long to respond')
        }
        throw fetchError
      }

      console.log('[usageStore] Usage API response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.message || errorData.error || `HTTP ${response.status} ${response.statusText}`
        console.error('[usageStore] Usage API error:', errorMessage)
        throw new Error(errorMessage)
      }

      const data = await response.json()
      console.log('[usageStore] Usage API response data:', data)
      
      if (data.success) {
        console.log('[usageStore] Setting usage data and marking as not loading')
        set({
          planName: data.planName || 'free',
          tokensUsed: data.tokensUsed || 0,
          monthlyLimit: data.monthlyLimit || 100000,
          remaining: data.remaining || 0,
          isLoading: false,
          error: null
        })
        console.log('[usageStore] Usage data set, isLoading should be false now')
      } else {
        console.error('[usageStore] Usage API returned success: false', data)
        throw new Error(data.error || data.message || 'Failed to fetch usage data')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch usage'
      console.error('[usageStore] fetchUsage caught error:', errorMessage, error)
      set({ isLoading: false, error: errorMessage })
      console.log('[usageStore] Error handled, isLoading set to false')
    }
  },

  refreshUsage: async () => {
    await get().fetchUsage()
  }
}))

