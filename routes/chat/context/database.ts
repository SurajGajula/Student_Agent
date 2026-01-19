// Load environment variables first
import '../../../load-env.js'

import { createClient } from '@supabase/supabase-js'
import type { DatabaseContext, PageContext } from './types.js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

/**
 * Fetch relevant database data based on context
 */
export async function fetchDatabaseContext(
  userId: string,
  pageContext?: PageContext
): Promise<DatabaseContext> {
  const context: DatabaseContext = {}

  // If user has mentions or is on notes page, fetch recent notes
  if (pageContext?.currentView === 'notes' || pageContext?.selectedItems?.notes) {
    const { data: notes, error: notesError } = await supabase
      .from('notes')
      .select('id, name, content')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(20)

    if (!notesError && notes) {
      context.notes = notes.map(note => ({
        id: note.id,
        name: note.name,
        content: note.content || ''
      }))
    }
  }

  // If user is on tests page, fetch recent tests
  if (pageContext?.currentView === 'tests' || pageContext?.selectedItems?.tests) {
    const { data: tests, error: testsError } = await supabase
      .from('tests')
      .select('id, name')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(10)

    if (!testsError && tests) {
      context.recentTests = tests.map(test => ({
        id: test.id,
        name: test.name
      }))
    }
  }

  // If user is on flashcards page, fetch recent flashcard sets
  if (pageContext?.currentView === 'flashcards' || pageContext?.selectedItems?.flashcards) {
    const { data: flashcards, error: flashcardsError } = await supabase
      .from('flashcard_sets')
      .select('id, name')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(10)

    if (!flashcardsError && flashcards) {
      context.recentFlashcards = flashcards.map(set => ({
        id: set.id,
        name: set.name
      }))
    }
  }

  return context
}
