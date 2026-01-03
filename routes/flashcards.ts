import express, { Response } from 'express'
import {
  getGeminiClient,
  isVertexAI,
  getProjectId,
  getAccessToken,
  getAuthClient,
  initializeGeminiClient
} from '../services/gemini.js'
import { authenticateUser, AuthenticatedRequest } from './middleware/auth.js'
import { checkTokenLimit, recordTokenUsage } from '../services/usageTracking.js'

interface GenerateFlashcardRequest {
  noteId: string
  noteName: string
  noteContent: string
}

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

interface GeneratedFlashcard {
  id: string
  front: string
  back: string
}

interface GeneratedFlashcardsResponse {
  flashcards: GeneratedFlashcard[]
}

const router = express.Router()

// Generate flashcards using Gemini
async function generateFlashcards(noteContent: string): Promise<{ flashcards: GeneratedFlashcard[], tokenUsage: number }> {
  let geminiClient = getGeminiClient()
  if (!geminiClient) {
    console.log('Initializing Gemini client...')
    await initializeGeminiClient()
    geminiClient = getGeminiClient()
  }

  if (!geminiClient) {
    throw new Error('Failed to initialize Gemini client')
  }

  const prompt = `You are an educational assistant. Generate exactly 10 flashcards based on the following notes content.

Notes Content:
${noteContent}

Requirements:
1. Generate exactly 10 flashcards
2. Each flashcard should have a front (question/prompt) and back (answer/explanation)
3. Front should be concise and test understanding of key concepts
4. Back should provide clear, concise answers
5. Cover different topics/sections from the notes
6. Mix of fact-based and conceptual questions
7. Make flashcards progressively more challenging

Return your response as a JSON object with this exact structure:
{
  "flashcards": [
    {
      "front": "Question or prompt here?",
      "back": "Answer or explanation here"
    },
    {
      "front": "Another question?",
      "back": "Another answer"
    }
  ]
}

Return ONLY the JSON object, no additional text or markdown formatting.`

  console.log('Calling Gemini API to generate flashcards...')
  let textResponse = ''

  // Service-account / Vertex AI only
  if (!isVertexAI() || !getAuthClient() || !getProjectId()) {
    throw new Error(
      'Gemini is not configured for Vertex AI. Ensure studentagent.json exists and the service account has the "Vertex AI User" role.'
    )
  }

  // Use Vertex AI Generative AI endpoint with service account
  const accessToken = await getAccessToken()
  const location = 'us-central1'
  const vertexAIEndpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${getProjectId()}/locations/${location}/publishers/google/models/gemini-2.5-flash:generateContent`

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
        temperature: 0.7,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
    }),
  })

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as VertexAIError
    const errorMessage = errorData.error?.message || JSON.stringify(errorData)
    console.error('Vertex AI API error:', errorData)
    throw new Error(`Vertex AI API error: ${response.status} ${errorMessage}`)
  }

  const data = (await response.json()) as VertexAIResponse
  
  // Extract token usage
  const tokenUsage = data.usageMetadata?.totalTokenCount || 0
  
  if (data.candidates && data.candidates[0] && data.candidates[0].content) {
    const content = data.candidates[0].content
    if (content.parts && content.parts[0]) {
      textResponse = content.parts[0].text || ''
    } else {
      throw new Error('Unexpected response format from Vertex AI: missing parts')
    }
  } else {
    throw new Error('Unexpected response format from Vertex AI')
  }

  console.log('Received response from Gemini API')
  console.log('Gemini response preview:', textResponse.substring(0, 200))

  // Parse JSON response
  try {
    // Clean the response - remove markdown code blocks if present
    let cleanedResponse = textResponse.trim()
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '')
    } else if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '')
    }

    const parsed = JSON.parse(cleanedResponse) as GeneratedFlashcardsResponse

    if (!parsed.flashcards || !Array.isArray(parsed.flashcards)) {
      throw new Error('Invalid response format: missing flashcards array')
    }

    // Ensure we have exactly 10 flashcards (pad or truncate if needed)
    let flashcards = parsed.flashcards.slice(0, 10)
    if (flashcards.length < 10) {
      console.warn(`Only received ${flashcards.length} flashcards, expected 10`)
    }

    // Add IDs to flashcards
    return {
      flashcards: flashcards.map((card, index) => ({
        ...card,
        id: `card${index + 1}`,
      })) as GeneratedFlashcard[],
      tokenUsage
    }
  } catch (error) {
    console.error('Error parsing Gemini response:', error)
    throw new Error(`Failed to parse flashcards: ${error instanceof Error ? error.message : String(error)}`)
  }
}

router.post('/generate', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  console.log('Received flashcard generation request')
  
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const { noteId, noteName, noteContent }: GenerateFlashcardRequest = req.body

    if (!noteId || !noteName) {
      return res.status(400).json({ 
        error: 'Note ID and name are required' 
      })
    }

    // Check if note content is provided
    if (!noteContent || !noteContent.trim()) {
      return res.status(400).json({ 
        error: 'Note content is required to generate flashcards' 
      })
    }

    // Check token limit before making API call
    // Estimate tokens needed (rough estimate: ~2000 tokens for prompt + response)
    const estimatedTokens = 3000
    const limitCheck = await checkTokenLimit(req.userId, estimatedTokens)
    if (!limitCheck.allowed) {
      return res.status(429).json({
        error: 'Monthly token limit exceeded',
        limit: limitCheck.limit,
        current: limitCheck.current,
        remaining: limitCheck.remaining
      })
    }

    console.log(`Generating flashcards from note: ${noteName} (${noteId})`)

    // Generate flashcards using Gemini
    const { flashcards, tokenUsage } = await generateFlashcards(noteContent)

    // Create flashcard set response (ID will be generated by Supabase)
    const flashcardData = {
      name: `Flashcards: ${noteName}`,
      noteId: noteId,
      noteName: noteName,
      cards: flashcards.map((card) => ({
        id: card.id,
        front: card.front,
        back: card.back,
      })),
    }

    // Record token usage
    console.log(`Vertex AI response - token usage: ${tokenUsage}`)
    
    if (tokenUsage > 0 && req.userId) {
      try {
        await recordTokenUsage(req.userId, tokenUsage)
        console.log(`Successfully recorded ${tokenUsage} tokens for user ${req.userId}`)
      } catch (usageError) {
        console.error('Error recording token usage:', usageError)
        // Log the full error for debugging
        if (usageError instanceof Error) {
          console.error('Usage error details:', usageError.message, usageError.stack)
        }
        // Don't fail the request if usage recording fails
      }
    } else {
      console.warn(`Skipping token recording - tokenUsage: ${tokenUsage}, userId: ${req.userId}`)
    }

    console.log(`Successfully generated flashcard set with ${flashcards.length} cards`)

    res.json({
      success: true,
      flashcardSet: flashcardData,
    })
  } catch (error) {
    console.error('Error generating flashcards:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    res.status(500).json({
      error: 'Failed to generate flashcards',
      message: errorMessage,
    })
  }
})

export default router

