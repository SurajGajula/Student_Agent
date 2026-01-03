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
    const { folderId } = req.body

    // First check if test exists and belongs to user
    const { data: existingTest, error: checkError } = await supabase
      .from('tests')
      .select('id')
      .eq('id', id)
      .eq('user_id', req.userId)
      .single()

    if (checkError || !existingTest) {
      return res.status(404).json({ error: 'Test not found' })
    }

    const { data, error } = await supabase
      .from('tests')
      .update({
        folder_id: folderId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', req.userId)
      .select()
      .single()

    if (error) {
      console.error('Error moving test:', error)
      return res.status(500).json({ error: 'Failed to move test', message: error.message })
    }

    // Transform to camelCase
    const updatedTest = {
      id: data.id,
      name: data.name,
      folderId: data.folder_id || null,
      noteId: data.note_id,
      noteName: data.note_name,
      questions: data.questions || [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }

    res.json(updatedTest)
  } catch (error) {
    console.error('Error in moveTest:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to move test'
    res.status(500).json({ error: errorMessage })
  }
})

export default router

