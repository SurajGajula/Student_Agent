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

    const { data: notes, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', req.userId)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Error listing notes:', error)
      return res.status(500).json({ error: 'Failed to list notes', message: error.message })
    }

    // Transform from snake_case to camelCase
    const transformedNotes = (notes || []).map((note: any) => ({
      id: note.id,
      name: note.name,
      folderId: note.folder_id || null,
      content: note.content || '',
      createdAt: note.created_at,
      updatedAt: note.updated_at,
    }))

    res.json(transformedNotes)
  } catch (error) {
    console.error('Error in listNotes:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to list notes'
    res.status(500).json({ error: errorMessage })
  }
})

export default router

