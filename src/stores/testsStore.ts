import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { supabase } from '../lib/supabase'
import { getApiBaseUrl } from '../lib/platform'
import { getStorage } from '../lib/storage'

const API_BASE_URL = getApiBaseUrl()

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
  moveTestToFolder: (id: string, folderId: string | null) => Promise<void>
}

export const useTestsStore = create<TestsStore>()(
  persist(
    (set, get) => ({
  tests: [],
      isLoading: false,
      error: null,

      syncFromSupabase: async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        set({ isLoading: true, error: null })
        try {
          const response = await fetch(`${API_BASE_URL}/api/tests/list`, {
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(errorData.error || errorData.message || 'Failed to fetch tests')
          }

          const tests: Test[] = await response.json()

          set({
            tests,
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
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) throw new Error('Not authenticated')

        set({ error: null })
        try {
          const response = await fetch(`${API_BASE_URL}/api/tests/add`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              name: testData.name,
              folderId: testData.folderId,
              noteId: testData.noteId,
              noteName: testData.noteName,
              questions: testData.questions
            })
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            const errorMessage = errorData.error || errorData.message || 'Failed to add test'
            throw new Error(errorMessage)
          }

          const newTest: Test = await response.json()

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
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) throw new Error('Not authenticated')

        set({ error: null })
        try {
          const response = await fetch(`${API_BASE_URL}/api/tests/delete/${id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            const errorMessage = errorData.error || errorData.message || 'Failed to remove test'
            throw new Error(errorMessage)
          }

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

      moveTestToFolder: async (id: string, folderId: string | null) => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) throw new Error('Not authenticated')

        set({ error: null })
        try {
          const response = await fetch(`${API_BASE_URL}/api/tests/move/${id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ folderId })
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            const errorMessage = errorData.error || errorData.message || 'Failed to move test'
            throw new Error(errorMessage)
          }

          const updatedTest: Test = await response.json()

          set((state) => ({
            tests: state.tests.map((test) =>
              test.id === id ? updatedTest : test
            )
          }))
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to move test'
          set({ error: errorMessage })
          throw error
        }
      },
    }),
    {
      name: 'tests-storage',
      storage: createJSONStorage(() => getStorage()),
  }
  )
)
