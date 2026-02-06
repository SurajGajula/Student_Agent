import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { supabase } from '../lib/supabase'
import { getApiBaseUrl } from '../lib/platform'
import { getStorage } from '../lib/storage'

export interface Note {
  id: string
  name: string
  folderId?: string | null
  content?: string
  skillIds?: string[]
  createdAt?: string
  updatedAt?: string
}

interface NotesStore {
  notes: Note[]
  isLoading: boolean
  error: string | null
  syncFromSupabase: () => Promise<void>
  addNote: (name: string, folderId?: string, content?: string) => Promise<void>
  removeNote: (id: string) => Promise<void>
  updateNoteContentLocal: (id: string, content: string) => void
  updateNoteContent: (id: string, content: string) => Promise<void>
  updateNoteSkills: (id: string, skillIds: string[]) => Promise<void>
  moveNoteToFolder: (id: string, folderId: string | null) => Promise<void>
  reset: () => void
}

export const useNotesStore = create<NotesStore>()(
  persist(
    (set, get) => ({
  notes: [],
      isLoading: false,
      error: null,

      syncFromSupabase: async () => {
        // Check auth readiness synchronously (dynamic import to avoid require cycle)
        const { useAuthStore } = await import('./authStore')
        const { authReady, session } = useAuthStore.getState()
        if (!authReady || !session) return

        set({ isLoading: true, error: null })
        try {
          const API_BASE_URL = getApiBaseUrl()
          const response = await fetch(`${API_BASE_URL}/api/notes/list`, {
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(errorData.error || errorData.message || 'Failed to fetch notes')
          }

          const notes: Note[] = await response.json()

          set({
            notes,
            isLoading: false,
          })
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Sync failed',
            isLoading: false,
          })
        }
      },

      addNote: async (name: string, folderId?: string, content?: string) => {
        // Dynamic import to avoid require cycle
        const { useAuthStore } = await import('./authStore')
        const { authReady, session } = useAuthStore.getState()
        if (!authReady || !session) throw new Error('Not authenticated')

        set({ error: null })
        try {
          const API_BASE_URL = getApiBaseUrl()
          const response = await fetch(`${API_BASE_URL}/api/notes/add`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ name, content })
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            const errorMessage = errorData.error || errorData.message || 'Failed to add note'
            throw new Error(errorMessage)
          }

          const newNote: Note = await response.json()

          set((state) => ({
            notes: [...state.notes, newNote]
          }))

          // Sync from Supabase to get auto-tagged skills if content was provided
          if (content) {
            // Small delay to allow backend to complete auto-tagging
            setTimeout(async () => {
              try {
                await get().syncFromSupabase()
              } catch (syncError) {
                console.warn('Failed to sync notes after auto-tagging:', syncError)
              }
            }, 2000)
          }
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

      reset: () => {
        set({ isLoading: false, error: null })
      },

      updateNoteContent: async (id: string, content: string) => {
        const { useAuthStore } = await import('./authStore')
        const { authReady, session } = useAuthStore.getState()
        if (!authReady || !session) throw new Error('Not authenticated')

        set({ error: null })
        try {
          const API_BASE_URL = getApiBaseUrl()
          const response = await fetch(`${API_BASE_URL}/api/notes/update/${id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ content })
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            const errorMessage = errorData.error || errorData.message || 'Failed to update note'
            throw new Error(errorMessage)
          }

          const updatedNote: Note = await response.json()

          // Update state to ensure it matches API response
          set((state) => ({
            notes: state.notes.map((note) =>
              note.id === id ? updatedNote : note
            )
          }))
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to update note'
          set({ error: errorMessage })
          throw error
        }
      },

      updateNoteSkills: async (id: string, skillIds: string[]) => {
        const { useAuthStore } = await import('./authStore')
        const { authReady, session } = useAuthStore.getState()
        if (!authReady || !session) throw new Error('Not authenticated')

        set({ error: null })
        try {
          const API_BASE_URL = getApiBaseUrl()
          const response = await fetch(`${API_BASE_URL}/api/notes/update/${id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ skillIds })
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            const errorMessage = errorData.error || errorData.message || 'Failed to update note skills'
            throw new Error(errorMessage)
          }

          const updatedNote: Note = await response.json()

          // Update state to ensure it matches API response
          set((state) => ({
            notes: state.notes.map((note) =>
              note.id === id ? updatedNote : note
            )
          }))
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to update note skills'
          set({ error: errorMessage })
          throw error
        }
      },

      removeNote: async (id: string) => {
        const { useAuthStore } = await import('./authStore')
        const { authReady, session } = useAuthStore.getState()
        if (!authReady || !session) throw new Error('Not authenticated')

        set({ error: null })
        try {
          const API_BASE_URL = getApiBaseUrl()
          const response = await fetch(`${API_BASE_URL}/api/notes/delete/${id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            const errorMessage = errorData.error || errorData.message || 'Failed to remove note'
            throw new Error(errorMessage)
          }

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
        const { useAuthStore } = await import('./authStore')
        const { authReady, session } = useAuthStore.getState()
        if (!authReady || !session) throw new Error('Not authenticated')

        set({ error: null })
        try {
          const API_BASE_URL = getApiBaseUrl()
          const response = await fetch(`${API_BASE_URL}/api/notes/move/${id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({})
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            const errorMessage = errorData.error || errorData.message || 'Failed to move note'
            throw new Error(errorMessage)
          }

          const updatedNote: Note = await response.json()

          set((state) => ({
            notes: state.notes.map((note) =>
              note.id === id ? updatedNote : note
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
