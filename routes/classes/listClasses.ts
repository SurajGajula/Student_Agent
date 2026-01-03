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

    const { data: classes, error } = await supabase
      .from('classes')
      .select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error listing classes:', error)
      return res.status(500).json({ error: 'Failed to list classes', message: error.message })
    }

    // Transform from snake_case to camelCase
    const transformedClasses = (classes || []).map((classItem: any) => ({
      id: classItem.id,
      name: classItem.name,
      folderId: classItem.folder_id || null,
      days: classItem.days || null,
      timeRange: classItem.time_range || null,
      createdAt: classItem.created_at,
      updatedAt: classItem.updated_at,
    }))

    res.json(transformedClasses)
  } catch (error) {
    console.error('Error in listClasses:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to list classes'
    res.status(500).json({ error: errorMessage })
  }
})

export default router

