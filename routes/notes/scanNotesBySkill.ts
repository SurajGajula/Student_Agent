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

/**
 * Get notes for a specific skill
 * This will:
 * 1. First check skill_nodes.cached_note_ids (shared cache across all users)
 * 2. If not cached, query notes that already have this skill tagged (fast)
 * 3. Optionally do full scan with auto-tagging if requested
 * 4. Save results to skill_nodes.cached_note_ids
 */
router.post('/:skillId', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const { skillId } = req.params
    const { forceRescan, fullScan } = req.body

    if (!skillId) {
      return res.status(400).json({ error: 'Skill ID is required' })
    }

    // Check skill cache first (shared across all users)
    const { data: skillNode, error: skillError } = await supabase
      .from('skill_nodes')
      .select('cached_note_ids, notes_last_scanned_at')
      .eq('skill_id', skillId)
      .maybeSingle()

    if (skillError) {
      console.error('[ScanNotes] Error fetching skill node:', skillError)
    }

    const cachedNoteIds = (skillNode?.cached_note_ids || []) as string[]
    const notesLastScanned = skillNode?.notes_last_scanned_at
    const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours cache TTL
    const now = Date.now()
    const cacheAge = notesLastScanned ? now - new Date(notesLastScanned).getTime() : Infinity

    // Use cache if available and not forcing rescan
    if (!forceRescan && cachedNoteIds.length > 0 && cacheAge < CACHE_TTL) {
      console.log(`[ScanNotes] Using cached results from skill_node for skill ${skillId} (${cachedNoteIds.length} notes)`)
      
      // Fetch full note data for cached IDs (only user's notes)
      const { data: notes, error } = await supabase
        .from('notes')
        .select('id, name, content, skill_ids, created_at, updated_at')
        .eq('user_id', req.userId)
        .in('id', cachedNoteIds)
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
          noteIds: transformedNotes.map(n => n.id),
          notes: transformedNotes,
          cached: true
        })
      }
    }

    console.log(`[ScanNotes] Scanning notes for skill ${skillId}...`)

    // First, get notes that already have this skill tagged (fast query)
    const { data: allUserNotes, error: fetchError } = await supabase
      .from('notes')
      .select('id, name, content, skill_ids')
      .eq('user_id', req.userId)

    if (fetchError) {
      console.error('Error fetching notes for scan:', fetchError)
      return res.status(500).json({ error: 'Failed to fetch notes', message: fetchError.message })
    }

    // Get skill name for keyword matching
    const skillName = req.body.skillName || ''
    
    // First, get the skill name from skill_nodes if not provided
    let actualSkillName = skillName
    if (!actualSkillName) {
      const { data: skillNodeData } = await supabase
        .from('skill_nodes')
        .select('name')
        .eq('skill_id', skillId)
        .maybeSingle()
      
      if (skillNodeData?.name) {
        actualSkillName = skillNodeData.name
      }
    }

    // Filter notes that already have this skill
    const notesWithSkill: string[] = []
    const alreadyTaggedIds = new Set<string>()
    
    for (const note of allUserNotes || []) {
      const skillIds = (note.skill_ids || []) as string[]
      if (Array.isArray(skillIds) && skillIds.includes(skillId)) {
        notesWithSkill.push(note.id)
        alreadyTaggedIds.add(note.id)
      }
    }
    
    console.log(`[ScanNotes] Found ${notesWithSkill.length} notes already tagged with skill ${skillId}`)

    // Also do keyword-based matching to find notes that should have this skill
    // This helps find notes even if they haven't been auto-tagged yet
    const notesToTag: Array<{ id: string, name: string, content: string }> = []
    const skillNameLower = actualSkillName ? actualSkillName.toLowerCase() : ''
    const skillKeywords = skillNameLower ? skillNameLower.split(/[\s\-_/]+/).filter(k => k.length > 2) : []
    
    // Check notes that don't have the skill yet
    for (const note of allUserNotes || []) {
      // Skip if already tagged
      if (alreadyTaggedIds.has(note.id)) {
        continue
      }

      if (note.content && note.content.trim().length > 50) {
        const contentLower = note.content.toLowerCase()
        const noteNameLower = (note.name || '').toLowerCase()
        const combinedText = `${noteNameLower} ${contentLower}`
        
        // Check if skill name or keywords appear in content
        let shouldTag = false
        
        if (skillNameLower) {
          // Direct match: skill name appears in content
          if (combinedText.includes(skillNameLower)) {
            shouldTag = true
          }
          // Keyword match: significant keywords from skill name appear
          else if (skillKeywords.length > 0) {
            const significantKeywords = skillKeywords.filter(k => k.length > 3)
            if (significantKeywords.length > 0 && significantKeywords.some(keyword => combinedText.includes(keyword))) {
              shouldTag = true
            }
          }
        }
        
        if (shouldTag) {
          notesToTag.push({
            id: note.id,
            name: note.name,
            content: note.content
          })
        }
      }
    }
    
    console.log(`[ScanNotes] Found ${notesToTag.length} notes with matching keywords for skill "${actualSkillName}"`)

    // If fullScan is requested, do full auto-tagging with AI
    // Otherwise, just use keyword matches for immediate results

    // Auto-tag notes that should have this skill
    if (notesToTag.length > 0) {
      if (fullScan) {
        // Full scan: Use AI to verify and tag
        console.log(`[ScanNotes] Full auto-tagging ${notesToTag.length} notes with skill ${skillId} using AI`)
        
        for (const note of notesToTag) {
          try {
            // Use autoTagSkills to check if this note should have this skill
            const matchedSkills = await autoTagSkills(req.userId, note.content, note.name)
            
            if (matchedSkills.includes(skillId)) {
              // Add skill to note
              const currentSkillIds = (allUserNotes?.find(n => n.id === note.id)?.skill_ids || []) as string[]
              if (!currentSkillIds.includes(skillId)) {
                const updatedSkillIds = [...currentSkillIds, skillId]
                
                const { error: updateError } = await supabase
                  .from('notes')
                  .update({ skill_ids: updatedSkillIds })
                  .eq('id', note.id)
                  .eq('user_id', req.userId)
                
                if (updateError) {
                  console.error(`[ScanNotes] Error updating note ${note.id}:`, updateError)
                } else {
                  notesWithSkill.push(note.id)
                  console.log(`[ScanNotes] Auto-tagged note "${note.name}" with skill ${skillId}`)
                }
              }
            }
          } catch (tagError) {
            console.error(`[ScanNotes] Error auto-tagging note ${note.id}:`, tagError)
            // Continue with other notes
          }
        }
      } else {
        // Quick scan: Just tag based on keyword match (faster, no AI call)
        console.log(`[ScanNotes] Quick-tagging ${notesToTag.length} notes with skill ${skillId} based on keywords`)
        
        for (const note of notesToTag) {
          try {
            const currentSkillIds = (allUserNotes?.find(n => n.id === note.id)?.skill_ids || []) as string[]
            if (!currentSkillIds.includes(skillId)) {
              const updatedSkillIds = [...currentSkillIds, skillId]
              
              const { error: updateError } = await supabase
                .from('notes')
                .update({ skill_ids: updatedSkillIds })
                .eq('id', note.id)
                .eq('user_id', req.userId)
              
              if (updateError) {
                console.error(`[ScanNotes] Error updating note ${note.id}:`, updateError)
              } else {
                notesWithSkill.push(note.id)
                console.log(`[ScanNotes] Quick-tagged note "${note.name}" with skill ${skillId} (keyword match)`)
              }
            }
          } catch (tagError) {
            console.error(`[ScanNotes] Error tagging note ${note.id}:`, tagError)
            // Continue with other notes
          }
        }
      }
    }

    // After auto-tagging (if fullScan), re-fetch all notes to get the latest skill_ids
    let finalNotesWithSkill = [...notesWithSkill]
    if (fullScan && notesToTag.length > 0) {
      const { data: allNotesAfterTagging, error: refetchError } = await supabase
        .from('notes')
        .select('id, name, content, skill_ids, created_at, updated_at')
        .eq('user_id', req.userId)

      if (refetchError) {
        console.error('Error re-fetching notes after tagging:', refetchError)
      } else {
        // Re-filter notes that have this skill
        finalNotesWithSkill = []
        for (const note of allNotesAfterTagging || []) {
          const skillIds = (note.skill_ids || []) as string[]
          if (Array.isArray(skillIds) && skillIds.includes(skillId)) {
            finalNotesWithSkill.push(note.id)
          }
        }
      }
    }

    // Fetch full note data
    let finalTransformedNotes: any[] = []
    if (finalNotesWithSkill.length > 0) {
      const { data: notes, error: notesError } = await supabase
        .from('notes')
        .select('id, name, content, skill_ids, created_at, updated_at')
        .eq('user_id', req.userId)
        .in('id', finalNotesWithSkill)
        .order('updated_at', { ascending: false })

      if (notesError) {
        console.error('Error fetching notes:', notesError)
        return res.status(500).json({ error: 'Failed to fetch notes', message: notesError.message })
      }

      finalTransformedNotes = (notes || []).map((note: any) => ({
        id: note.id,
        name: note.name,
        content: note.content || '',
        skillIds: note.skill_ids || [],
        createdAt: note.created_at,
        updatedAt: note.updated_at,
      }))
    }

    // Update skill cache with all note IDs (union of all users' notes with this skill)
    // Only update if we found notes or did a full scan (to keep cache fresh)
    if (finalTransformedNotes.length > 0 || fullScan) {
      // Get all note IDs across all users that have this skill
      // Fetch all notes and filter in JavaScript (avoiding .contains() JSONB issue)
      const { data: allNotes, error: allNotesError } = await supabase
        .from('notes')
        .select('id, skill_ids')

      if (!allNotesError && allNotes) {
        // Filter notes that have this skill
        const allNoteIds: string[] = []
        for (const note of allNotes) {
          const skillIds = (note.skill_ids || []) as string[]
          if (Array.isArray(skillIds) && skillIds.includes(skillId)) {
            allNoteIds.push(note.id)
          }
        }
        
        await supabase
          .from('skill_nodes')
          .update({
            cached_note_ids: allNoteIds,
            notes_last_scanned_at: new Date().toISOString()
          })
          .eq('skill_id', skillId)
        
        console.log(`[ScanNotes] Updated skill cache with ${allNoteIds.length} note IDs`)
      } else if (allNotesError) {
        console.error('[ScanNotes] Error fetching all notes for cache update:', allNotesError)
      }
    }

    console.log(`[ScanNotes] Found ${finalTransformedNotes.length} notes with skill ${skillId} (user's notes)`)

    res.json({
      noteIds: finalTransformedNotes.map(n => n.id),
      notes: finalTransformedNotes,
      cached: false,
      autoTagged: fullScan ? notesToTag.length : 0
    })
  } catch (error) {
    console.error('Error in scanNotesBySkill:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to scan notes by skill'
    res.status(500).json({ error: errorMessage })
  }
})

export default router
