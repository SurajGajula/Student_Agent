import express, { Response } from 'express'
import {
  getAccessToken,
  getProjectId,
  isVertexAI,
  getAuthClient,
  getServiceAccountKey,
} from '../../services/gemini.js'
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth.js'
import { checkTokenLimit, recordTokenUsage } from '../../services/usageTracking.js'

interface VertexAIResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string
      }>
    }
    finishReason?: string
  }>
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
    totalTokenCount?: number
  }
}

interface VertexAIError {
  error?: {
    message?: string
    status?: string
  }
}

interface IntentResponse {
  intent: 'test' | 'flashcard' | 'course_search' | 'none'
  school?: string
  department?: string
  confidence?: number
  reasoning?: string
}

const router = express.Router()

router.post('/route', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  console.log('Received intent routing request')
  
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const { message, mentions } = req.body

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' })
    }

    const hasMentions = mentions && Array.isArray(mentions) && mentions.length > 0

    // Check token limit before making API call
    const estimatedTokens = 500 // Intent routing is lightweight
    const limitCheck = await checkTokenLimit(req.userId, estimatedTokens)
    if (!limitCheck.allowed) {
      return res.status(429).json({
        error: 'Monthly token limit exceeded',
        limit: limitCheck.limit,
        current: limitCheck.current,
        remaining: limitCheck.remaining
      })
    }

    // Service-account / Vertex AI only
    if (!isVertexAI() || !getAuthClient() || !getProjectId()) {
      const serviceAccountEmail = getServiceAccountKey()?.client_email || 'your service account'
      throw new Error(
        `Gemini is not configured for Vertex AI. Ensure studentagent.json exists and the service account ` +
        `(${serviceAccountEmail}) has the "Vertex AI User" role in Google Cloud Console.`
      )
    }

    // Build prompt for intent classification
    const prompt = `You are an intent classifier for a student study assistant application. Analyze the user's message and determine their intent.

Available capabilities:
1. **test** - Generate a test/quiz from notes (requires a note mention like @[note name])
2. **flashcard** - Generate flashcards from notes (requires a note mention like @[note name])
3. **course_search** - Search for relevant courses based on career goals or interests
4. **none** - The message doesn't match any of the above capabilities

User's message: "${message}"
Has note mentions: ${hasMentions ? 'Yes' : 'No'}

Instructions:
- If the user wants to create a test/quiz from notes AND mentions are present, respond with intent: "test"
- If the user wants to create flashcards from notes AND mentions are present, respond with intent: "flashcard"
- If the user is asking about courses, course recommendations, career-related courses, or course search, respond with intent: "course_search" and extract:
  * school: The university name (ONLY if mentioned in the message, leave undefined if not specified)
  * department: The department/major (ONLY if mentioned in the message, leave undefined if not specified)
- If the message doesn't clearly match any capability, respond with intent: "none"

For course_search intent, extract the school and department from the message ONLY if explicitly mentioned. Common variations:
- "Stanford CS courses", "MIT CS", "Berkeley Computer Science" → extract school and department
- "CS courses", "Computer Science courses" → extract only department, leave school undefined
- "courses for AI career" → leave both undefined (no school/department mentioned)
- DO NOT default to any values if school or department are not mentioned

IMPORTANT: Be flexible with phrasing. Users can express the same intent in many ways:
- "turn @[note] into a test" = test
- "make a quiz from @[note]" = test
- "create flashcards from @[note]" = flashcard
- "I want flashcards for @[note]" = flashcard
- "find courses for AI career" = course_search (no school/department - leave undefined)
- "what classes should I take to work at OpenAI" = course_search (no school/department - leave undefined)
- "recommend stanford CS courses" = course_search (school: "Stanford", department: "CS")
- "MIT CS courses for machine learning" = course_search (school: "MIT", department: "CS")
- "Berkeley Computer Science courses" = course_search (school: "Berkeley", department: "CS")
- "find CS courses at MIT" = course_search (school: "MIT", department: "CS")

Respond with ONLY a valid JSON object in this exact format:
{
  "intent": "test" | "flashcard" | "course_search" | "none",
  "school": "University Name" (only for course_search if mentioned, omit if not specified),
  "department": "Department" (only for course_search if mentioned, omit if not specified),
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}

Return ONLY the JSON object, no other text or markdown formatting.`

    const accessToken = await getAccessToken()
    const location = 'us-central1'
    const projectId = getProjectId()
    
    if (!projectId) {
      throw new Error('Project ID not configured')
    }

    const vertexAIEndpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/gemini-2.5-flash:generateContent`
    
    console.log(`Calling Vertex AI endpoint for intent routing: ${vertexAIEndpoint}`)
    
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
          temperature: 0.1, // Lower temperature for more consistent classification
          maxOutputTokens: 500, // Intent routing doesn't need much output
          responseMimeType: 'application/json',
        },
      }),
    })

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as VertexAIError
      const errorMessage = errorData.error?.message || JSON.stringify(errorData)
      console.error('Vertex AI API error:', errorData)
      
      if (response.status === 403 && errorData.error?.status === 'PERMISSION_DENIED') {
        const serviceAccountEmail = getServiceAccountKey()?.client_email || 'your service account'
        throw new Error(
          `Service account lacks Vertex AI permissions. ` +
          `Please grant the "Vertex AI User" role to the service account ` +
          `(${serviceAccountEmail}) in Google Cloud Console.`
        )
      }

      throw new Error(`Vertex AI API error: ${response.status} ${errorMessage}`)
    }

    const data = (await response.json()) as VertexAIResponse
    
    let textResponse = ''
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      const content = data.candidates[0].content
      if (content.parts && content.parts[0]) {
        textResponse = content.parts[0].text || ''
      } else {
        throw new Error('Unexpected response format from Vertex AI: missing parts')
      }
    } else {
      console.error('Unexpected Vertex AI response structure:', JSON.stringify(data, null, 2))
      throw new Error('Unexpected response format from Vertex AI')
    }

    console.log('Intent routing response:', textResponse)

    // Parse JSON response
    let intentResult: IntentResponse
    try {
      // Clean the response - remove markdown code blocks if present
      let cleanedResponse = textResponse.trim()
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '')
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '')
      }

      intentResult = JSON.parse(cleanedResponse) as IntentResponse

      // Validate intent value
      if (!['test', 'flashcard', 'course_search', 'none'].includes(intentResult.intent)) {
        console.warn('Invalid intent value, defaulting to none:', intentResult.intent)
        intentResult.intent = 'none'
      }

      // Validate course_search - do not set defaults, only use what was extracted
      // School and department are optional and should only be included if extracted from the message

      // Ensure test/flashcard intents require mentions
      if ((intentResult.intent === 'test' || intentResult.intent === 'flashcard') && !hasMentions) {
        console.warn('Test/flashcard intent detected but no mentions present, changing to none')
        intentResult.intent = 'none'
      }

    } catch (error) {
      console.error('Error parsing intent response:', error)
      // Fallback to 'none' if parsing fails
      intentResult = {
        intent: 'none',
        confidence: 0,
        reasoning: 'Failed to parse intent response'
      }
    }

    // Extract and record token usage
    const tokenUsage = data.usageMetadata?.totalTokenCount || 0
    console.log(`Intent routing - token usage: ${tokenUsage} (metadata:`, data.usageMetadata, ')')
    
    if (tokenUsage > 0 && req.userId) {
      try {
        await recordTokenUsage(req.userId, tokenUsage)
        console.log(`Successfully recorded ${tokenUsage} tokens for user ${req.userId}`)
      } catch (usageError) {
        console.error('Error recording token usage:', usageError)
        // Don't fail the request if usage recording fails
      }
    }

    res.json({
      success: true,
      ...intentResult
    })
  } catch (error) {
    console.error('Error routing intent:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('Error stack:', errorStack)
    res.status(500).json({
      error: 'Failed to route intent',
      message: errorMessage,
      details: process.env.NODE_ENV === 'development' ? errorStack : undefined,
    })
  }
})

export default router
