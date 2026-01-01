import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { supabase } from '../lib/supabase'
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
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        set({ isLoading: true, error: null })
        try {
          const { data: flashcardSets, error } = await supabase
            .from('flashcards')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })

          if (error) throw error

          // Transform from snake_case to camelCase and parse JSONB cards
          const transformedSets: FlashcardSet[] = (flashcardSets || []).map((set: any) => ({
            id: set.id,
            name: set.name,
            folderId: set.folder_id || null,
            noteId: set.note_id,
            noteName: set.note_name,
            cards: set.cards || [],
            createdAt: set.created_at,
            updatedAt: set.updated_at,
          }))

          set({
            flashcardSets: transformedSets,
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
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        set({ error: null })
        try {
          const { data, error } = await supabase
            .from('flashcards')
            .insert({
              user_id: user.id,
              name: setData.name,
              folder_id: setData.folderId || null,
              note_id: setData.noteId,
              note_name: setData.noteName,
              cards: setData.cards, // JSONB handled automatically by Supabase
            })
            .select()
            .single()

          if (error) throw error

          // Transform to camelCase
          const newSet: FlashcardSet = {
            id: data.id,
            name: data.name,
            folderId: data.folder_id || null,
            noteId: data.note_id,
            noteName: data.note_name,
            cards: data.cards || [],
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          }

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
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        set({ error: null })
        try {
          const { error } = await supabase
            .from('flashcards')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id)

          if (error) throw error

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
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        set({ error: null })
        try {
          const { error } = await supabase
            .from('flashcards')
            .update({
              folder_id: folderId,
              updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .eq('user_id', user.id)

          if (error) throw error

          set((state) => ({
            flashcardSets: state.flashcardSets.map((set) =>
              set.id === id
                ? { ...set, folderId: folderId || null, updatedAt: new Date().toISOString() }
                : set
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

