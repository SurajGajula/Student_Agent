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

router.put('/update/:id', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const { id } = req.params
    const { content } = req.body

    if (content === undefined) {
      return res.status(400).json({ error: 'Content is required' })
    }

    const { data, error } = await supabase
      .from('notes')
      .update({
        content: typeof content === 'string' ? content : '',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', req.userId)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Note not found' })
      }
      console.error('Error updating note:', error)
      return res.status(500).json({ error: 'Failed to update note', message: error.message })
    }

    // Transform to camelCase
    const updatedNote = {
      id: data.id,
      name: data.name,
      folderId: data.folder_id || null,
      content: data.content || '',
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }

    res.json(updatedNote)
  } catch (error) {
    console.error('Error in updateNote:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to update note'
    res.status(500).json({ error: errorMessage })
  }
})

export default router

