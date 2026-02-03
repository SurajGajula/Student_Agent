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
      .from('user_career_paths')
      .select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching career paths:', error)
      return res.status(500).json({ error: 'Failed to fetch career paths', message: error.message })
    }

    const careerPaths = (data || []).map(cp => ({
      id: cp.id,
      targetId: cp.target_id,
      graphId: cp.graph_id,
      role: cp.role,
      company: cp.company,
      seniority: cp.seniority,
      major: cp.major,
      nodes: cp.nodes || [],
      createdAt: cp.created_at,
      updatedAt: cp.updated_at
    }))

    res.json({
      success: true,
      careerPaths
    })
  } catch (error) {
    console.error('Error in listCareerPaths:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to list career paths'
    res.status(500).json({ error: errorMessage })
  }
})

export default router
