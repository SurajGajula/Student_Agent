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
