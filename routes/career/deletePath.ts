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

router.delete('/delete', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const { id } = req.body

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Career path ID is required' })
    }

    // Verify the career path belongs to the user
    const { data: existing, error: checkError } = await supabase
      .from('user_career_paths')
      .select('id')
      .eq('id', id)
      .eq('user_id', req.userId)
      .single()

    if (checkError || !existing) {
      return res.status(404).json({ error: 'Career path not found or access denied' })
    }

    const { error } = await supabase
      .from('user_career_paths')
      .delete()
      .eq('id', id)
      .eq('user_id', req.userId)

    if (error) {
      console.error('Error deleting career path:', error)
      return res.status(500).json({ error: 'Failed to delete career path', message: error.message })
    }

    res.json({ success: true })
  } catch (error) {
    console.error('Error in deleteCareerPath:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete career path'
    res.status(500).json({ error: errorMessage })
  }
})

export default router
