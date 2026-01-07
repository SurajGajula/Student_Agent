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

    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching goals:', error)
      return res.status(500).json({ error: 'Failed to fetch goals', message: error.message })
    }

    // Transform to camelCase
    const goals = (data || []).map(goal => ({
      id: goal.id,
      name: goal.name,
      query: goal.query,
      school: goal.school,
      department: goal.department,
      courses: goal.courses || [],
      createdAt: goal.created_at,
      updatedAt: goal.updated_at,
    }))

    res.json({ goals })
  } catch (error) {
    console.error('Error in listGoals:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to list goals'
    res.status(500).json({ error: errorMessage })
  }
})

export default router

