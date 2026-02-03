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

router.put('/update/:id', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const { id } = req.params
    const { content, skillIds } = req.body

    if (content === undefined && skillIds === undefined) {
      return res.status(400).json({ error: 'Either content or skillIds is required' })
    }

    // Get existing note to check if we need to auto-tag
    const { data: existingNote } = await supabase
      .from('notes')
      .select('name, content, skill_ids')
      .eq('id', id)
      .eq('user_id', req.userId)
      .single()

    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    let finalSkillIds: string[] | undefined = undefined

    if (content !== undefined) {
      updateData.content = typeof content === 'string' ? content : ''
      
      // Auto-tag skills if content is being updated and skillIds are not explicitly provided
      // Only auto-tag if content changed significantly (more than 50 chars difference)
      // AND if note doesn't already have skills tagged (to avoid overwriting manual tags)
      const newContent = typeof content === 'string' ? content.trim() : ''
      const oldContent = existingNote?.content || ''
      const existingSkillIds = existingNote?.skill_ids || []
      const contentChanged = Math.abs(newContent.length - oldContent.length) > 50 || 
                            newContent.substring(0, 100) !== oldContent.substring(0, 100)
      
      if (newContent && contentChanged && skillIds === undefined && existingSkillIds.length === 0) {
        try {
          const autoTaggedSkills = await autoTagSkills(
            req.userId, 
            newContent, 
            existingNote?.name || 'Untitled'
          )
          finalSkillIds = autoTaggedSkills
          console.log(`Auto-tagged note "${existingNote?.name || id}" with ${autoTaggedSkills.length} skills`)
        } catch (error) {
          console.error('Error auto-tagging skills:', error)
          // Continue without auto-tagging if it fails
        }
      }
    }

    if (skillIds !== undefined) {
      updateData.skill_ids = Array.isArray(skillIds) ? skillIds : []
    } else if (finalSkillIds !== undefined) {
      updateData.skill_ids = finalSkillIds
    }

    const { data, error } = await supabase
      .from('notes')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', req.userId)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Note not found' })
      }
      console.error('Error updating note:', error)
      return res.status(500).json({ error: 'Failed to update note', message: error.message })
    }

    // Transform to camelCase
    const updatedNote = {
      id: data.id,
      name: data.name,
      content: data.content || '',
      skillIds: data.skill_ids || [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }

    res.json(updatedNote)
  } catch (error) {
    console.error('Error in updateNote:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to update note'
    res.status(500).json({ error: errorMessage })
  }
})

export default router

