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

router.get('/by-skill/:skillId', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const { skillId } = req.params

    if (!skillId) {
      return res.status(400).json({ error: 'Skill ID is required' })
    }

    const { data: notes, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', req.userId)
      .contains('skill_ids', [skillId])
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Error listing notes by skill:', error)
      return res.status(500).json({ error: 'Failed to list notes by skill', message: error.message })
    }

    // Transform from snake_case to camelCase
    const transformedNotes = (notes || []).map((note: any) => ({
      id: note.id,
      name: note.name,
      content: note.content || '',
      skillIds: note.skill_ids || [],
      createdAt: note.created_at,
      updatedAt: note.updated_at,
    }))

    res.json(transformedNotes)
  } catch (error) {
    console.error('Error in listNotesBySkill:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to list notes by skill'
    res.status(500).json({ error: errorMessage })
  }
})

export default router
