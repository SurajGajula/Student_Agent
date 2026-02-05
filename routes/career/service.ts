// Load environment variables first
import '../../load-env.js'

import { createClient } from '@supabase/supabase-js'
import {
  getAccessToken,
  getProjectId,
  isVertexAI,
  getAuthClient,
} from '../../services/gemini.js'

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

export interface SkillNode {
  skill_id: string
  name: string
}

interface GeminiSkillResponse {
  nodes: Array<{
    name: string
  }>
}

export interface Course {
  id: string
  course_number: string
  name: string
  description: string | null
  prerequisites: string[] | null
  credits: number | null
  department: string | null
  semesters: string[] | null
}

export interface CourseRecommendation {
  course: Course
  relevanceScore: number
  reasoning: string
}

/**
 * Normalize role name for matching (handles variations like "fullstack" vs "full-stack")
 */
export function normalizeRole(role: string): string {
  return role
    .toLowerCase()
    .replace(/[-_\s]+/g, ' ') // Normalize separators
    .trim()
}

/**
 * Normalize company name for matching
 */
export function normalizeCompany(company: string): string {
  return company
    .toLowerCase()
    .replace(/[-_\s]+/g, ' ')
    .trim()
}

/**
 * Find or create target profile
 */
export async function findOrCreateTargetProfile(
  role: string,
  company: string,
  seniority: string = 'mid',
  major?: string
): Promise<string> {
  const normalizedRole = normalizeRole(role)
  const normalizedCompany = normalizeCompany(company)

  // Try to find existing target profile (fuzzy match)
  const { data: existing, error: findError } = await supabase
    .from('target_profiles')
    .select('target_id')
    .ilike('role', `%${normalizedRole}%`)
    .ilike('company', `%${normalizedCompany}%`)
    .eq('seniority', seniority)
    .eq('major', major || null)
    .limit(1)
    .maybeSingle()

  if (findError && findError.code !== 'PGRST116') {
    // PGRST116 is "no rows returned" which is fine, but other errors are not
    // Check if table doesn't exist
    if (findError.message?.includes('does not exist') || findError.code === '42P01') {
      throw new Error('Career path tables do not exist. Please run the SQL migration: supabase/migrations/create_career_path_tables.sql')
    }
    console.error('Error finding target profile:', findError)
    throw new Error(`Failed to find target profile: ${findError.message}`)
  }

  if (existing) {
    console.log(`Found existing target profile: ${existing.target_id}`)
    return existing.target_id
  }

  // Create new target profile
  const { data: newProfile, error } = await supabase
    .from('target_profiles')
    .insert({
      company: normalizedCompany,
      role: normalizedRole,
      seniority,
      major: major || null,
      discipline_bias: [],
      hiring_signals: [],
      evaluation_axes: []
    })
    .select('target_id')
    .single()

  if (error) {
      // If unique constraint violation, try to find again
      if (error.code === '23505') {
        const { data: found, error: findError2 } = await supabase
          .from('target_profiles')
          .select('target_id')
          .eq('company', normalizedCompany)
          .eq('role', normalizedRole)
          .eq('seniority', seniority)
          .eq('major', major || null)
          .limit(1)
          .maybeSingle()
        
        if (findError2 && findError2.code !== 'PGRST116') {
          console.error('Error finding target profile after conflict:', findError2)
        }
        
        if (found) {
          return found.target_id
        }
      }
    throw new Error(`Failed to create target profile: ${error.message}`)
  }

  console.log(`Created new target profile: ${newProfile.target_id}`)
  return newProfile.target_id
}

/**
 * Find or create skill node (reuse existing when possible)
 */
export async function findOrCreateSkillNode(
  name: string
): Promise<string> {
  // Try to find existing skill node
  const { data: existing, error: findError } = await supabase
    .from('skill_nodes')
    .select('skill_id')
    .eq('name', name)
    .limit(1)
    .maybeSingle()

  if (findError && findError.code !== 'PGRST116') {
    // PGRST116 is "no rows returned" which is fine, but other errors are not
    console.error('Error finding skill node:', findError)
    throw new Error(`Failed to find skill node: ${findError.message}`)
  }

  if (existing) {
    console.log(`Reusing existing skill node: ${existing.skill_id} (${name})`)
    return existing.skill_id
  }

  // Create new skill node
  const { data: newSkill, error } = await supabase
    .from('skill_nodes')
    .insert({
      name
    })
    .select('skill_id')
    .single()

  if (error) {
      // If unique constraint violation, try to find again
      if (error.code === '23505') {
        const { data: found, error: findError2 } = await supabase
          .from('skill_nodes')
          .select('skill_id')
          .eq('name', name)
          .maybeSingle()
        
        if (findError2 && findError2.code !== 'PGRST116') {
          console.error('Error finding skill node after conflict:', findError2)
        }
        
        if (found) {
          return found.skill_id
        }
      }
    throw new Error(`Failed to create skill node: ${error.message}`)
  }

  console.log(`Created new skill node: ${newSkill.skill_id} (${name})`)
  return newSkill.skill_id
}

/**
 * Generate skill graph using Gemini AI
 */
export async function generateSkillGraphWithGemini(
  role: string,
  company: string,
  seniority: string,
  major?: string
): Promise<{ nodes: SkillNode[] }> {
  // Service-account / Vertex AI only
  if (!isVertexAI() || !getAuthClient() || !getProjectId()) {
    throw new Error(
      'Gemini is not configured for Vertex AI. Ensure studentagent.json exists and the service account has the "Vertex AI User" role.'
    )
  }

  const projectId = getProjectId()
  if (!projectId) {
    throw new Error('Project ID not available')
  }

  const prompt = `Generate a comprehensive skill graph for a ${seniority}-level ${role} position at ${company}${major ? ` (${major} major)` : ''}.

Return a JSON object with this exact structure:
{
  "nodes": [
    {
      "name": "Skill name"
    }
  ]
}

Requirements:
1. Include 15-30 CONCRETE, SPECIFIC, OBJECTIVE, and VERIFIABLE skills - use specific technologies, tools, and techniques (e.g., "Algorithms", "Cloud Systems", "React", "Python", "Docker", "Kubernetes", "PostgreSQL", "GraphQL", "Machine Learning", "Distributed Systems", "TypeScript", "AWS", "TensorFlow", "Redis", "MongoDB")
2. STRICTLY FORBIDDEN - DO NOT include any of these generic or soft skills:
   - "Problem Solving", "Critical Thinking", "Analytical Thinking", "Logical Reasoning"
   - "Communication", "Teamwork", "Collaboration", "Leadership"
   - "Software Principles", "Best Practices", "Design Patterns" (unless referring to specific pattern names like "MVC", "Observer Pattern")
   - "Time Management", "Project Management" (unless specific tools like "Jira", "Asana")
   - Any abstract concepts that cannot be objectively verified or measured
3. Each skill must be:
   - A concrete technical capability (specific technology, tool, framework, language, system, or technique)
   - Objectively verifiable (can be tested, demonstrated, or certified)
   - Specific enough that someone can learn it and prove competency
4. Focus on skills actually needed for this role at this company
5. Make it realistic and actionable

Return ONLY valid JSON, no markdown formatting.`

  const accessToken = await getAccessToken()
  const location = 'us-central1'
  const vertexAIEndpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/gemini-2.5-flash:generateContent`

  console.log(`Calling Vertex AI endpoint for skill graph generation: ${vertexAIEndpoint}`)

  const response = await fetch(vertexAIEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [{ text: prompt }],
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 16384, // Increased to handle larger skill graphs
        responseMimeType: 'application/json',
      },
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    const errorMessage = errorData.error?.message || JSON.stringify(errorData)
    console.error('Vertex AI API error:', errorData)
    throw new Error(`Vertex AI API error: ${response.status} ${errorMessage}`)
  }

  const data = await response.json()
  
  let textResponse = ''
  if (data.candidates && data.candidates[0] && data.candidates[0].content) {
    const content = data.candidates[0].content
    if (content.parts && Array.isArray(content.parts)) {
      // Concatenate all parts in case of multi-part response
      textResponse = content.parts
        .map((part: any) => part.text || '')
        .join('')
    } else {
      throw new Error('Unexpected response format from Vertex AI: missing parts')
    }
  } else {
    throw new Error('Unexpected response format from Vertex AI')
  }

  if (!textResponse) {
    throw new Error('No response from Gemini API')
  }

  // Log response length for debugging
  console.log(`[Career Path] Received response length: ${textResponse.length} characters`)

  // Parse JSON response
  try {
    let cleanedResponse = textResponse.trim()
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.replace(/^```json\s*/i, '').replace(/\s*```$/g, '').trim()
    } else if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/g, '').trim()
    }

    const geminiResponse = JSON.parse(cleanedResponse) as GeminiSkillResponse

    if (!geminiResponse.nodes || !Array.isArray(geminiResponse.nodes)) {
      throw new Error('Invalid response format: missing nodes array')
    }

    // Create/find skill nodes and build node map
    const nodeMap = new Map<string, string>() // name -> skill_id
    const skillNodes: SkillNode[] = []

    // Filter out generic/soft skills
    const forbiddenSkills = [
      'problem solving', 'critical thinking', 'analytical thinking', 'logical reasoning',
      'communication', 'teamwork', 'collaboration', 'leadership',
      'software principles', 'best practices', 'time management', 'project management',
      'soft skills', 'interpersonal skills', 'emotional intelligence'
    ]

    for (const nodeData of geminiResponse.nodes) {
      const skillNameLower = nodeData.name.toLowerCase()
      const isForbidden = forbiddenSkills.some(forbidden => 
        skillNameLower.includes(forbidden) || forbidden.includes(skillNameLower)
      )

      if (isForbidden) {
        console.warn(`Filtering out generic skill: ${nodeData.name}`)
        continue
      }

      const skillId = await findOrCreateSkillNode(nodeData.name)

      nodeMap.set(nodeData.name, skillId)

      // Fetch the full node data
      const { data: node } = await supabase
        .from('skill_nodes')
        .select('skill_id, name')
        .eq('skill_id', skillId)
        .single()

      if (node) {
        skillNodes.push({
          skill_id: node.skill_id,
          name: node.name
        })
      }
    }

    return {
      nodes: skillNodes
    }
  } catch (error) {
    console.error('Error parsing Gemini response:', error)
    console.error('Raw response length:', textResponse.length)
    console.error('Raw response (first 2000 chars):', textResponse.substring(0, 2000))
    console.error('Raw response (last 500 chars):', textResponse.substring(Math.max(0, textResponse.length - 500)))
    
    // Check if response was truncated
    if (textResponse.length > 0 && !textResponse.trim().endsWith('}')) {
      console.warn('Response appears to be truncated - does not end with closing brace')
    }
    
    throw new Error(`Failed to parse Gemini response: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Get or generate skill graph for a target
 */
export async function getOrGenerateSkillGraph(
  targetId: string,
  role: string,
  company: string,
  seniority: string,
  major?: string
): Promise<{ graphId: string, nodes: SkillNode[] }> {
  // Check if graph already exists
  const { data: existingGraph, error: findGraphError } = await supabase
    .from('skill_graphs')
    .select('*')
    .eq('target_id', targetId)
    .eq('major', major || null)
    .maybeSingle()

  if (findGraphError && findGraphError.code !== 'PGRST116') {
    console.error('Error finding skill graph:', findGraphError)
    throw new Error(`Failed to find skill graph: ${findGraphError.message}`)
  }

  if (existingGraph && existingGraph.nodes && Array.isArray(existingGraph.nodes) && existingGraph.nodes.length > 0) {
    console.log(`Using existing skill graph: ${existingGraph.graph_id}`)
    return {
      graphId: existingGraph.graph_id,
      nodes: existingGraph.nodes as SkillNode[]
    }
  }

  // Generate new graph
  console.log(`Generating new skill graph for target: ${targetId}`)
  const { nodes } = await generateSkillGraphWithGemini(role, company, seniority, major)

  // Store graph
  const { data: newGraph, error } = await supabase
    .from('skill_graphs')
    .insert({
      target_id: targetId,
      nodes,
      major: major || null
    })
    .select('graph_id')
    .single()

  if (error) {
      // If unique constraint violation, try to fetch existing
      if (error.code === '23505') {
        const { data: found, error: findError2 } = await supabase
          .from('skill_graphs')
          .select('*')
          .eq('target_id', targetId)
          .eq('major', major || null)
          .maybeSingle()
        
        if (findError2 && findError2.code !== 'PGRST116') {
          console.error('Error finding skill graph after conflict:', findError2)
        }
        
        if (found) {
          return {
            graphId: found.graph_id,
            nodes: found.nodes as SkillNode[]
          }
        }
      }
    throw new Error(`Failed to create skill graph: ${error.message}`)
  }

  console.log(`Created new skill graph: ${newGraph.graph_id}`)
  return {
    graphId: newGraph.graph_id,
    nodes
  }
}

/**
 * Generate common abbreviations/variations for a school name
 */
function getSchoolVariations(school: string): string[] {
  const variations: string[] = [school]
  const lowerSchool = school.toLowerCase()
  
  // Handle "University of California, X" -> "UC X", "UCX"
  const ucMatch = lowerSchool.match(/university of california[,\s]+(\w+)/)
  if (ucMatch) {
    const campus = ucMatch[1]
    variations.push(`UC ${campus.charAt(0).toUpperCase() + campus.slice(1)}`)
    variations.push(`UC${campus.charAt(0).toUpperCase()}${campus.slice(1)}`)
    // Common abbreviations
    const abbrevMap: Record<string, string> = {
      'santa': 'UCSC',
      'berkeley': 'UCB',
      'los': 'UCLA',
      'san': 'UCSD',
      'davis': 'UCD',
      'irvine': 'UCI',
      'riverside': 'UCR',
      'merced': 'UCM',
    }
    if (abbrevMap[campus]) {
      variations.push(abbrevMap[campus])
    }
  }
  
  // Handle common patterns
  if (lowerSchool.includes('massachusetts institute')) {
    variations.push('MIT')
  }
  if (lowerSchool.includes('stanford')) {
    variations.push('Stanford')
    variations.push('Stanford University')
  }
  
  return [...new Set(variations)] // Remove duplicates
}

/**
 * Fetch courses from Supabase filtered by school
 */
async function getAllCourses(school?: string, department?: string): Promise<Course[]> {
  const deptUpper = department?.toUpperCase().trim() || ''
  
  if (!school || !school.trim()) {
    // No school filter - just query all (or by department)
    let query = supabase.from('course_directory').select('*')
    if (deptUpper) {
      query = query.ilike('course_code', `${deptUpper}%`)
    }
    const { data, error } = await query.order('course_code').limit(500)
  if (error) {
    console.error('Supabase query error:', error)
    throw new Error(`Failed to fetch courses: ${error.message}`)
  }
    return (data || []).map(course => ({
      id: course.id,
      course_number: course.course_code || course.course_number,
      name: course.course_name || course.name,
      description: course.description,
      prerequisites: course.prerequisites,
      credits: course.credits,
      department: course.department || (deptUpper || null),
      semesters: course.semesters || null,
    }))
  }
  
  // Get school name variations to try
  const schoolVariations = getSchoolVariations(school.trim())
  console.log(`[getAllCourses] Trying school variations: ${schoolVariations.join(', ')}`)
  
  // Try each variation
  for (const schoolVariant of schoolVariations) {
    // Try exact match first
    let query = supabase.from('course_directory').select('*').eq('school', schoolVariant)
    if (deptUpper) {
      query = query.ilike('course_code', `${deptUpper}%`)
    }
    
    const { data, error } = await query.order('course_code')
    
    if (!error && data && data.length > 0) {
      console.log(`[getAllCourses] Found ${data.length} courses with school="${schoolVariant}"`)
      return data.map(course => ({
        id: course.id,
        course_number: course.course_code || course.course_number,
        name: course.course_name || course.name,
        description: course.description,
        prerequisites: course.prerequisites,
        credits: course.credits,
        department: course.department || (deptUpper || null),
        semesters: course.semesters || null,
      }))
    }
  }
  
  // Try case-insensitive partial match as last resort
  console.log(`[getAllCourses] No exact match found. Trying partial match for: ${school}`)
    let fallbackQuery = supabase.from('course_directory').select('*')
    
  // Try matching any word from the school name
  const schoolWords = school.trim().split(/[\s,]+/).filter(w => w.length > 3)
  if (schoolWords.length > 0) {
    // Try matching the most specific word (usually the campus name)
    const searchWord = schoolWords[schoolWords.length - 1]
    fallbackQuery = fallbackQuery.ilike('school', `%${searchWord}%`)
  } else {
    fallbackQuery = fallbackQuery.ilike('school', `%${school.trim()}%`)
    }
    
    if (deptUpper) {
      fallbackQuery = fallbackQuery.ilike('course_code', `${deptUpper}%`)
    }
    
    const { data: fallbackData, error: fallbackError } = await fallbackQuery.order('course_code')
    
    if (!fallbackError && fallbackData && fallbackData.length > 0) {
    console.log(`[getAllCourses] Found ${fallbackData.length} courses with partial match`)
      return fallbackData.map(course => ({
        id: course.id,
        course_number: course.course_code || course.course_number,
        name: course.course_name || course.name,
        description: course.description,
        prerequisites: course.prerequisites,
        credits: course.credits,
        department: course.department || (deptUpper || null),
        semesters: course.semesters || null,
      }))
    }

  // Final fallback: return ALL courses (no school filter) and let AI filter by relevance
  console.log(`[getAllCourses] No courses found for school: ${school}. Falling back to all courses.`)
  let allCoursesQuery = supabase.from('course_directory').select('*')
  if (deptUpper) {
    allCoursesQuery = allCoursesQuery.ilike('course_code', `${deptUpper}%`)
  }
  const { data: allCoursesData, error: allCoursesError } = await allCoursesQuery.order('course_code').limit(500)
  
  if (!allCoursesError && allCoursesData && allCoursesData.length > 0) {
    console.log(`[getAllCourses] Returning ${allCoursesData.length} courses (all schools) for AI to filter`)
    return allCoursesData.map(course => ({
    id: course.id,
      course_number: course.course_code || course.course_number,
      name: course.course_name || course.name,
    description: course.description,
    prerequisites: course.prerequisites,
    credits: course.credits,
      department: course.department || (deptUpper || null),
      semesters: course.semesters || null,
  }))
  }

  console.log(`[getAllCourses] No courses found in database at all`)
  return []
}

/**
 * Use Gemini to find courses relevant to a career path
 */
export async function findRelevantCoursesForCareerPath(
  role: string,
  company: string,
  seniority: string,
  skills: SkillNode[],
  school: string,
  major?: string,
  limit: number = 10
): Promise<CourseRecommendation[]> {
  // If no school provided, return empty array
  if (!school || !school.trim()) {
    console.log('[Career Path] No school provided, skipping course recommendations')
    return []
  }

  // Service-account / Vertex AI only
  if (!isVertexAI() || !getAuthClient() || !getProjectId()) {
    console.warn('[Career Path] Gemini not configured, skipping course recommendations')
    return []
  }

  try {
    // Fetch courses from the user's school
    const allCourses = await getAllCourses(school.trim(), major?.trim())

    if (allCourses.length === 0) {
      console.log(`[Career Path] No courses found for school: ${school}`)
      return []
    }

    console.log(`[Career Path] Found ${allCourses.length} courses for school: ${school}`)

    // Build query from career path context
    const skillsList = skills.map(s => s.name).join(', ')
    const query = `${seniority}-level ${role} at ${company}${major ? ` (${major} major)` : ''}. Skills needed: ${skillsList}`

    // Use Gemini to find relevant courses
    const projectId = getProjectId()
    if (!projectId) {
      throw new Error('Project ID not available')
    }

    // Format courses for the prompt
    const coursesContext = allCourses.map((course, index) => {
      const prereqs = course.prerequisites?.join(', ') || 'None'
      const semesters = course.semesters?.join(', ') || 'Not specified'
      return `
${index + 1}. ${course.course_number}: ${course.name}
   Description: ${course.description || 'No description'}
   Prerequisites: ${prereqs}
   Credits: ${course.credits || 'Not specified'}
   ${course.semesters ? `Semesters: ${semesters}` : ''}`
    }).join('\n')

    const prompt = `You are a course recommendation assistant. 
Given a user's career path goal, recommend the most relevant courses from the EXACT list provided below.

IMPORTANT: You MUST ONLY use courses from the list provided. Do NOT invent, create, or reference any courses that are not in the list. Only use the index numbers that correspond to courses in the provided list.

Career Path Query: "${query}"

Available Courses (use ONLY these courses):
${coursesContext}

Please respond with a JSON array of objects, where each object has:
- index: The number from the list above (1-based, must be between 1 and ${allCourses.length})
- relevanceScore: A number from 0-100 indicating how relevant the course is
- reasoning: A brief explanation of why this course is recommended (keep it concise, under 200 characters)

Return ONLY a valid JSON array, no other text. Order by relevanceScore descending. Limit to top ${limit} recommendations.
Example format:
[
  {"index": 5, "relevanceScore": 95, "reasoning": "Directly aligns with machine learning career goals"},
  {"index": 12, "relevanceScore": 85, "reasoning": "Provides foundational knowledge in algorithms"}
]`

    const accessToken = await getAccessToken()
    const location = 'us-central1'
    const vertexAIEndpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/gemini-2.5-flash:generateContent`

    console.log(`[Career Path] Calling Vertex AI endpoint for course recommendations: ${vertexAIEndpoint}`)

    const response = await fetch(vertexAIEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{ text: prompt }],
        }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
        },
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.error?.message || JSON.stringify(errorData)
      console.error('[Career Path] Vertex AI API error for courses:', errorData)
      // Don't throw - just return empty array if course recommendation fails
      return []
    }

    const data = await response.json()
    
    // Extract text from response
    let textResponse = ''
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      const content = data.candidates[0].content
      if (content.parts && Array.isArray(content.parts)) {
        textResponse = content.parts
          .map((part: any) => part.text || '')
          .join('')
      } else {
        console.warn('[Career Path] Unexpected response format from Vertex AI for courses: missing parts')
        return []
      }
    } else {
      console.warn('[Career Path] Unexpected response format from Vertex AI for courses')
      return []
    }

    if (!textResponse) {
      console.warn('[Career Path] No response from Gemini API for courses')
      return []
    }

    // Parse JSON response
    try {
      let cleanedResponse = textResponse.trim()
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/i, '').replace(/\s*```$/g, '').trim()
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/g, '').trim()
      }

      // Check if response looks truncated
      if (!cleanedResponse.endsWith(']')) {
        console.warn('[Career Path] Course response may be truncated - attempting to fix incomplete JSON')
        const lastCompleteBrace = cleanedResponse.lastIndexOf('}')
        if (lastCompleteBrace > 0) {
          cleanedResponse = cleanedResponse.substring(0, lastCompleteBrace + 1) + ']'
        }
      }

      const recommendations = JSON.parse(cleanedResponse) as Array<{
        index: number
        relevanceScore: number
        reasoning: string
      }>

      if (!Array.isArray(recommendations)) {
        throw new Error('Invalid response format: expected JSON array')
      }

      // Validate and filter recommendations
      const validRecommendations = recommendations
        .slice(0, limit)
        .map(rec => {
          if (!rec.index || rec.index < 1 || rec.index > allCourses.length) {
            console.warn(`[Career Path] Invalid index ${rec.index} provided by Gemini (valid range: 1-${allCourses.length}). Skipping.`)
            return null
          }
          
          const course = allCourses[rec.index - 1] // Convert 1-based to 0-based
          if (!course || !course.course_number || !course.name) {
            console.warn(`[Career Path] Course at index ${rec.index} missing required fields. Skipping.`)
            return null
          }
          
          const reasoning = (rec.reasoning || '').substring(0, 500)
          
          return {
            course,
            relevanceScore: Math.min(100, Math.max(0, rec.relevanceScore || 0)),
            reasoning: reasoning || 'Recommended based on career path relevance'
          }
        })
        .filter((item): item is CourseRecommendation => item !== null)

      console.log(`[Career Path] Successfully validated ${validRecommendations.length} course recommendations`)
      return validRecommendations
    } catch (error) {
      console.error('[Career Path] Error parsing Gemini response for courses:', error)
      // Don't throw - just return empty array if parsing fails
      return []
    }
  } catch (error) {
    console.error('[Career Path] Error finding relevant courses:', error)
    // Don't throw - just return empty array if course recommendation fails
    return []
  }
}

/**
 * Use Gemini to find courses relevant to a SPECIFIC SKILL
 * This is more focused than findRelevantCoursesForCareerPath which considers all skills
 */
export async function findCoursesForSkill(
  skillName: string,
  school?: string,
  limit: number = 10
): Promise<CourseRecommendation[]> {
  // Service-account / Vertex AI only
  if (!isVertexAI() || !getAuthClient() || !getProjectId()) {
    console.warn('[FindCoursesForSkill] Gemini not configured, skipping course recommendations')
    return []
  }

  try {
    // Fetch courses (school is optional, will fall back to all courses)
    const allCourses = await getAllCourses(school?.trim())

    if (allCourses.length === 0) {
      console.log(`[FindCoursesForSkill] No courses found in database`)
      return []
    }

    console.log(`[FindCoursesForSkill] Found ${allCourses.length} courses to search for skill: ${skillName}`)

    // Use Gemini to find relevant courses
    const projectId = getProjectId()
    if (!projectId) {
      throw new Error('Project ID not available')
    }

    // Format courses for the prompt
    const coursesContext = allCourses.map((course, index) => {
      const prereqs = course.prerequisites?.join(', ') || 'None'
      return `
${index + 1}. ${course.course_number}: ${course.name}
   Description: ${course.description || 'No description'}
   Prerequisites: ${prereqs}
   Credits: ${course.credits || 'Not specified'}`
    }).join('\n')

    const prompt = `You are a course recommendation assistant. 
Find courses that would help someone learn or improve the skill: "${skillName}"

IMPORTANT RULES:
1. You MUST ONLY use courses from the list provided below
2. Do NOT invent or reference any courses not in the list
3. Only recommend courses that are DIRECTLY relevant to learning "${skillName}"
4. Consider course descriptions, names, and typical curriculum when determining relevance
5. If a course teaches fundamentals needed for the skill, include it

Skill to find courses for: "${skillName}"

Available Courses (use ONLY these courses):
${coursesContext}

Respond with a JSON array of objects, where each object has:
- index: The number from the list above (1-based, must be between 1 and ${allCourses.length})
- relevanceScore: A number from 0-100 indicating how relevant the course is to learning "${skillName}"
- reasoning: A brief explanation of how this course helps learn "${skillName}" (under 200 characters)

Return ONLY a valid JSON array, no other text. Order by relevanceScore descending. Limit to top ${limit} most relevant courses.
If no courses are relevant, return an empty array: []

Example format:
[
  {"index": 5, "relevanceScore": 95, "reasoning": "Directly teaches ${skillName} fundamentals"},
  {"index": 12, "relevanceScore": 85, "reasoning": "Covers prerequisites needed for ${skillName}"}
]`

    const accessToken = await getAccessToken()
    const location = 'us-central1'
    const vertexAIEndpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/gemini-2.5-flash:generateContent`

    console.log(`[FindCoursesForSkill] Calling Vertex AI for skill: ${skillName}`)

    const response = await fetch(vertexAIEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{ text: prompt }],
        }],
        generationConfig: {
          temperature: 0.2, // Lower temperature for more focused results
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
        },
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('[FindCoursesForSkill] Vertex AI API error:', errorData)
      return []
    }

    const data = await response.json()
    
    // Extract text from response
    let textResponse = ''
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      const content = data.candidates[0].content
      if (content.parts && Array.isArray(content.parts)) {
        textResponse = content.parts
          .map((part: any) => part.text || '')
          .join('')
      } else {
        console.warn('[FindCoursesForSkill] Unexpected response format: missing parts')
        return []
      }
    } else {
      console.warn('[FindCoursesForSkill] Unexpected response format from Vertex AI')
      return []
    }

    if (!textResponse) {
      console.warn('[FindCoursesForSkill] No response from Gemini API')
      return []
    }

    // Parse JSON response
    try {
      let cleanedResponse = textResponse.trim()
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/i, '').replace(/\s*```$/g, '').trim()
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/g, '').trim()
      }

      // Check if response looks truncated
      if (!cleanedResponse.endsWith(']')) {
        const lastCompleteBrace = cleanedResponse.lastIndexOf('}')
        if (lastCompleteBrace > 0) {
          cleanedResponse = cleanedResponse.substring(0, lastCompleteBrace + 1) + ']'
        }
      }

      const recommendations = JSON.parse(cleanedResponse) as Array<{
        index: number
        relevanceScore: number
        reasoning: string
      }>

      if (!Array.isArray(recommendations)) {
        throw new Error('Invalid response format: expected JSON array')
      }

      // Validate and filter recommendations
      const validRecommendations = recommendations
        .slice(0, limit)
        .map(rec => {
          if (!rec.index || rec.index < 1 || rec.index > allCourses.length) {
            console.warn(`[FindCoursesForSkill] Invalid index ${rec.index}. Skipping.`)
            return null
          }
          
          const course = allCourses[rec.index - 1]
          if (!course || !course.course_number || !course.name) {
            return null
          }
          
          const reasoning = (rec.reasoning || '').substring(0, 500)
          
          return {
            course,
            relevanceScore: Math.min(100, Math.max(0, rec.relevanceScore || 0)),
            reasoning: reasoning || `Relevant to learning ${skillName}`
          }
        })
        .filter((item): item is CourseRecommendation => item !== null)

      console.log(`[FindCoursesForSkill] Found ${validRecommendations.length} courses for skill: ${skillName}`)
      return validRecommendations
    } catch (error) {
      console.error('[FindCoursesForSkill] Error parsing response:', error)
      return []
    }
  } catch (error) {
    console.error('[FindCoursesForSkill] Error:', error)
    return []
  }
}
