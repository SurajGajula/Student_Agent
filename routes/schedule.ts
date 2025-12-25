import express, { Request, Response } from 'express'
import multer from 'multer'
import { 
  getGeminiClient, 
  isVertexAI, 
  getProjectId, 
  getAccessToken,
  getServiceAccountKey,
  getAuthClient,
  initializeGeminiClient
} from '../services/gemini.js'
import { authenticateUser, AuthenticatedRequest } from './middleware/auth.js'
import { checkTokenLimit, recordTokenUsage } from '../services/usageTracking.js'

interface ClassData {
  name: string
  days: string[]
  timeRange: string
}

interface ParsedClass {
  name: string
  days: string[]
  timeRange: string
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

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage() })

router.post('/parse-schedule', authenticateUser, upload.single('image'), async (req: AuthenticatedRequest, res: Response) => {
  console.log('Received schedule parsing request')
  
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }
    let geminiClient = getGeminiClient()
    if (!geminiClient) {
      console.log('Initializing Gemini client...')
      await initializeGeminiClient()
      geminiClient = getGeminiClient()
    }

    if (!req.file) {
      console.error('No image file provided')
      return res.status(400).json({ error: 'No image file provided' })
    }

    console.log(`Processing image: ${req.file.originalname}, size: ${req.file.size} bytes, type: ${req.file.mimetype}`)

    const imageBuffer = req.file.buffer
    const base64Image = imageBuffer.toString('base64')
    const mimeType = req.file.mimetype || 'image/png'

    // Optimized concise prompt for faster processing
    const prompt = `Extract all classes from this schedule. Return JSON array only:
[{"name":"CEE 2224","days":["M","W","F"],"timeRange":"9:30 AM - 11:30 AM"}]

Rules:
- name: course code only (e.g. "CEE 2224", not "CEE 2224 TUT 002")
- days: ["M","T","W","TH","F"]
- timeRange: "9:30 AM - 11:30 AM" format
- Separate entries for different times
- Return ONLY JSON array, no other text`

    // Check token limit before making API call
    // Estimate tokens needed (rough estimate: ~1000 tokens for prompt + image)
    const estimatedTokens = 2000
    const limitCheck = await checkTokenLimit(req.userId, estimatedTokens)
    if (!limitCheck.allowed) {
      return res.status(429).json({
        error: 'Monthly token limit exceeded',
        limit: limitCheck.limit,
        current: limitCheck.current,
        remaining: limitCheck.remaining
      })
    }

    console.log('Calling Gemini API...')
    let textResponse = ''

    // Service-account / Vertex AI only
    if (!isVertexAI() || !getAuthClient() || !getProjectId()) {
      const serviceAccountEmail = getServiceAccountKey()?.client_email || 'your service account'
      throw new Error(
        `Gemini is not configured for Vertex AI. Ensure studentagent.json exists and the service account ` +
        `(${serviceAccountEmail}) has the "Vertex AI User" role in Google Cloud Console.`
      )
    }

    // Use Vertex AI Generative AI endpoint with service account
    const accessToken = await getAccessToken()
    const location = 'us-central1' // Default location, can be configured
    
    // Use Vertex AI Generative AI API endpoint (supports service accounts)
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
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Image,
              },
            },
          ],
        }],
        generationConfig: {
          temperature: 0.1, // Lower temperature for more deterministic, faster responses
          maxOutputTokens: 8192, // Maximum tokens to handle large schedules
          responseMimeType: 'application/json', // Request JSON format directly
        },
      }),
    })

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as VertexAIError
      const errorMessage = errorData.error?.message || JSON.stringify(errorData)
      console.error('Vertex AI API error:', errorData)
      
      // Check if it's a permission error
      if (response.status === 403 && errorData.error?.status === 'PERMISSION_DENIED') {
        const serviceAccountEmail = getServiceAccountKey()?.client_email || 'your service account'
        throw new Error(
          `Service account lacks Vertex AI permissions. ` +
          `Please grant the "Vertex AI User" role to the service account ` +
          `(${serviceAccountEmail}) in Google Cloud Console.\n\n` +
          `To grant permissions:\n` +
          `1. Go to https://console.cloud.google.com/iam-admin/iam?project=${getProjectId()}\n` +
          `2. Find the service account: ${serviceAccountEmail}\n` +
          `3. Click "Edit" and add role "Vertex AI User"\n` +
          `4. Save and wait a few minutes for changes to propagate`
        )
      }

      throw new Error(`Vertex AI API error: ${response.status} ${errorMessage}`)
    }

    const data = (await response.json()) as VertexAIResponse
    // Parse Vertex AI response format (same as Gemini API)
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      const content = data.candidates[0].content
      // Handle both text and functionCall responses
      if (content.parts && content.parts[0]) {
        textResponse = content.parts[0].text || ''
        // Check if response was truncated
        if (data.candidates[0].finishReason === 'MAX_TOKENS') {
          console.warn('Response was truncated due to maxOutputTokens limit')
        }
      } else {
        throw new Error('Unexpected response format from Vertex AI: missing parts')
      }
    } else {
      console.error('Unexpected Vertex AI response structure:', JSON.stringify(data, null, 2))
      throw new Error('Unexpected response format from Vertex AI')
    }

    console.log('Received response from Gemini API')
    console.log('Gemini response length:', textResponse.length)
    console.log('Gemini response preview:', textResponse.substring(0, 200))

    // Parse JSON response (handle various response formats)
    let classes: ClassData[]
    try {
      // Clean the response - remove markdown code blocks if present
      let cleanedResponse = textResponse.trim()
      
      // Remove markdown code blocks (```json ... ``` or ``` ... ```)
      cleanedResponse = cleanedResponse.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')
      
      // Try parsing directly first
      classes = JSON.parse(cleanedResponse.trim()) as ClassData[]
    } catch (parseError) {
      console.log('Direct parse failed, trying to extract JSON array...')
      // Fallback: extract JSON array from response
      const jsonMatch = textResponse.match(/\[[\s\S]*?\]/s)
      if (jsonMatch) {
        try {
          classes = JSON.parse(jsonMatch[0]) as ClassData[]
        } catch (matchError) {
          const errorMessage = matchError instanceof Error ? matchError.message : String(matchError)
          console.error('Failed to parse extracted JSON:', errorMessage)
          console.error('Extracted JSON:', jsonMatch[0].substring(0, 200))
          const parseErrorMessage = parseError instanceof Error ? parseError.message : String(parseError)
          return res.status(500).json({ 
            error: 'Failed to parse JSON from Gemini response',
            details: parseErrorMessage,
            responsePreview: textResponse.substring(0, 500)
          })
        }
      } else {
        console.error('No JSON array found in response')
        return res.status(500).json({ 
          error: 'No JSON array found in Gemini response',
          responsePreview: textResponse.substring(0, 500)
        })
      }
    }
    
    // Ensure it's an array
    if (!Array.isArray(classes)) {
      return res.status(500).json({ 
        error: 'Gemini response is not a JSON array',
        receivedType: typeof classes,
        responsePreview: textResponse.substring(0, 500)
      })
    }

    // Validate and clean the parsed classes
    const validClasses: ParsedClass[] = classes
      .filter((cls): cls is ClassData => {
        return (
          cls !== null &&
          typeof cls === 'object' &&
          typeof cls.name === 'string' &&
          cls.name.trim().length > 0 &&
          Array.isArray(cls.days) &&
          cls.days.length > 0 &&
          typeof cls.timeRange === 'string' &&
          cls.timeRange.trim().length > 0
        )
      })
      .map((cls) => ({
        name: cls.name.trim(),
        days: cls.days.map((d) => String(d).toUpperCase().trim()).filter((d) => ['M', 'T', 'W', 'TH', 'F'].includes(d)),
        timeRange: cls.timeRange.trim(),
      }))
      .filter((cls) => cls.days.length > 0)

    // Extract and record token usage
    const tokenUsage = data.usageMetadata?.totalTokenCount || 0
    console.log(`Vertex AI response - token usage: ${tokenUsage} (metadata:`, data.usageMetadata, ')')
    
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

    console.log(`Successfully parsed ${validClasses.length} classes`)
    res.json({ classes: validClasses })
  } catch (error) {
    console.error('Error parsing schedule:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('Error stack:', errorStack)
    res.status(500).json({
      error: 'Failed to parse schedule',
      message: errorMessage,
      details: process.env.NODE_ENV === 'development' ? errorStack : undefined,
    })
  }
})

export default router

