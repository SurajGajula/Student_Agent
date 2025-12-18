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

interface VertexAIResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string
      }>
    }
    finishReason?: string
  }>
}

interface VertexAIError {
  error?: {
    message?: string
    status?: string
  }
}

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage() })

router.post('/parse-notes', upload.single('image'), async (req: Request, res: Response) => {
  console.log('Received notes parsing request')
  
  try {
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

    // Prompt optimized for extracting text from handwritten lecture notes
    const prompt = `Extract all text from this image of handwritten lecture notes. 
Preserve the structure, formatting, and organization of the notes including:
- Headers and section titles
- Bullet points and lists
- Paragraphs and line breaks
- Any mathematical formulas or equations (preserve as written)
- Course codes, dates, and page numbers

Return the extracted text exactly as it appears, maintaining the original formatting and structure.
Do not add any commentary or explanations, just return the raw extracted text.`

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
          temperature: 0.1, // Lower temperature for more accurate text extraction
          maxOutputTokens: 8192, // Maximum tokens to handle long notes
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

    // Return the extracted text
    res.json({ text: textResponse })
  } catch (error) {
    console.error('Error parsing notes:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('Error stack:', errorStack)
    res.status(500).json({
      error: 'Failed to parse notes',
      message: errorMessage,
      details: process.env.NODE_ENV === 'development' ? errorStack : undefined,
    })
  }
})

export default router

