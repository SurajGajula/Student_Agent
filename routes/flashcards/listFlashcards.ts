// Load environment variables first
import '../../load-env.js'

import express, { Response } from 'express'
import { createClient } from '@supabase/supabase-js'
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth.js'

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

const router = express.Router()

router.get('/list', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const { data: flashcardSets, error } = await supabase
      .from('flashcards')
      .select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error listing flashcard sets:', error)
      return res.status(500).json({ error: 'Failed to list flashcard sets', message: error.message })
    }

    // Transform from snake_case to camelCase and parse JSONB cards
    const transformedSets = (flashcardSets || []).map((set: any) => ({
      id: set.id,
      name: set.name,
      folderId: set.folder_id || null,
      noteId: set.note_id,
      noteName: set.note_name,
      cards: set.cards || [],
      createdAt: set.created_at,
      updatedAt: set.updated_at,
    }))

    res.json(transformedSets)
  } catch (error) {
    console.error('Error in listFlashcards:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to list flashcard sets'
    res.status(500).json({ error: errorMessage })
  }
})

export default router

