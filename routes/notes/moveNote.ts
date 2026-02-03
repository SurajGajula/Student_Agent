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

router.put('/move/:id', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const { id } = req.params

    // First check if note exists and belongs to user
    const { data: existingNote, error: checkError } = await supabase
      .from('notes')
      .select('id')
      .eq('id', id)
      .eq('user_id', req.userId)
      .single()

    if (checkError || !existingNote) {
      return res.status(404).json({ error: 'Note not found' })
    }

    const { data, error } = await supabase
      .from('notes')
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', req.userId)
      .select()
      .single()

    if (error) {
      console.error('Error moving note:', error)
      return res.status(500).json({ error: 'Failed to move note', message: error.message })
    }

    // Transform to camelCase
    const updatedNote = {
      id: data.id,
      name: data.name,
      content: data.content || '',
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }

    res.json(updatedNote)
  } catch (error) {
    console.error('Error in moveNote:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to move note'
    res.status(500).json({ error: errorMessage })
  }
})

export default router

