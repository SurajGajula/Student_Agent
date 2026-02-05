// Load environment variables first
import '../../load-env.js'

import express, { Response } from 'express'
import { createClient } from '@supabase/supabase-js'
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth.js'
import { findCoursesForSkill, SkillNode, CourseRecommendation } from './service.js'

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
 * Scan courses for a specific skill
 * This will:
 * 1. Check skill_nodes.cached_courses (shared cache across all users)
 * 2. If not cached, query courses from user's school
 * 3. Save results to skill_nodes.cached_courses
 */
router.post('/:skillId', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const { skillId } = req.params
    const { skillName, careerPathId, forceRescan, school } = req.body

    if (!skillId) {
      return res.status(400).json({ error: 'Skill ID is required' })
    }

    if (!careerPathId) {
      return res.status(400).json({ error: 'Career path ID is required' })
    }

    // Check skill cache first (shared across all users)
    const { data: skillCache, error: skillError } = await supabase
      .from('skill_nodes')
      .select('cached_courses, courses_last_scanned_at')
      .eq('skill_id', skillId)
      .maybeSingle()

    if (skillError) {
      console.error('[ScanCourses] Error fetching skill node:', skillError)
    }

    const cachedCourses = (skillCache?.cached_courses || []) as CourseRecommendation[]
    const coursesLastScanned = skillCache?.courses_last_scanned_at
    const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours cache TTL
    const now = Date.now()
    const cacheAge = coursesLastScanned ? now - new Date(coursesLastScanned).getTime() : Infinity

    // Use cache if available and not forcing rescan
    if (!forceRescan && cachedCourses.length > 0 && cacheAge < CACHE_TTL) {
      console.log(`[ScanCourses] Using cached results from skill_node for skill ${skillId} (${cachedCourses.length} courses)`)
      return res.json({
        courses: cachedCourses,
        cached: true
      })
    }

    console.log(`[ScanCourses] Scanning courses for skill ${skillId} in career path ${careerPathId}...`)

    // Get school from request body or fetch from user_profiles
    let userSchool = school && typeof school === 'string' ? school.trim() : null
    
    if (!userSchool) {
      // Try to fetch from user_profiles table
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
      .select('school_name')
      .eq('id', req.userId)
      .maybeSingle()

      if (profileError) {
        console.error('[ScanCourses] Error fetching user profile:', profileError)
      }
      
      userSchool = profileData?.school_name || null
    }

    if (!userSchool) {
      console.log('[ScanCourses] No school found for user')
      return res.json({
        courses: [],
        cached: false,
        message: 'No school found in profile. Please add your school in Settings.'
      })
    }

    // Fetch career path to get the skill nodes
    const { data: careerPathData, error: careerPathError } = await supabase
      .from('user_career_paths')
      .select('nodes')
      .eq('id', careerPathId)
      .eq('user_id', req.userId)
      .maybeSingle()

    if (careerPathError || !careerPathData) {
      console.error('[ScanCourses] Error fetching career path:', careerPathError)
      return res.status(404).json({ error: 'Career path not found' })
    }

    const allNodes = (careerPathData.nodes || []) as SkillNode[]

    // Find the specific skill node
    const skillNode = allNodes.find(n => n.skill_id === skillId)
    if (!skillNode) {
      return res.status(404).json({ error: 'Skill not found in career path' })
    }

    // Use the skill name from request or from the skill node
    const targetSkillName = skillName || skillNode.name
    console.log(`[ScanCourses] Finding courses for skill: "${targetSkillName}"`)

    // Query courses specifically for this skill using AI
    const coursesToReturn = await findCoursesForSkill(
      targetSkillName,
      userSchool,
      10 // Limit to top 10 courses
    )

    // Update skill cache with courses (shared across all users)
    await supabase
      .from('skill_nodes')
      .update({
        cached_courses: coursesToReturn,
        courses_last_scanned_at: new Date().toISOString()
      })
      .eq('skill_id', skillId)

    console.log(`[ScanCourses] Found ${coursesToReturn.length} relevant courses for skill ${skillId}`)
    console.log(`[ScanCourses] Updated skill cache with courses`)

    res.json({
      courses: coursesToReturn,
      cached: false
    })
  } catch (error) {
    console.error('Error in scanCoursesBySkill:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to scan courses by skill'
    res.status(500).json({ error: errorMessage })
  }
})

export default router
