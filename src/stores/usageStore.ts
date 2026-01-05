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
    set({ isLoading: true, error: null })
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
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
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.message || errorData.error || `HTTP ${response.status} ${response.statusText}`
        throw new Error(errorMessage)
      }

      const data = await response.json()
      
      if (data.success) {
        set({
          planName: data.planName || 'free',
          tokensUsed: data.tokensUsed || 0,
          monthlyLimit: data.monthlyLimit || 100000,
          remaining: data.remaining || 0,
          isLoading: false,
          error: null
        })
      } else {
        throw new Error(data.error || data.message || 'Failed to fetch usage data')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch usage'
      set({ isLoading: false, error: errorMessage })
    }
  },

  refreshUsage: async () => {
    await get().fetchUsage()
  }
}))

