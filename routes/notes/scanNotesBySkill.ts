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

// In-memory cache for scan results (skillId -> { noteIds: string[], lastScanned: number })
// In production, consider using Redis or database for persistence
const scanCache = new Map<string, { noteIds: string[], lastScanned: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes cache TTL

const router = express.Router()

/**
 * Scan all notes for a specific skill, with caching
 * This will:
 * 1. Check cache first
 * 2. If cache miss or expired, scan all notes
 * 3. Auto-tag notes that don't have the skill but should
 * 4. Return all notes with the skill
 */
router.post('/:skillId', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const { skillId } = req.params
    const { forceRescan } = req.body

    if (!skillId) {
      return res.status(400).json({ error: 'Skill ID is required' })
    }

    const cacheKey = `${req.userId}:${skillId}`
    const cached = scanCache.get(cacheKey)
    const now = Date.now()

    // Check cache if not forcing rescan
    if (!forceRescan && cached && (now - cached.lastScanned) < CACHE_TTL) {
      console.log(`[ScanNotes] Using cached results for skill ${skillId}`)
      
      // Fetch full note data for cached IDs
      const { data: notes, error } = await supabase
        .from('notes')
        .select('id, name, content, skill_ids, created_at, updated_at')
        .eq('user_id', req.userId)
        .in('id', cached.noteIds)
        .order('updated_at', { ascending: false })

      if (error) {
        console.error('Error fetching cached notes:', error)
        // Fall through to rescan
      } else {
        const transformedNotes = (notes || []).map((note: any) => ({
          id: note.id,
          name: note.name,
          content: note.content || '',
          skillIds: note.skill_ids || [],
          createdAt: note.created_at,
          updatedAt: note.updated_at,
        }))

        return res.json({
          noteIds: cached.noteIds,
          notes: transformedNotes,
          cached: true
        })
      }
    }

    console.log(`[ScanNotes] Scanning all notes for skill ${skillId}...`)

    // First, get notes that already have this skill using Supabase's JSONB contains operator
    const { data: notesWithSkillData, error: notesWithSkillError } = await supabase
      .from('notes')
      .select('id, name, content, skill_ids')
      .eq('user_id', req.userId)
      .contains('skill_ids', [skillId])

    if (notesWithSkillError) {
      console.error('Error fetching notes with skill:', notesWithSkillError)
    }

    const notesWithSkill: string[] = (notesWithSkillData || []).map((note: any) => note.id)
    console.log(`[ScanNotes] Found ${notesWithSkill.length} notes already tagged with skill ${skillId}`)

    // Get all user's notes to check for untagged ones
    const { data: allNotes, error: fetchError } = await supabase
      .from('notes')
      .select('id, name, content, skill_ids')
      .eq('user_id', req.userId)

    if (fetchError) {
      console.error('Error fetching notes for scan:', fetchError)
      return res.status(500).json({ error: 'Failed to fetch notes', message: fetchError.message })
    }

    const notesToTag: Array<{ id: string, name: string, content: string }> = []
    const alreadyTaggedIds = new Set(notesWithSkill)

    // Check notes that don't have the skill yet
    for (const note of allNotes || []) {
      // Skip if already tagged
      if (alreadyTaggedIds.has(note.id)) {
        continue
      }

      if (note.content && note.content.trim().length > 100) {
        // Note doesn't have skill but has content - check if it should be tagged
        // We'll do a quick keyword check first to avoid expensive AI calls
        const contentLower = note.content.toLowerCase()
        const skillName = req.body.skillName || '' // Pass skill name from frontend if available
        
        // Quick keyword match - if skill name appears in content, it's likely relevant
        if (skillName && contentLower.includes(skillName.toLowerCase())) {
          notesToTag.push({
            id: note.id,
            name: note.name,
            content: note.content
          })
        }
      }
    }

    // Auto-tag notes that should have this skill
    if (notesToTag.length > 0) {
      console.log(`[ScanNotes] Auto-tagging ${notesToTag.length} notes with skill ${skillId}`)
      
      for (const note of notesToTag) {
        try {
          // Use autoTagSkills to check if this note should have this skill
          const matchedSkills = await autoTagSkills(req.userId, note.content, note.name)
          
          if (matchedSkills.includes(skillId)) {
            // Add skill to note
            const currentSkillIds = (allNotes?.find(n => n.id === note.id)?.skill_ids || []) as string[]
            if (!currentSkillIds.includes(skillId)) {
              const updatedSkillIds = [...currentSkillIds, skillId]
              
              await supabase
                .from('notes')
                .update({ skill_ids: updatedSkillIds })
                .eq('id', note.id)
                .eq('user_id', req.userId)
              
              notesWithSkill.push(note.id)
              console.log(`[ScanNotes] Auto-tagged note "${note.name}" with skill ${skillId}`)
            }
          }
        } catch (tagError) {
          console.error(`[ScanNotes] Error auto-tagging note ${note.id}:`, tagError)
          // Continue with other notes
        }
      }
    }

    // Fetch full note data
    const { data: notes, error: notesError } = await supabase
      .from('notes')
      .select('id, name, content, skill_ids, created_at, updated_at')
      .eq('user_id', req.userId)
      .in('id', notesWithSkill)
      .order('updated_at', { ascending: false })

    if (notesError) {
      console.error('Error fetching notes:', notesError)
      return res.status(500).json({ error: 'Failed to fetch notes', message: notesError.message })
    }

    const transformedNotes = (notes || []).map((note: any) => ({
      id: note.id,
      name: note.name,
      content: note.content || '',
      skillIds: note.skill_ids || [],
      createdAt: note.created_at,
      updatedAt: note.updated_at,
    }))

    // Update cache
    scanCache.set(cacheKey, {
      noteIds: notesWithSkill,
      lastScanned: now
    })

    console.log(`[ScanNotes] Found ${notesWithSkill.length} notes with skill ${skillId}`)

    res.json({
      noteIds: notesWithSkill,
      notes: transformedNotes,
      cached: false,
      autoTagged: notesToTag.length
    })
  } catch (error) {
    console.error('Error in scanNotesBySkill:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to scan notes by skill'
    res.status(500).json({ error: errorMessage })
  }
})

export default router
