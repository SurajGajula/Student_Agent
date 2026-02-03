// Load environment variables first
import '../../load-env.js'

import express, { Response } from 'express'
import { createClient } from '@supabase/supabase-js'
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth.js'
import { autoTagSkills } from './autoTagSkills.js'

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

    const { name, skillIds, content } = req.body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Note name is required' })
    }

    // Auto-tag skills if content is provided and skillIds are not explicitly provided
    let finalSkillIds: string[] = Array.isArray(skillIds) ? skillIds : []
    if (content && typeof content === 'string' && content.trim() && finalSkillIds.length === 0) {
      try {
        const autoTaggedSkills = await autoTagSkills(req.userId, content.trim(), name.trim())
        finalSkillIds = autoTaggedSkills
        console.log(`Auto-tagged note "${name}" with ${autoTaggedSkills.length} skills`)
      } catch (error) {
        console.error('Error auto-tagging skills:', error)
        // Continue without auto-tagging if it fails
      }
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
        .from('notes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', req.userId)

      if (count !== null && count >= 10) {
        return res.status(403).json({
          error: 'Free plan limit reached: You can only have 10 notes. Upgrade to add more.'
        })
      }
    }

    const { data, error } = await supabase
      .from('notes')
      .insert({
        user_id: req.userId,
        name: name.trim(),
        content: (content && typeof content === 'string') ? content.trim() : '',
        skill_ids: finalSkillIds,
      })
      .select()
      .single()

    if (error) {
      console.error('Error adding note:', error)
      return res.status(500).json({ error: 'Failed to add note', message: error.message })
    }

    // Transform to camelCase
    const newNote = {
      id: data.id,
      name: data.name,
      content: data.content || '',
      skillIds: data.skill_ids || [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }

    res.json(newNote)
  } catch (error) {
    console.error('Error in addNote:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to add note'
    res.status(500).json({ error: errorMessage })
  }
})

export default router

