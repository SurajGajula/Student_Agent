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
import { buildContext } from './context/contextBuilder.js'
import capabilityRegistry from './capabilities/index.js'

interface VertexAIResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string
        functionCall?: {
          name: string
          args: Record<string, any>
        }
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
  intent: 'test' | 'flashcard' | 'course_search' | 'career_path' | 'none'
  school?: string
  department?: string
  role?: string
  company?: string
  seniority?: string
  major?: string
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

    const { message, mentions, pageContext } = req.body

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' })
    }

    const hasMentions = mentions && Array.isArray(mentions) && mentions.length > 0

    // Build context from user profile, page context, and database
    const chatContext = await buildContext(req.userId, pageContext, mentions)

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

    // Get all capabilities from registry (Vertex AI function calling format)
    const functionDeclarations = capabilityRegistry.getFunctionDeclarations()
    
    // Debug: Log function declarations to verify they're being sent
    console.log('[Intent Router] Available function declarations:', functionDeclarations.map(f => f.name))
    console.log('[Intent Router] User message:', message)
    console.log('[Intent Router] Has mentions:', hasMentions, mentions)

    // Build prompt for intent classification with context
    const contextInfo = []
    if (chatContext.user.planName) {
      contextInfo.push(`User plan: ${chatContext.user.planName}`)
    }
    if (chatContext.page?.currentView) {
      contextInfo.push(`Current page: ${chatContext.page.currentView}`)
    }
    if (hasMentions) {
      const mentionDetails = mentions.map((m: any) => `- Note: "${m.noteName}" (ID: ${m.noteId})`).join('\n')
      contextInfo.push(`Note mentions in message:\n${mentionDetails}`)
    }

    const prompt = `You are an intent classifier for a student study assistant application. Analyze the user's message and determine which function to call.

${contextInfo.length > 0 ? `Context:\n${contextInfo.join('\n')}\n` : ''}
User's message: "${message}"

CRITICAL INSTRUCTIONS:
1. You MUST call a function if the message matches any capability. Do NOT return text-only responses. Do NOT explain why you cannot do something - just call the appropriate function.
2. If the user mentions creating a test, quiz, exam, or questions from a note, you MUST call the generate_test function.
3. If the user mentions creating flashcards, study cards, or memorization cards from a note, you MUST call the generate_flashcard function.
4. Note mentions appear in the format @[note name](noteId) in the message. The note details are provided in the Context section above.
5. Even if the note name appears as "undefined" in the mention, you should still call the function - the system will handle fetching the note content using the noteId.

For test generation (generate_test function):
- ALWAYS call generate_test if the message contains: "test", "quiz", "exam", or "questions" AND action words like "turn", "make", "create", "generate"
- Examples that MUST trigger generate_test:
  * "turn @[note] into a test" → CALL generate_test
  * "make a quiz from @[note]" → CALL generate_test
  * "turn note into test" → CALL generate_test
  * "create test questions" → CALL generate_test
  * "generate quiz from note" → CALL generate_test
- If a note is mentioned (see Context section), use the noteId and noteName from the mention details
- If no note is mentioned but the user is on the notes page, still call the function (the system will use context)

For flashcard generation (generate_flashcard function):
- ALWAYS call generate_flashcard if the message contains: "flashcard", "flash card", "study cards", "memorization", "review cards" AND action words like "turn", "make", "create", "generate"
- Examples that MUST trigger generate_flashcard:
  * "turn @[note] into flashcards" → CALL generate_flashcard
  * "make flashcards from @[note]" → CALL generate_flashcard
  * "create study cards for @[note]" → CALL generate_flashcard
  * "turn note into flashcards" → CALL generate_flashcard
  * "generate flash cards" → CALL generate_flashcard
- If a note is mentioned (see Context section), use the noteId and noteName from the mention details
- If no note is mentioned but the user is on the notes page, still call the function (the system will use context)

If the message doesn't match any capability, do not call any function.`

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
        tools: [
          {
            functionDeclarations,
          },
        ],
        generationConfig: {
          temperature: 0.1, // Lower temperature for more consistent classification
          maxOutputTokens: 500, // Intent routing doesn't need much output
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
    
    // Debug: Log the full response to see what Gemini returned
    console.log('[Intent Router] Vertex AI response structure:', {
      hasCandidates: !!data.candidates,
      candidateCount: data.candidates?.length || 0,
      firstCandidateContent: data.candidates?.[0]?.content,
      firstCandidateParts: data.candidates?.[0]?.content?.parts,
      finishReason: data.candidates?.[0]?.finishReason
    })
    
    // Parse function call response
    let intentResult: IntentResponse | undefined = undefined
    
    // Handle MALFORMED_FUNCTION_CALL - Gemini tried to call but format was wrong
    // Fallback: infer intent from message content
    if (data.candidates && data.candidates[0]) {
      const finishReason = data.candidates[0].finishReason
      if (finishReason === 'MALFORMED_FUNCTION_CALL') {
        console.warn('[Intent Router] Malformed function call detected, inferring intent from message')
        const lowerMessage = message.toLowerCase()
        const hasFlashcardKeywords = lowerMessage.includes('flashcard') || lowerMessage.includes('flash card') || lowerMessage.includes('study card') || lowerMessage.includes('memorization')
        const hasTestKeywords = lowerMessage.includes('test') || lowerMessage.includes('quiz') || lowerMessage.includes('exam') || lowerMessage.includes('question')
        const hasActionWords = lowerMessage.includes('turn') || lowerMessage.includes('make') || lowerMessage.includes('create') || lowerMessage.includes('generate')
        
        if (hasFlashcardKeywords && hasActionWords && hasMentions) {
          intentResult = {
            intent: 'flashcard',
            confidence: 0.8,
            reasoning: 'Flashcard generation detected from message (malformed function call recovered)'
          }
        } else if (hasTestKeywords && hasActionWords && hasMentions) {
          intentResult = {
            intent: 'test',
            confidence: 0.8,
            reasoning: 'Test generation detected from message (malformed function call recovered)'
          }
        } else {
          intentResult = {
            intent: 'none',
            confidence: 0.5,
            reasoning: 'Malformed function call and unable to infer intent from message'
          }
        }
      }
    }
    
    // Only process content if we haven't already set intentResult from malformed function call fallback
    if (!intentResult && data.candidates && data.candidates[0] && data.candidates[0].content) {
      const content = data.candidates[0].content
      const parts = content.parts || []
      
      // Look for function call in response
      const functionCall = parts.find(part => part.functionCall)
      
      if (functionCall && functionCall.functionCall) {
        const { name, args } = functionCall.functionCall
        
        // Map function name to intent
        if (name === 'generate_test') {
          // Allow test generation even without explicit mentions if user is on notes page
          const isOnNotesPage = chatContext.page?.currentView === 'notes'
          const hasNoteSelected = chatContext.database?.recentNotes && chatContext.database.recentNotes.length > 0
          
          if (!hasMentions && !isOnNotesPage && !hasNoteSelected) {
            intentResult = {
              intent: 'none',
              confidence: 0,
              reasoning: 'Test generation requires a note. Please mention a note with @[note name] or select a note on the notes page.'
            }
          } else {
            intentResult = {
              intent: 'test',
              confidence: 0.9,
              reasoning: hasMentions 
                ? 'User wants to generate a test from mentioned note(s)'
                : 'User wants to generate a test from current note context'
            }
            // Frontend will use mentions if available, otherwise use selected note
          }
        } else if (name === 'generate_flashcard') {
          // Allow flashcard generation even without explicit mentions if user is on notes page
          const isOnNotesPage = chatContext.page?.currentView === 'notes'
          const hasNoteSelected = chatContext.database?.recentNotes && chatContext.database.recentNotes.length > 0
          
          if (!hasMentions && !isOnNotesPage && !hasNoteSelected) {
            intentResult = {
              intent: 'none',
              confidence: 0,
              reasoning: 'Flashcard generation requires a note. Please mention a note with @[note name] or select a note on the notes page.'
            }
          } else {
            intentResult = {
              intent: 'flashcard',
              confidence: 0.9,
              reasoning: hasMentions 
                ? 'User wants to generate flashcards from mentioned note(s)'
                : 'User wants to generate flashcards from current note context'
            }
            // Frontend will use mentions if available, otherwise use selected note
          }
        } else if (name === 'search_courses') {
          intentResult = {
            intent: 'course_search',
            school: args.school || undefined,
            department: args.department || undefined,
            confidence: 0.9,
            reasoning: 'User wants to search for courses'
          }
        } else if (name === 'generate_career_path') {
          console.log('[Intent Router] Career path function called with args:', JSON.stringify(args, null, 2))
          
          // Validate required parameters
          if (!args.role || !args.company) {
            console.warn('[Intent Router] Missing role or company in function call args:', args)
            intentResult = {
              intent: 'none',
              confidence: 0,
              reasoning: `Career path generation requires both role and company. Received: role=${args.role || 'missing'}, company=${args.company || 'missing'}`
            }
          } else {
            intentResult = {
              intent: 'career_path',
              role: String(args.role).trim(),
              company: String(args.company).trim(),
              seniority: args.seniority ? String(args.seniority).trim() : 'mid',
              major: args.major ? String(args.major).trim() : undefined,
              confidence: 0.9,
              reasoning: 'User wants to generate a career path skill graph'
            }
          }
        } else {
          intentResult = {
            intent: 'none',
            confidence: 0,
            reasoning: `Unknown function called: ${name}`
          }
        }
      } else {
        // No function call - user message doesn't match any capability
        intentResult = {
          intent: 'none',
          confidence: 0.8,
          reasoning: 'Message does not match any available capability'
        }
      }
    } else {
      console.error('Unexpected Vertex AI response structure:', JSON.stringify(data, null, 2))
      intentResult = {
        intent: 'none',
        confidence: 0,
        reasoning: 'Unexpected response format from Vertex AI'
      }
    }

    console.log('Intent routing result:', intentResult)

    // Validate intent value
    if (!['test', 'flashcard', 'course_search', 'career_path', 'none'].includes(intentResult.intent)) {
      console.warn('Invalid intent value, defaulting to none:', intentResult.intent)
      intentResult.intent = 'none'
    }

    // Ensure test/flashcard intents have some note context (mentions or page context)
    if (intentResult.intent === 'test' || intentResult.intent === 'flashcard') {
      const isOnNotesPage = chatContext.page?.currentView === 'notes'
      const hasNoteSelected = chatContext.database?.recentNotes && chatContext.database.recentNotes.length > 0
      
      if (!hasMentions && !isOnNotesPage && !hasNoteSelected) {
        console.warn('Test/flashcard intent detected but no note context available, changing to none')
        intentResult.intent = 'none'
        intentResult.reasoning = 'Please mention a note with @[note name] or select a note on the notes page.'
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
