import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { supabase } from '../lib/supabase'
import { useUsageStore } from './usageStore'
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
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        set({ isLoading: true, error: null })
        try {
          const { data: classes, error } = await supabase
            .from('classes')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })

          if (error) throw error

          // Transform from snake_case to camelCase
          const transformedClasses: Class[] = (classes || []).map((classItem: any) => ({
            id: classItem.id,
            name: classItem.name,
            folderId: classItem.folder_id || null,
            days: classItem.days || null,
            timeRange: classItem.time_range || null,
            createdAt: classItem.created_at,
            updatedAt: classItem.updated_at,
          }))

          set({
            classes: transformedClasses,
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
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        set({ error: null })
        try {
          // Check plan limits for free users
          const { planName } = useUsageStore.getState()
          if (planName === 'free') {
            const currentCount = get().classes.length
            if (currentCount >= 10) {
              throw new Error('Free plan limit reached: You can only have 10 classes. Upgrade to add more.')
            }
          }

          const { data, error } = await supabase
            .from('classes')
            .insert({
              user_id: user.id,
              name: name.trim(),
              folder_id: folderId || null,
              days: time?.days || null,
              time_range: time?.timeRange || null,
            })
            .select()
            .single()

          if (error) throw error

          // Transform to camelCase
    const newClass: Class = {
            id: data.id,
            name: data.name,
            folderId: data.folder_id || null,
            days: data.days || null,
            timeRange: data.time_range || null,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          }

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
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        set({ error: null })
        try {
          const { error } = await supabase
            .from('classes')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id)

          if (error) throw error

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
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        set({ error: null })
        try {
          const { error } = await supabase
            .from('classes')
            .update({
              folder_id: folderId,
              updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .eq('user_id', user.id)

          if (error) throw error

          set((state) => ({
            classes: state.classes.map((classItem) =>
              classItem.id === id
                ? { ...classItem, folderId: folderId || null, updatedAt: new Date().toISOString() }
                : classItem
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
