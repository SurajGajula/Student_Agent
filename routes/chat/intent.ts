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

    // Build prompt for intent classification with context
    const contextInfo = []
    if (chatContext.user.planName) {
      contextInfo.push(`User plan: ${chatContext.user.planName}`)
    }
    if (chatContext.page?.currentView) {
      contextInfo.push(`Current page: ${chatContext.page.currentView}`)
    }
    if (hasMentions) {
      contextInfo.push(`Note mentions: ${mentions.map((m: any) => m.noteName).join(', ')}`)
    }

    const prompt = `You are an intent classifier for a student study assistant application. Analyze the user's message and determine which function to call.

${contextInfo.length > 0 ? `Context:\n${contextInfo.join('\n')}\n` : ''}
User's message: "${message}"

Analyze the user's message and call the appropriate function. If the message doesn't match any capability, do not call any function.`

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
    
    // Parse function call response
    let intentResult: IntentResponse
    
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      const content = data.candidates[0].content
      const parts = content.parts || []
      
      // Look for function call in response
      const functionCall = parts.find(part => part.functionCall)
      
      if (functionCall && functionCall.functionCall) {
        const { name, args } = functionCall.functionCall
        
        // Map function name to intent
        if (name === 'generate_test') {
          // Validate that mentions are present
          if (!hasMentions) {
            intentResult = {
              intent: 'none',
              confidence: 0,
              reasoning: 'Test generation requires note mentions'
            }
          } else {
            // Validate mentions array exists and has items
            const mentionArray = Array.isArray(mentions) ? mentions : []
            if (mentionArray.length === 0) {
              intentResult = {
                intent: 'none',
                confidence: 0,
                reasoning: 'Test generation requires note mentions'
              }
            } else {
              intentResult = {
                intent: 'test',
                confidence: 0.9,
                reasoning: 'User wants to generate a test from notes'
              }
              // Frontend will use mentions as before for backward compatibility
            }
          }
        } else if (name === 'generate_flashcard') {
          if (!hasMentions) {
            intentResult = {
              intent: 'none',
              confidence: 0,
              reasoning: 'Flashcard generation requires note mentions'
            }
          } else {
            intentResult = {
              intent: 'flashcard',
              confidence: 0.9,
              reasoning: 'User wants to generate flashcards from notes'
            }
          }
        } else if (name === 'search_courses') {
          intentResult = {
            intent: 'course_search',
            school: args.school || undefined,
            department: args.department || undefined,
            confidence: 0.9,
            reasoning: 'User wants to search for courses'
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
    if (!['test', 'flashcard', 'course_search', 'none'].includes(intentResult.intent)) {
      console.warn('Invalid intent value, defaulting to none:', intentResult.intent)
      intentResult.intent = 'none'
    }

    // Ensure test/flashcard intents require mentions
    if ((intentResult.intent === 'test' || intentResult.intent === 'flashcard') && !hasMentions) {
      console.warn('Test/flashcard intent detected but no mentions present, changing to none')
      intentResult.intent = 'none'
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
