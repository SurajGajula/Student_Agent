// Type definitions for chat context system

export interface PageContext {
  currentView?: string // e.g., 'notes', 'tests', 'flashcards', 'career'
  selectedItems?: {
    notes?: string[] // Array of note IDs
    tests?: string[] // Array of test IDs
    flashcards?: string[] // Array of flashcard set IDs
  }
  metadata?: Record<string, any> // Additional page-specific metadata
}

export interface UserProfile {
  userId: string
  email: string | null
  username: string
  planName: string // 'free' | 'pro'
  tokensUsed: number
  monthlyLimit: number
  remaining: number
  metadata?: Record<string, any> // Additional user metadata from auth
}

export interface DatabaseContext {
  notes?: Array<{
    id: string
    name: string
    content: string
  }>
  recentTests?: Array<{
    id: string
    name: string
  }>
  recentFlashcards?: Array<{
    id: string
    name: string
  }>
  // Can be extended with more database queries as needed
}

export interface ChatContext {
  user: UserProfile
  page?: PageContext
  database?: DatabaseContext
  mentions?: Array<{
    noteId: string
    noteName: string
  }>
}
