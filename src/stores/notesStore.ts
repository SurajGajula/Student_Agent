import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { supabase } from '../lib/supabase'
import { useUsageStore } from './usageStore'
import { getStorage } from '../lib/storage'

export interface Note {
  id: string
  name: string
  folderId?: string | null
  content?: string
  createdAt?: string
  updatedAt?: string
}

interface NotesStore {
  notes: Note[]
  isLoading: boolean
  error: string | null
  syncFromSupabase: () => Promise<void>
  addNote: (name: string, folderId?: string) => Promise<void>
  removeNote: (id: string) => Promise<void>
  updateNoteContentLocal: (id: string, content: string) => void
  updateNoteContent: (id: string, content: string) => Promise<void>
  moveNoteToFolder: (id: string, folderId: string | null) => Promise<void>
}

export const useNotesStore = create<NotesStore>()(
  persist(
    (set, get) => ({
  notes: [],
      isLoading: false,
      error: null,

      syncFromSupabase: async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        set({ isLoading: true, error: null })
        try {
          const { data: notes, error } = await supabase
            .from('notes')
            .select('*')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false })

          if (error) throw error

          // Transform from snake_case to camelCase
          const transformedNotes: Note[] = (notes || []).map((note: any) => ({
            id: note.id,
            name: note.name,
            folderId: note.folder_id || null,
            content: note.content || '',
            createdAt: note.created_at,
            updatedAt: note.updated_at,
          }))

          set({
            notes: transformedNotes,
            isLoading: false,
          })
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Sync failed',
            isLoading: false,
          })
        }
      },

      addNote: async (name: string, folderId?: string) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        set({ error: null })
        try {
          // Check plan limits for free users
          const { planName } = useUsageStore.getState()
          if (planName === 'free') {
            const currentCount = get().notes.length
            if (currentCount >= 10) {
              throw new Error('Free plan limit reached: You can only have 10 notes. Upgrade to add more.')
            }
          }

          const { data, error } = await supabase
            .from('notes')
            .insert({
              user_id: user.id,
              name: name.trim(),
              folder_id: folderId || null,
              content: '',
            })
            .select()
            .single()

          if (error) throw error

          // Transform to camelCase
    const newNote: Note = {
            id: data.id,
            name: data.name,
            folderId: data.folder_id || null,
            content: data.content || '',
            createdAt: data.created_at,
            updatedAt: data.updated_at,
    }

    set((state) => ({
      notes: [...state.notes, newNote]
    }))
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to add note'
          set({ error: errorMessage })
          throw error
        }
  },

      updateNoteContentLocal: (id: string, content: string) => {
        // Optimistic update - update local state immediately
    set((state) => ({
      notes: state.notes.map((note) =>
            note.id === id
              ? { ...note, content, updatedAt: new Date().toISOString() }
              : note
      )
    }))
  },

      updateNoteContent: async (id: string, content: string) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        set({ error: null })
        try {
          const { error } = await supabase
            .from('notes')
            .update({
              content,
              updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .eq('user_id', user.id)

          if (error) throw error

          // Update state to ensure it matches Supabase
          set((state) => ({
            notes: state.notes.map((note) =>
              note.id === id
                ? { ...note, content, updatedAt: new Date().toISOString() }
                : note
            )
          }))
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to update note'
          set({ error: errorMessage })
          throw error
        }
      },

      removeNote: async (id: string) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        set({ error: null })
        try {
          const { error } = await supabase
            .from('notes')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id)

          if (error) throw error

          set((state) => ({
            notes: state.notes.filter((note) => note.id !== id)
          }))
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to remove note'
          set({ error: errorMessage })
          throw error
        }
      },

      moveNoteToFolder: async (id: string, folderId: string | null) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        set({ error: null })
        try {
          const { error } = await supabase
            .from('notes')
            .update({
              folder_id: folderId,
              updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .eq('user_id', user.id)

          if (error) throw error

          set((state) => ({
            notes: state.notes.map((note) =>
              note.id === id
                ? { ...note, folderId: folderId || null, updatedAt: new Date().toISOString() }
                : note
            )
          }))
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to move note'
          set({ error: errorMessage })
          throw error
        }
      },
    }),
    {
      name: 'notes-storage',
      storage: createJSONStorage(() => getStorage()),
    }
  )
)
