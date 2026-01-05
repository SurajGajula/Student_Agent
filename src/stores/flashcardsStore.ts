import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { supabase } from '../lib/supabase'
import { getApiBaseUrl } from '../lib/platform'
import { getStorage } from '../lib/storage'

export interface FlashcardCard {
  id: string
  front: string
  back: string
}

export interface FlashcardSet {
  id: string
  name: string
  folderId?: string | null
  noteId: string
  noteName: string
  cards: FlashcardCard[]
  createdAt?: string
  updatedAt?: string
}

interface FlashcardsStore {
  flashcardSets: FlashcardSet[]
  isLoading: boolean
  error: string | null
  syncFromSupabase: () => Promise<void>
  addFlashcardSet: (set: Omit<FlashcardSet, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  removeFlashcardSet: (id: string) => Promise<void>
  getFlashcardSetById: (id: string) => FlashcardSet | undefined
  moveFlashcardSetToFolder: (id: string, folderId: string | null) => Promise<void>
}

export const useFlashcardsStore = create<FlashcardsStore>()(
  persist(
    (set, get) => ({
      flashcardSets: [],
      isLoading: false,
      error: null,

      syncFromSupabase: async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        set({ isLoading: true, error: null })
        try {
          const API_BASE_URL = getApiBaseUrl()
          const response = await fetch(`${API_BASE_URL}/api/flashcards/list`, {
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(errorData.error || errorData.message || 'Failed to fetch flashcard sets')
          }

          const flashcardSets: FlashcardSet[] = await response.json()

          set({
            flashcardSets,
            isLoading: false,
          })
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Sync failed',
            isLoading: false,
          })
        }
      },

      addFlashcardSet: async (setData) => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) throw new Error('Not authenticated')

        set({ error: null })
        try {
          const API_BASE_URL = getApiBaseUrl()
          const response = await fetch(`${API_BASE_URL}/api/flashcards/add`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              name: setData.name,
              folderId: setData.folderId,
              noteId: setData.noteId,
              noteName: setData.noteName,
              cards: setData.cards
            })
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            const errorMessage = errorData.error || errorData.message || 'Failed to add flashcard set'
            throw new Error(errorMessage)
          }

          const newSet: FlashcardSet = await response.json()

          set((state) => ({
            flashcardSets: [...state.flashcardSets, newSet]
          }))
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to add flashcard set'
          set({ error: errorMessage })
          throw error
        }
      },

      removeFlashcardSet: async (id: string) => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) throw new Error('Not authenticated')

        set({ error: null })
        try {
          const API_BASE_URL = getApiBaseUrl()
          const response = await fetch(`${API_BASE_URL}/api/flashcards/delete/${id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            const errorMessage = errorData.error || errorData.message || 'Failed to remove flashcard set'
            throw new Error(errorMessage)
          }

          set((state) => ({
            flashcardSets: state.flashcardSets.filter((set) => set.id !== id)
          }))
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to remove flashcard set'
          set({ error: errorMessage })
          throw error
        }
      },

      getFlashcardSetById: (id: string) => {
        return get().flashcardSets.find((set) => set.id === id)
      },

      moveFlashcardSetToFolder: async (id: string, folderId: string | null) => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) throw new Error('Not authenticated')

        set({ error: null })
        try {
          const API_BASE_URL = getApiBaseUrl()
          const response = await fetch(`${API_BASE_URL}/api/flashcards/move/${id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ folderId })
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            const errorMessage = errorData.error || errorData.message || 'Failed to move flashcard set'
            throw new Error(errorMessage)
          }

          const updatedSet: FlashcardSet = await response.json()

          set((state) => ({
            flashcardSets: state.flashcardSets.map((set) =>
              set.id === id ? updatedSet : set
            )
          }))
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to move flashcard set'
          set({ error: errorMessage })
          throw error
        }
      },
    }),
    {
      name: 'flashcards-storage',
      storage: createJSONStorage(() => getStorage()),
    }
  )
)

