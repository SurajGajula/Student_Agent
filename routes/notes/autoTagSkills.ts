// Load environment variables first
import '../../load-env.js'

import { createClient } from '@supabase/supabase-js'
import { 
  isVertexAI, 
  getProjectId, 
  getAccessToken,
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

interface SkillInfo {
  skill_id: string
  name: string
  description: string | null
}

/**
 * Automatically tag a note with relevant skills from user's career paths
 * @param userId - User ID
 * @param noteContent - Note content to analyze
 * @param noteName - Note name (optional, for context)
 * @returns Array of skill IDs that match the note content
 */
export async function autoTagSkills(
  userId: string,
  noteContent: string,
  noteName?: string
): Promise<string[]> {
  try {
    // Get all skills from user's career paths
    const { data: careerPaths, error: careerError } = await supabase
      .from('user_career_paths')
      .select('nodes')
      .eq('user_id', userId)

    if (careerError) {
      console.error('Error fetching career paths for auto-tagging:', careerError)
      return []
    }

    if (!careerPaths || careerPaths.length === 0) {
      console.log('No career paths found for user, skipping auto-tagging')
      return []
    }

    // Collect all unique skills from all career paths
    const allSkills = new Map<string, SkillInfo>()
    careerPaths.forEach(path => {
      const nodes = path.nodes as any[]
      if (Array.isArray(nodes)) {
        nodes.forEach(node => {
          if (node.skill_id && node.name) {
            if (!allSkills.has(node.skill_id)) {
              allSkills.set(node.skill_id, {
                skill_id: node.skill_id,
                name: node.name,
                description: node.description || null
              })
            }
          }
        })
      }
    })

    if (allSkills.size === 0) {
      console.log('No skills found in career paths, skipping auto-tagging')
      return []
    }

    // Prepare skills list for Gemini
    const skillsList = Array.from(allSkills.values()).map(skill => ({
      id: skill.skill_id,
      name: skill.name,
      description: skill.description
    }))

    console.log(`[AutoTag] Analyzing note "${noteName || 'Untitled'}" (${noteContent.length} chars) against ${skillsList.length} skills`)
    console.log(`[AutoTag] Available skills:`, skillsList.map(s => s.name).join(', '))

    // Use Gemini to match note content to skills
    if (!isVertexAI() || !getProjectId()) {
      console.warn('Gemini not configured, skipping auto-tagging')
      return []
    }

    const accessToken = await getAccessToken()
    const location = 'us-central1'
    const vertexAIEndpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${getProjectId()}/locations/${location}/publishers/google/models/gemini-2.5-flash:generateContent`

    // Use more content for better matching (up to 8000 chars)
    const contentPreview = noteContent.substring(0, 8000)
    const contentLength = noteContent.length
    
    const prompt = `You are analyzing a note to automatically tag it with relevant skills from a career path.

Note Title: ${noteName || 'Untitled'}
Note Content (${contentLength} total characters, showing first ${contentPreview.length}):
${contentPreview}${contentLength > 8000 ? '\n[... content truncated ...]' : ''}

Available Skills (${skillsList.length} total):
${skillsList.map((s, idx) => `${idx + 1}. ${s.name} (ID: ${s.id})${s.description ? ` - ${s.description}` : ''}`).join('\n')}

Your task: Identify ALL skills that are relevant to this note content. Be INCLUSIVE rather than selective:
- Match skills even if the exact name doesn't appear (e.g., "RAG" matches "Retrieval Augmented Generation", "fine tuning" matches "Fine-Tuning", "ML" matches "Machine Learning")
- Match skills if the note discusses related concepts, techniques, or technologies
- Match skills if the note mentions tools, frameworks, or methods related to the skill
- Include skills even if only briefly mentioned or discussed in context
- Consider synonyms, abbreviations, and related terms

Examples:
- If note mentions "RAG" or "retrieval augmented generation" → match "RAG" or "Retrieval Augmented Generation" skill
- If note mentions "fine-tuning models" → match "Fine-Tuning" or "Model Fine-Tuning" skill
- If note mentions "prompt engineering" → match "Prompt Engineering" skill
- If note mentions "agents" or "AI agents" → match "AI Agents" or "Agent Systems" skill
- If note mentions "transformer" or "attention" → match "Transformers" or "Attention Mechanisms" skill

Return a JSON array containing the skill IDs (as strings) that match. Include ALL relevant skills, not just the most obvious ones.

Response format (JSON array only):
["skill-id-1", "skill-id-2", "skill-id-3"]

Return ONLY the JSON array, no markdown, no explanation, no other text.`

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
          temperature: 0.3, // Slightly higher for more flexible matching
          maxOutputTokens: 2048, // Increased to handle more skills
        },
      }),
    })

    if (!response.ok) {
      console.error('Error calling Gemini for auto-tagging:', response.status, await response.text())
      return []
    }

    const data = await response.json()
    let textResponse = ''

    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      const content = data.candidates[0].content
      if (content.parts && content.parts[0]) {
        textResponse = content.parts[0].text || ''
      }
    }

    if (!textResponse) {
      console.warn('Empty response from Gemini for auto-tagging')
      return []
    }

    // Parse JSON response
    try {
      // Clean up the response (remove markdown code blocks if present)
      let cleanedResponse = textResponse.trim()
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim()

      // Try to extract JSON array even if response is incomplete
      // Look for array pattern: [ "id1", "id2", ...
      const arrayMatch = cleanedResponse.match(/\[[\s\S]*?\]/)
      if (arrayMatch) {
        cleanedResponse = arrayMatch[0]
      } else {
        // If no complete array, try to extract individual IDs
        const idMatches = cleanedResponse.match(/"([a-f0-9-]{36})"/gi)
        if (idMatches && idMatches.length > 0) {
          const extractedIds = idMatches.map(m => m.replace(/"/g, ''))
          console.log(`[AutoTag] Extracted ${extractedIds.length} skill IDs from incomplete response`)
          const validSkillIds = extractedIds.filter(id => allSkills.has(id))
          if (validSkillIds.length > 0) {
            return validSkillIds
          }
        }
      }

      let skillIds: string[]
      try {
        skillIds = JSON.parse(cleanedResponse) as string[]
      } catch (parseError) {
        // If JSON parsing fails, try to extract UUIDs directly from the response
        console.warn('[AutoTag] JSON parse failed, attempting to extract skill IDs from response')
        const uuidPattern = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi
        const extractedIds = cleanedResponse.match(uuidPattern) || []
        const validSkillIds = extractedIds.filter(id => allSkills.has(id))
        if (validSkillIds.length > 0) {
          console.log(`[AutoTag] Extracted ${validSkillIds.length} valid skill IDs from malformed response`)
          return validSkillIds
        }
        throw parseError
      }

      if (!Array.isArray(skillIds)) {
        console.warn('Invalid response format from Gemini for auto-tagging:', skillIds)
        return []
      }

      // Validate that all skill IDs exist in our skills list
      const validSkillIds = skillIds.filter(id => 
        typeof id === 'string' && allSkills.has(id)
      )

      const matchedSkillNames = validSkillIds.map(id => allSkills.get(id)?.name).filter(Boolean)
      console.log(`[AutoTag] Auto-tagged note "${noteName || 'Untitled'}" with ${validSkillIds.length} skills:`, matchedSkillNames)
      
      if (validSkillIds.length === 0 && skillIds.length > 0) {
        console.warn(`[AutoTag] Warning: Gemini returned ${skillIds.length} skill IDs but none were valid. Response:`, skillIds)
        console.warn(`[AutoTag] Available skill IDs:`, Array.from(allSkills.keys()).slice(0, 10))
      } else if (validSkillIds.length === 0) {
        console.log(`[AutoTag] No skills matched by Gemini. Trying keyword-based fallback...`)
        
        // Fallback: keyword-based matching
        const noteContentLower = noteContent.toLowerCase()
        const noteNameLower = (noteName || '').toLowerCase()
        const combinedText = `${noteNameLower} ${noteContentLower}`
        
        const keywordMatches: string[] = []
        skillsList.forEach(skill => {
          const skillNameLower = skill.name.toLowerCase()
          const skillKeywords = skillNameLower.split(/[\s\-_]+/).filter(k => k.length > 2)
          
          // Check if skill name or keywords appear in note
          if (combinedText.includes(skillNameLower)) {
            keywordMatches.push(skill.id)
          } else if (skillKeywords.some(keyword => combinedText.includes(keyword))) {
            // Also check for partial matches (e.g., "RAG" in note matches "Retrieval Augmented Generation")
            const skillWords = skillNameLower.split(/\s+/)
            if (skillWords.length > 1) {
              // For multi-word skills, check if significant words appear
              const significantWords = skillWords.filter(w => w.length > 3)
              if (significantWords.length > 0 && significantWords.some(w => combinedText.includes(w))) {
                keywordMatches.push(skill.id)
              }
            }
          }
        })
        
        if (keywordMatches.length > 0) {
          console.log(`[AutoTag] Keyword fallback matched ${keywordMatches.length} skills:`, keywordMatches.map(id => allSkills.get(id)?.name).filter(Boolean))
          return keywordMatches
        }
        
        console.log(`[AutoTag] No skills matched by keyword fallback either. Gemini response:`, textResponse.substring(0, 200))
      }
      
      return validSkillIds
    } catch (parseError) {
      console.error('Error parsing Gemini response for auto-tagging:', parseError)
      console.error('Response was:', textResponse)
      return []
    }
  } catch (error) {
    console.error('Error in autoTagSkills:', error)
    return []
  }
}
