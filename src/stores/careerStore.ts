import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { supabase } from '../lib/supabase'
import { getApiBaseUrl } from '../lib/platform'
import { getStorage } from '../lib/storage'

export interface SkillNode {
  skill_id: string
  name: string
}

export interface CareerPath {
  id: string
  targetId: string
  graphId: string
  role: string
  company: string
  seniority: string
  major: string | null
  nodes: SkillNode[]
  createdAt?: string
  updatedAt?: string
}

interface CareerStore {
  careerPaths: CareerPath[]
  isLoading: boolean
  error: string | null
  syncFromSupabase: () => Promise<void>
  addCareerPath: (targetId: string, graphId: string, role: string, company: string, seniority: string, major: string | null, nodes: SkillNode[]) => Promise<void>
  removeCareerPath: (id: string) => Promise<void>
  getCareerPathById: (id: string) => CareerPath | undefined
}

export const useCareerStore = create<CareerStore>()(
  persist(
    (set, get) => ({
      careerPaths: [],
      isLoading: false,
      error: null,

      syncFromSupabase: async () => {
        const { useAuthStore } = await import('./authStore')
        const { authReady, session } = useAuthStore.getState()
        if (!authReady || !session) return

        set({ isLoading: true, error: null })
        try {
          const API_BASE_URL = getApiBaseUrl()
          const response = await fetch(`${API_BASE_URL}/api/career/list`, {
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(errorData.error || errorData.message || 'Failed to fetch career paths')
          }

          const data = await response.json()
          set({ careerPaths: data.careerPaths || [], isLoading: false })
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to sync career paths'
          set({ error: errorMessage, isLoading: false })
        }
      },

      addCareerPath: async (targetId: string, graphId: string, role: string, company: string, seniority: string, major: string | null, nodes: SkillNode[]) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        set({ error: null })
        try {
          const API_BASE_URL = getApiBaseUrl()
          const { useAuthStore } = await import('./authStore')
          const { authReady, session } = useAuthStore.getState()
          
          if (!authReady || !session) {
            throw new Error('You must be logged in to create a career path')
          }

          const response = await fetch(`${API_BASE_URL}/api/career/save`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              targetId,
              graphId,
              role,
              company,
              seniority,
              major,
              nodes
            }),
          })

          const data = await response.json()

          if (!response.ok) {
            throw new Error(data.message || data.error || 'Failed to save career path')
          }

          if (data.success && data.careerPath) {
            set((state) => ({
              careerPaths: [...state.careerPaths, data.careerPath]
            }))
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to add career path'
          set({ error: errorMessage })
          throw error
        }
      },

      removeCareerPath: async (id: string) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        set({ error: null })
        try {
          const API_BASE_URL = getApiBaseUrl()
          const { useAuthStore } = await import('./authStore')
          const { authReady, session } = useAuthStore.getState()
          
          if (!authReady || !session) {
            throw new Error('You must be logged in to delete a career path')
          }

          const response = await fetch(`${API_BASE_URL}/api/career/delete`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ id }),
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.message || errorData.error || 'Failed to delete career path')
          }

          set((state) => ({
            careerPaths: state.careerPaths.filter(cp => cp.id !== id)
          }))
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to remove career path'
          set({ error: errorMessage })
          throw error
        }
      },

      getCareerPathById: (id: string) => {
        return get().careerPaths.find(cp => cp.id === id)
      },
    }),
    {
      name: 'career-storage',
      storage: createJSONStorage(() => getStorage()),
    }
  )
)
