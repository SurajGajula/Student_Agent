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

    const { name, noteId, noteName, questions } = req.body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Test name is required' })
    }

    if (!noteId || !noteName) {
      return res.status(400).json({ error: 'Note ID and name are required' })
    }

    if (!questions || !Array.isArray(questions)) {
      return res.status(400).json({ error: 'Questions array is required' })
    }

    // Check plan limits for free users
    const { data: usageData } = await supabase
      .from('user_usage')
      .select(`
        plan_id,
        plans!inner(name)
      `)
      .eq('user_id', req.userId)
      .single()

    if (usageData && (usageData as any).plans?.name === 'free') {
      const { count } = await supabase
        .from('tests')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', req.userId)

      if (count !== null && count >= 10) {
        return res.status(403).json({
          error: 'Free plan limit reached: You can only have 10 tests. Upgrade to add more.'
        })
      }
    }

    const { data, error } = await supabase
      .from('tests')
      .insert({
        user_id: req.userId,
        name: name.trim(),
        note_id: noteId,
        note_name: noteName,
        questions: questions, // JSONB handled automatically by Supabase
      })
      .select()
      .single()

    if (error) {
      console.error('Error adding test:', error)
      return res.status(500).json({ error: 'Failed to add test', message: error.message })
    }

    // Transform to camelCase
    const newTest = {
      id: data.id,
      name: data.name,
      noteId: data.note_id,
      noteName: data.note_name,
      questions: data.questions || [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }

    res.json(newTest)
  } catch (error) {
    console.error('Error in addTest:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to add test'
    res.status(500).json({ error: errorMessage })
  }
})

export default router

