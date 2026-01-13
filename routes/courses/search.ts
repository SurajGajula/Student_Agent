// Load environment variables first
import '../../load-env.js'

import express, { Response } from 'express'
import { createClient } from '@supabase/supabase-js'
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth.js'
import { getAccessToken, getProjectId, isVertexAI, getAuthClient } from '../../services/gemini.js'

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

interface Course {
  id: string
  course_number: string
  name: string
  description: string | null
  prerequisites: string[] | null
  credits: number | null
  department: string | null
  semesters: string[] | null
}

interface CourseRecommendation {
  course: Course
  relevanceScore: number
  reasoning: string
}

// Fetch all courses from Supabase
async function getAllCourses(school?: string, department?: string): Promise<Course[]> {
  let query = supabase
    .from('course_directory')
    .select('*')
  
  // If school is provided, filter by school
  if (school && school.trim()) {
    const schoolNormalized = school.trim()
    query = query.eq('school', schoolNormalized) // Try exact match first
  }
  
  // If department is provided, filter by department prefix
  if (department && department.trim()) {
    const deptUpper = department.toUpperCase().trim()
    query = query.ilike('course_code', `${deptUpper}%`) // Case-insensitive match for course codes starting with department
  }
  
  const { data, error } = await query.order('course_code')

  if (error) {
    console.error('Supabase query error:', error)
    throw new Error(`Failed to fetch courses: ${error.message}`)
  }

  // If school/department were provided but no results, try case-insensitive matching as fallback
  if ((school || department) && (!data || data.length === 0)) {
    const schoolNormalized = school?.trim() || ''
    const deptUpper = department?.toUpperCase().trim() || ''
    console.log(`No courses found with exact match. Trying case-insensitive match for school="${schoolNormalized}", department="${deptUpper}"`)
    
    let fallbackQuery = supabase.from('course_directory').select('*')
    
    if (schoolNormalized) {
      fallbackQuery = fallbackQuery.ilike('school', `%${schoolNormalized}%`) // Case-insensitive partial match
    }
    
    if (deptUpper) {
      fallbackQuery = fallbackQuery.ilike('course_code', `${deptUpper}%`)
    }
    
    const { data: fallbackData, error: fallbackError } = await fallbackQuery.order('course_code')
    
    if (!fallbackError && fallbackData && fallbackData.length > 0) {
      console.log(`Found ${fallbackData.length} courses with case-insensitive match`)
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
  }

  // Map results to Course format
  return (data || []).map(course => ({
    id: course.id,
    course_number: course.course_code || course.course_number, // Handle both column names
    name: course.course_name || course.name, // Handle both column names
    description: course.description,
    prerequisites: course.prerequisites,
    credits: course.credits,
    department: course.department || (department?.toUpperCase().trim() || null),
    semesters: course.semesters || null, // May not exist in course_directory
  }))
}

// Use Gemini to match query with courses
async function findRelevantCourses(
  query: string,
  courses: Course[],
  limit: number = 10
): Promise<CourseRecommendation[]> {
  // Service-account / Vertex AI only (same check as other endpoints)
  if (!isVertexAI() || !getAuthClient() || !getProjectId()) {
    throw new Error(
      'Gemini is not configured for Vertex AI. Ensure studentagent.json exists and the service account has the "Vertex AI User" role.'
    )
  }

  const projectId = getProjectId()
  if (!projectId) {
    throw new Error('Project ID not available')
  }

  // Format courses for the prompt
  const coursesContext = courses.map((course, index) => {
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
Given a user's query about their career goals or interests, recommend the most relevant courses from the EXACT list provided below.

IMPORTANT: You MUST ONLY use courses from the list provided. Do NOT invent, create, or reference any courses that are not in the list. Only use the index numbers that correspond to courses in the provided list.

User Query: "${query}"

Available Courses (use ONLY these courses):
${coursesContext}

Please respond with a JSON array of objects, where each object has:
- index: The number from the list above (1-based, must be between 1 and ${courses.length})
- relevanceScore: A number from 0-100 indicating how relevant the course is
- reasoning: A brief explanation of why this course is recommended (keep it concise, under 200 characters)

Return ONLY a valid JSON array, no other text. Order by relevanceScore descending. Limit to top ${limit} recommendations.
Example format:
[
  {"index": 5, "relevanceScore": 95, "reasoning": "Directly aligns with machine learning career goals"},
  {"index": 12, "relevanceScore": 85, "reasoning": "Provides foundational knowledge in algorithms"}
]`

  // Use Vertex AI Generative AI endpoint with service account (same as other endpoints)
  const accessToken = await getAccessToken()
  const location = 'us-central1'
  const vertexAIEndpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/gemini-2.5-flash:generateContent`

  console.log(`Calling Vertex AI endpoint: ${vertexAIEndpoint}`)

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
        maxOutputTokens: 4096, // Increased to handle longer responses
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
  
  // Extract text from response (same format as other endpoints)
  let textResponse = ''
  if (data.candidates && data.candidates[0] && data.candidates[0].content) {
    const content = data.candidates[0].content
    if (content.parts && content.parts[0]) {
      textResponse = content.parts[0].text || ''
    } else {
      throw new Error('Unexpected response format from Vertex AI: missing parts')
    }
    
    // Check if response was cut off (finishReason indicates truncation)
    if (data.candidates[0].finishReason === 'MAX_TOKENS') {
      console.warn('Response was truncated due to token limit. Consider increasing maxOutputTokens.')
    }
  } else {
    throw new Error('Unexpected response format from Vertex AI')
  }

  if (!textResponse) {
    throw new Error('No response from Gemini API')
  }

  console.log('Received response from Gemini API')
  console.log('Response length:', textResponse.length)
  console.log('Gemini response preview (first 1000 chars):', textResponse.substring(0, 1000))
  console.log('Gemini response preview (last 500 chars):', textResponse.substring(Math.max(0, textResponse.length - 500)))

  // Parse JSON response with proper error handling
  try {
    // Clean the response - remove markdown code blocks if present
    let cleanedResponse = textResponse.trim()
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.replace(/^```json\s*/i, '').replace(/\s*```$/g, '').trim()
    } else if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/g, '').trim()
    }

    // Check if response looks truncated (doesn't end with ])
    if (!cleanedResponse.endsWith(']')) {
      console.warn('Response may be truncated - attempting to fix incomplete JSON')
      // Try to find the last complete object and close the array
      const lastCompleteBrace = cleanedResponse.lastIndexOf('}')
      if (lastCompleteBrace > 0) {
        cleanedResponse = cleanedResponse.substring(0, lastCompleteBrace + 1) + ']'
        console.log('Attempted to fix truncated JSON by closing array')
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

    // Validate and filter recommendations to ensure only valid courses from database are used
    const validRecommendations = recommendations
      .slice(0, limit)
      .map(rec => {
        // Validate index is within bounds - CRITICAL: Only use courses from database
        if (!rec.index || rec.index < 1 || rec.index > courses.length) {
          console.warn(`Invalid index ${rec.index} provided by Gemini (valid range: 1-${courses.length}). Skipping.`)
          return null
        }
        
        // Get course from database array - this ensures we only use real courses
        const course = courses[rec.index - 1] // Convert 1-based to 0-based
        if (!course) {
          console.warn(`Course at index ${rec.index} not found in database. Skipping.`)
          return null
        }
        
        // Validate course has required fields from database
        if (!course.course_number || !course.name) {
          console.warn(`Course at index ${rec.index} missing required fields. Skipping.`)
          return null
        }
        
        // Ensure reasoning is a string and not too long
        const reasoning = (rec.reasoning || '').substring(0, 500) // Limit reasoning length
        
        return {
          course, // This course object comes directly from the database
          relevanceScore: Math.min(100, Math.max(0, rec.relevanceScore || 0)), // Clamp score to 0-100
          reasoning: reasoning || 'Recommended based on query relevance'
        }
      })
      .filter((item): item is CourseRecommendation => item !== null)

    if (validRecommendations.length === 0) {
      throw new Error('No valid course recommendations returned from Gemini. All indices were invalid or courses not found.')
    }

    console.log(`Successfully validated ${validRecommendations.length} course recommendations from database`)
    return validRecommendations
  } catch (error) {
    console.error('JSON parsing error:', error)
    console.error('Raw response length:', textResponse.length)
    console.error('Raw response (first 2000 chars):', textResponse.substring(0, 2000))
    throw new Error(`Failed to parse Gemini response: ${error instanceof Error ? error.message : String(error)}`)
  }
}

const router = express.Router()

router.post('/', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const { query, school, department, limit = 10 } = req.body

    if (!query || !query.trim()) {
      return res.status(400).json({ error: 'Query is required' })
    }

    // School and department are now optional - if not provided, search all courses
    const schoolTrimmed = school?.trim() || undefined
    const departmentTrimmed = department?.trim() || undefined

    // Fetch courses (filtered by school/department if provided, otherwise all courses)
    const allCourses = await getAllCourses(schoolTrimmed, departmentTrimmed)

    if (allCourses.length === 0) {
      // Return 200 with empty results instead of 404, so the frontend can handle it gracefully
      const filterDesc = schoolTrimmed && departmentTrimmed 
        ? `${schoolTrimmed} ${departmentTrimmed}`
        : schoolTrimmed 
        ? schoolTrimmed
        : departmentTrimmed
        ? departmentTrimmed
        : 'all courses'
      return res.status(200).json({ 
        success: false,
        error: `No courses found for ${filterDesc}. Please check that courses exist in the course_directory table.`,
        query,
        school: schoolTrimmed || null,
        department: departmentTrimmed || null,
        results: [],
        totalCourses: 0
      })
    }

    // Use Gemini to find relevant courses
    const recommendations = await findRelevantCourses(query.trim(), allCourses, limit)

    res.json({
      success: true,
      query,
      school: schoolTrimmed || null,
      department: departmentTrimmed || null,
      results: recommendations,
      totalCourses: allCourses.length
    })
  } catch (error) {
    console.error('Error searching courses:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    res.status(500).json({
      error: 'Failed to search courses',
      message: errorMessage
    })
  }
})

export default router

