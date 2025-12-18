import express, { Request, Response } from 'express'
import {
  getGeminiClient,
  isVertexAI,
  getProjectId,
  getAccessToken,
  getAuthClient,
  initializeGeminiClient
} from '../services/gemini.js'

interface GenerateTestRequest {
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
}

interface VertexAIError {
  error?: {
    message?: string
    status?: string
  }
}

interface GeneratedQuestion {
  id: string
  question: string
  type: 'multiple-choice' | 'short-answer'
  options?: string[]
  correctAnswer?: string
}

interface GeneratedTestResponse {
  questions: GeneratedQuestion[]
}

const router = express.Router()

// Generate test questions using Gemini
async function generateTestQuestions(noteContent: string): Promise<GeneratedQuestion[]> {
  let geminiClient = getGeminiClient()
  if (!geminiClient) {
    console.log('Initializing Gemini client...')
    await initializeGeminiClient()
    geminiClient = getGeminiClient()
  }

  if (!geminiClient) {
    throw new Error('Failed to initialize Gemini client')
  }

  const prompt = `You are an educational assistant. Generate exactly 10 test questions based on the following notes content.

Notes Content:
${noteContent}

Requirements:
1. Generate exactly 10 questions
2. Use a mix of question types: some multiple-choice (with 4 options each) and some short-answer questions
3. Questions should test understanding of key concepts, facts, and relationships from the notes
4. For multiple-choice questions, include 4 options labeled A, B, C, D
5. Make questions progressively more challenging
6. Ensure questions cover different topics/sections from the notes

Return your response as a JSON object with this exact structure:
{
  "questions": [
    {
      "question": "Question text here?",
      "type": "multiple-choice",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option A"
    },
    {
      "question": "Question text here?",
      "type": "short-answer",
      "correctAnswer": "Brief answer"
    }
  ]
}

Return ONLY the JSON object, no additional text or markdown formatting.`

  console.log('Calling Gemini API to generate test questions...')
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

    const parsed = JSON.parse(cleanedResponse) as GeneratedTestResponse

    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      throw new Error('Invalid response format: missing questions array')
    }

    // Ensure we have exactly 10 questions (pad or truncate if needed)
    let questions = parsed.questions.slice(0, 10)
    if (questions.length < 10) {
      console.warn(`Only received ${questions.length} questions, expected 10`)
    }

    // Add IDs to questions
    return questions.map((q, index) => ({
      ...q,
      id: `q${index + 1}`,
    })) as GeneratedQuestion[]
  } catch (error) {
    console.error('Error parsing Gemini response:', error)
    throw new Error(`Failed to parse test questions: ${error instanceof Error ? error.message : String(error)}`)
  }
}

router.post('/generate', async (req: Request, res: Response) => {
  console.log('Received test generation request')
  
  try {
    const { noteId, noteName, noteContent }: GenerateTestRequest = req.body

    if (!noteId || !noteName) {
      return res.status(400).json({ 
        error: 'Note ID and name are required' 
      })
    }

    // Check if note content is provided
    if (!noteContent || !noteContent.trim()) {
      return res.status(400).json({ 
        error: 'Note content is required to generate test questions' 
      })
    }

    console.log(`Generating test from note: ${noteName} (${noteId})`)

    // Generate test questions using Gemini
    const questions = await generateTestQuestions(noteContent)

    // Create test response
    const testData = {
      testId: Date.now().toString(),
      name: `Test: ${noteName}`,
      noteId: noteId,
      noteName: noteName,
      questions: questions.map((q) => ({
        id: q.id,
        question: q.question,
        type: q.type,
        options: q.options,
        correctAnswer: q.correctAnswer,
      })),
    }

    console.log(`Successfully generated test with ${questions.length} questions`)

    res.json({
      success: true,
      test: testData,
    })
  } catch (error) {
    console.error('Error generating test:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    res.status(500).json({
      error: 'Failed to generate test',
      message: errorMessage,
    })
  }
})

export default router

