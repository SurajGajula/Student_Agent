import { create } from 'zustand'

export interface Question {
  id: string
  question: string
  type: 'multiple-choice' | 'short-answer'
  options?: string[] // For multiple choice questions
  correctAnswer?: string // Optional correct answer
}

export interface Test {
  id: string
  name: string
  noteId: string // Reference to source note
  noteName: string // Name of source note for display
  questions: Question[]
  createdAt: number // Timestamp
}

interface TestsStore {
  tests: Test[]
  addTest: (test: Omit<Test, 'id' | 'createdAt'>) => void
  removeTest: (id: string) => void
  getTestById: (id: string) => Test | undefined
}

export const useTestsStore = create<TestsStore>((set, get) => ({
  tests: [],
  addTest: (testData) => {
    const newTest: Test = {
      ...testData,
      id: Date.now().toString(),
      createdAt: Date.now()
    }
    set((state) => ({
      tests: [...state.tests, newTest]
    }))
  },
  removeTest: (id: string) => {
    set((state) => ({
      tests: state.tests.filter((test) => test.id !== id)
    }))
  },
  getTestById: (id: string) => {
    return get().tests.find((test) => test.id === id)
  }
}))

