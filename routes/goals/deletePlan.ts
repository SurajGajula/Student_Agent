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

router.post('/delete', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const { id } = req.body

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Goal ID is required' })
    }

    // Verify the goal belongs to the user
    const { data: existingGoal, error: fetchError } = await supabase
      .from('goals')
      .select('id')
      .eq('id', id)
      .eq('user_id', req.userId)
      .single()

    if (fetchError || !existingGoal) {
      return res.status(404).json({ error: 'Goal not found or access denied' })
    }

    const { error } = await supabase
      .from('goals')
      .delete()
      .eq('id', id)
      .eq('user_id', req.userId)

    if (error) {
      console.error('Error deleting goal:', error)
      return res.status(500).json({ error: 'Failed to delete goal', message: error.message })
    }

    res.json({ success: true })
  } catch (error) {
    console.error('Error in deletePlan:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete plan'
    res.status(500).json({ error: errorMessage })
  }
})

export default router

