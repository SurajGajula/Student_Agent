import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { supabase } from '../lib/supabase'

export interface Question {
  id: string
  question: string
  type: 'multiple-choice' | 'short-answer'
  options?: string[]
  correctAnswer?: string
}

export interface Test {
  id: string
  name: string
  folderId?: string | null
  noteId: string
  noteName: string
  questions: Question[]
  createdAt?: string
  updatedAt?: string
}

interface TestsStore {
  tests: Test[]
  isLoading: boolean
  error: string | null
  syncFromSupabase: () => Promise<void>
  addTest: (test: Omit<Test, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  removeTest: (id: string) => Promise<void>
  getTestById: (id: string) => Test | undefined
}

export const useTestsStore = create<TestsStore>()(
  persist(
    (set, get) => ({
      tests: [],
      isLoading: false,
      error: null,

      syncFromSupabase: async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        set({ isLoading: true, error: null })
        try {
          const { data: tests, error } = await supabase
            .from('tests')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })

          if (error) throw error

          // Transform from snake_case to camelCase and parse JSONB questions
          const transformedTests: Test[] = (tests || []).map((test: any) => ({
            id: test.id,
            name: test.name,
            folderId: test.folder_id || null,
            noteId: test.note_id,
            noteName: test.note_name,
            questions: test.questions || [],
            createdAt: test.created_at,
            updatedAt: test.updated_at,
          }))

          set({
            tests: transformedTests,
            isLoading: false,
          })
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Sync failed',
            isLoading: false,
          })
        }
      },

      addTest: async (testData) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        set({ error: null })
        try {
          const { data, error } = await supabase
            .from('tests')
            .insert({
              user_id: user.id,
              name: testData.name,
              folder_id: testData.folderId || null,
              note_id: testData.noteId,
              note_name: testData.noteName,
              questions: testData.questions, // JSONB handled automatically by Supabase
            })
            .select()
            .single()

          if (error) throw error

          // Transform to camelCase
          const newTest: Test = {
            id: data.id,
            name: data.name,
            folderId: data.folder_id || null,
            noteId: data.note_id,
            noteName: data.note_name,
            questions: data.questions || [],
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          }

          set((state) => ({
            tests: [...state.tests, newTest]
          }))
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to add test'
          set({ error: errorMessage })
          throw error
        }
      },

      removeTest: async (id: string) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        set({ error: null })
        try {
          const { error } = await supabase
            .from('tests')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id)

          if (error) throw error

          set((state) => ({
            tests: state.tests.filter((test) => test.id !== id)
          }))
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to remove test'
          set({ error: errorMessage })
          throw error
        }
      },

      getTestById: (id: string) => {
        return get().tests.find((test) => test.id === id)
      },
    }),
    {
      name: 'tests-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
