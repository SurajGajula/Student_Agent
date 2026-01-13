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

    const { name, query, school, department, courses } = req.body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Goal name is required' })
    }

    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ error: 'Query is required' })
    }

    // School and department are now optional
    const schoolTrimmed = school && typeof school === 'string' ? school.trim() : null
    const departmentTrimmed = department && typeof department === 'string' ? department.trim() : null

    if (!courses || !Array.isArray(courses)) {
      return res.status(400).json({ error: 'Courses array is required' })
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
        .from('goals')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', req.userId)

      if (count !== null && count >= 10) {
        return res.status(403).json({
          error: 'Free plan limit reached: You can only have 10 goals. Upgrade to add more.'
        })
      }
    }

    const { data, error } = await supabase
      .from('goals')
      .insert({
        user_id: req.userId,
        name: name.trim(),
        query: query.trim(),
        school: schoolTrimmed,
        department: departmentTrimmed,
        courses: courses, // JSONB handled automatically by Supabase
      })
      .select()
      .single()

    if (error) {
      console.error('Error adding goal:', error)
      return res.status(500).json({ error: 'Failed to add goal', message: error.message })
    }

    // Transform to camelCase
    const newGoal = {
      id: data.id,
      name: data.name,
      query: data.query,
      school: data.school,
      department: data.department,
      courses: data.courses || [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }

    res.json({ success: true, goal: newGoal })
  } catch (error) {
    console.error('Error in addGoal:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to add goal'
    res.status(500).json({ error: errorMessage })
  }
})

export default router

