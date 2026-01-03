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

router.post('/add', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const { name, folderId, noteId, noteName, cards } = req.body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Flashcard set name is required' })
    }

    if (!noteId || !noteName) {
      return res.status(400).json({ error: 'Note ID and name are required' })
    }

    if (!cards || !Array.isArray(cards)) {
      return res.status(400).json({ error: 'Cards array is required' })
    }

    const { data, error } = await supabase
      .from('flashcards')
      .insert({
        user_id: req.userId,
        name: name.trim(),
        folder_id: folderId || null,
        note_id: noteId,
        note_name: noteName,
        cards: cards, // JSONB handled automatically by Supabase
      })
      .select()
      .single()

    if (error) {
      console.error('Error adding flashcard set:', error)
      return res.status(500).json({ error: 'Failed to add flashcard set', message: error.message })
    }

    // Transform to camelCase
    const newSet = {
      id: data.id,
      name: data.name,
      folderId: data.folder_id || null,
      noteId: data.note_id,
      noteName: data.note_name,
      cards: data.cards || [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }

    res.json(newSet)
  } catch (error) {
    console.error('Error in addFlashcard:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to add flashcard set'
    res.status(500).json({ error: errorMessage })
  }
})

export default router

