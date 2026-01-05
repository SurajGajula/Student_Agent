import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { supabase } from '../lib/supabase'
import { getApiBaseUrl } from '../lib/platform'
import { getStorage } from '../lib/storage'

export interface Class {
  id: string
  name: string
  folderId?: string | null
  days?: string[]
  timeRange?: string
  createdAt?: string
  updatedAt?: string
}

interface ClassesStore {
  classes: Class[]
  isLoading: boolean
  error: string | null
  syncFromSupabase: () => Promise<void>
  addClass: (name: string, folderId?: string, time?: { days: string[], timeRange: string }) => Promise<void>
  removeClass: (id: string) => Promise<void>
  moveClassToFolder: (id: string, folderId: string | null) => Promise<void>
}

export const useClassesStore = create<ClassesStore>()(
  persist(
    (set, get) => ({
  classes: [],
      isLoading: false,
      error: null,

      syncFromSupabase: async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        set({ isLoading: true, error: null })
        try {
          const API_BASE_URL = getApiBaseUrl()
          const response = await fetch(`${API_BASE_URL}/api/classes/list`, {
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(errorData.error || errorData.message || 'Failed to fetch classes')
          }

          const classes: Class[] = await response.json()

          set({
            classes,
            isLoading: false,
          })
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Sync failed',
            isLoading: false,
          })
        }
      },

      addClass: async (name: string, folderId?: string, time?: { days: string[], timeRange: string }) => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) throw new Error('Not authenticated')

        set({ error: null })
        try {
          const API_BASE_URL = getApiBaseUrl()
          const response = await fetch(`${API_BASE_URL}/api/classes/add`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ name, folderId, days: time?.days, timeRange: time?.timeRange })
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            const errorMessage = errorData.error || errorData.message || 'Failed to add class'
            throw new Error(errorMessage)
          }

          const newClass: Class = await response.json()

          set((state) => ({
            classes: [...state.classes, newClass]
          }))
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to add class'
          set({ error: errorMessage })
          throw error
        }
      },

      removeClass: async (id: string) => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) throw new Error('Not authenticated')

        set({ error: null })
        try {
          const API_BASE_URL = getApiBaseUrl()
          const response = await fetch(`${API_BASE_URL}/api/classes/delete/${id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            const errorMessage = errorData.error || errorData.message || 'Failed to remove class'
            throw new Error(errorMessage)
          }

          set((state) => ({
            classes: state.classes.filter((classItem) => classItem.id !== id)
          }))
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to remove class'
          set({ error: errorMessage })
          throw error
        }
      },

      moveClassToFolder: async (id: string, folderId: string | null) => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) throw new Error('Not authenticated')

        set({ error: null })
        try {
          const API_BASE_URL = getApiBaseUrl()
          const response = await fetch(`${API_BASE_URL}/api/classes/move/${id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ folderId })
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            const errorMessage = errorData.error || errorData.message || 'Failed to move class'
            throw new Error(errorMessage)
          }

          const updatedClass: Class = await response.json()

          set((state) => ({
            classes: state.classes.map((classItem) =>
              classItem.id === id ? updatedClass : classItem
            )
          }))
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to move class'
          set({ error: errorMessage })
          throw error
        }
      },
    }),
    {
      name: 'classes-storage',
      storage: createJSONStorage(() => getStorage()),
    }
  )
)
