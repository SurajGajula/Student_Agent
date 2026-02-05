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

router.post('/save', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const { targetId, graphId, role, company, seniority, major, nodes } = req.body

    if (!targetId || !graphId || !role || !company) {
      return res.status(400).json({ error: 'targetId, graphId, role, and company are required' })
    }

    // Store career path in a user_career_paths table
    // For now, we'll create a simple table to store user's saved career paths
    const { data, error } = await supabase
      .from('user_career_paths')
      .insert({
        user_id: req.userId,
        target_id: targetId,
        graph_id: graphId,
        role,
        company,
        seniority: seniority || 'mid',
        major: major || null,
        nodes: nodes || []
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving career path:', error)
      return res.status(500).json({ error: 'Failed to save career path', message: error.message })
    }

    const careerPath = {
      id: data.id,
      targetId: data.target_id,
      graphId: data.graph_id,
      role: data.role,
      company: data.company,
      seniority: data.seniority,
      major: data.major,
      nodes: data.nodes || [],
      createdAt: data.created_at,
      updatedAt: data.updated_at
    }

    res.json({
      success: true,
      careerPath
    })
  } catch (error) {
    console.error('Error in saveCareerPath:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to save career path'
    res.status(500).json({ error: errorMessage })
  }
})

export default router
