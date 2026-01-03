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

router.delete('/delete/:id', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const { id } = req.params

    // First check if flashcard set exists and belongs to user
    const { data: existingSet, error: checkError } = await supabase
      .from('flashcards')
      .select('id')
      .eq('id', id)
      .eq('user_id', req.userId)
      .single()

    if (checkError || !existingSet) {
      return res.status(404).json({ error: 'Flashcard set not found' })
    }

    const { error } = await supabase
      .from('flashcards')
      .delete()
      .eq('id', id)
      .eq('user_id', req.userId)

    if (error) {
      console.error('Error deleting flashcard set:', error)
      return res.status(500).json({ error: 'Failed to delete flashcard set', message: error.message })
    }

    res.json({ success: true, message: 'Flashcard set deleted successfully' })
  } catch (error) {
    console.error('Error in deleteFlashcard:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete flashcard set'
    res.status(500).json({ error: errorMessage })
  }
})

export default router

