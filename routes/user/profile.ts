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

// Secret key client (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const router = express.Router()

router.get('/profile', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'User not authenticated' })

    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, school_name')
      .eq('id', req.userId)
      .maybeSingle()

    if (error) {
      console.error('[Profile] Error fetching profile:', error)
      return res.status(500).json({ error: 'Failed to fetch profile', message: error.message })
    }

    return res.json({
      id: data?.id || req.userId,
      schoolName: data?.school_name || null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch profile'
    return res.status(500).json({ error: msg })
  }
})

router.put('/profile', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'User not authenticated' })

    const { schoolName } = req.body as { schoolName?: string }
    const trimmedSchoolName = typeof schoolName === 'string' ? schoolName.trim() : ''

    // Upsert user_profiles table (insert if not exists, update if exists)
    const { data, error } = await supabase
      .from('user_profiles')
      .upsert({
        id: req.userId,
        school_name: trimmedSchoolName || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
      .select('id, school_name')
      .maybeSingle()

    if (error) {
      console.error('[Profile] Error updating profile:', error)
      return res.status(500).json({ error: 'Failed to update profile', message: error.message })
    }

    // Best-effort: also mirror into auth user_metadata
    try {
      await supabase.auth.admin.updateUserById(req.userId, {
        user_metadata: {
          school_name: trimmedSchoolName || null,
        },
      })
    } catch {
      // ignore
    }

    return res.json({
      success: true,
      profile: {
        id: data?.id || req.userId,
        schoolName: data?.school_name || null,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to update profile'
    return res.status(500).json({ error: msg })
  }
})

export default router

