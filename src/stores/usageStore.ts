import { create } from 'zustand'
import { Platform } from 'react-native'
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
    set({ isLoading: true, error: null })
    
    // Set a timeout - if this takes too long, reload the page
    const globalTimeout = setTimeout(() => {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.reload()
      }
    }, 1000) // 2.5 second timeout
    
    try {
      let session, sessionError
      
      try {
        const result = await supabase.auth.getSession()
        session = result.data.session
        sessionError = result.error
      } catch (err: any) {
        const { initSupabase, getSupabase } = await import('../lib/supabase')
        await initSupabase()
        const supabaseClient = getSupabase()
        const result = await supabaseClient.auth.getSession()
        session = result.data.session
        sessionError = result.error
      }
      
      if (sessionError) {
        clearTimeout(globalTimeout)
        set({ isLoading: false, error: 'Session error: ' + sessionError.message })
        return
      }
      
      if (!session) {
        clearTimeout(globalTimeout)
        set({ isLoading: false, error: 'Not authenticated' })
        return
      }

      const API_BASE_URL = getApiBaseUrl()
      const response = await fetch(`${API_BASE_URL}/api/usage`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        clearTimeout(globalTimeout)
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.message || errorData.error || `HTTP ${response.status} ${response.statusText}`
        throw new Error(errorMessage)
      }

      const data = await response.json()
      
      if (data.success) {
        clearTimeout(globalTimeout)
        set({
          planName: data.planName || 'free',
          tokensUsed: data.tokensUsed || 0,
          monthlyLimit: data.monthlyLimit || 100000,
          remaining: data.remaining || 0,
          isLoading: false,
          error: null
        })
      } else {
        clearTimeout(globalTimeout)
        throw new Error(data.error || data.message || 'Failed to fetch usage data')
      }
    } catch (error) {
      clearTimeout(globalTimeout)
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch usage'
      set({ isLoading: false, error: errorMessage })
    }
  },

  refreshUsage: async () => {
    await get().fetchUsage()
  }
}))

