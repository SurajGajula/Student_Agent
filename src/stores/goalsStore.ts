import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { supabase } from '../lib/supabase'
import { getApiBaseUrl } from '../lib/platform'
import { getStorage } from '../lib/storage'

export interface Course {
  id: string
  course_number: string
  name: string
  description: string | null
  prerequisites: string[] | null
  credits: number | null
  department: string | null
  semesters: string[] | null
}

export interface CourseRecommendation {
  course: Course
  relevanceScore: number
  reasoning: string
}

export interface Goal {
  id: string
  name: string
  query: string
  school: string
  department: string | null
  courses: CourseRecommendation[]
  createdAt?: string
  updatedAt?: string
}

interface GoalsStore {
  goals: Goal[]
  isLoading: boolean
  error: string | null
  syncFromSupabase: () => Promise<void>
  addGoal: (name: string, query: string, school: string, department: string | null, courses: CourseRecommendation[]) => Promise<void>
  removeGoal: (id: string) => Promise<void>
  getGoalById: (id: string) => Goal | undefined
}

export const useGoalsStore = create<GoalsStore>()(
  persist(
    (set, get) => ({
      goals: [],
      isLoading: false,
      error: null,

      syncFromSupabase: async () => {
        const { useAuthStore } = await import('./authStore')
        const { authReady, session } = useAuthStore.getState()
        if (!authReady || !session) return

        set({ isLoading: true, error: null })
        try {
          const API_BASE_URL = getApiBaseUrl()
          const response = await fetch(`${API_BASE_URL}/api/goals/list`, {
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(errorData.error || errorData.message || 'Failed to fetch goals')
          }

          const data = await response.json()
          set({ goals: data.goals || [], isLoading: false })
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to sync goals'
          set({ error: errorMessage, isLoading: false })
        }
      },

      addGoal: async (name: string, query: string, school: string, department: string | null, courses: CourseRecommendation[]) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        set({ error: null })
        try {
          const API_BASE_URL = getApiBaseUrl()
          const { useAuthStore } = await import('./authStore')
          const { authReady, session } = useAuthStore.getState()
          
          if (!authReady || !session) {
            throw new Error('You must be logged in to create a goal')
          }

          const response = await fetch(`${API_BASE_URL}/api/goals/add`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              name,
              query,
              school,
              department,
              courses
            }),
          })

          const data = await response.json()

          if (!response.ok) {
            throw new Error(data.message || data.error || 'Failed to add goal')
          }

          if (data.success && data.goal) {
            set((state) => ({
              goals: [...state.goals, data.goal]
            }))
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to add goal'
          set({ error: errorMessage })
          throw error
        }
      },

      removeGoal: async (id: string) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        set({ error: null })
        try {
          const API_BASE_URL = getApiBaseUrl()
          const { useAuthStore } = await import('./authStore')
          const { authReady, session } = useAuthStore.getState()
          
          if (!authReady || !session) {
            throw new Error('You must be logged in to delete a goal')
          }

          const response = await fetch(`${API_BASE_URL}/api/goals/delete`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ id }),
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.message || errorData.error || 'Failed to delete goal')
          }

          set((state) => ({
            goals: state.goals.filter(goal => goal.id !== id)
          }))
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to remove goal'
          set({ error: errorMessage })
          throw error
        }
      },

      getGoalById: (id: string) => {
        return get().goals.find(goal => goal.id === id)
      },
    }),
    {
      name: 'goals-storage',
      storage: createJSONStorage(() => getStorage()),
    }
  )
)

