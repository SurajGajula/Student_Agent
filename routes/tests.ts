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

interface GenerateTestRequest {
  noteId: string
  noteName: string
  noteContent: string
  wrongQuestionTexts?: string[] // Questions that were answered incorrectly
  makeHarder?: boolean // If true, generate a harder test overall
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
async function generateTestQuestions(
  noteContent: string, 
  wrongQuestionTexts?: string[], 
  makeHarder?: boolean
): Promise<{ questions: GeneratedQuestion[], tokenUsage: number }> {
  let geminiClient = getGeminiClient()
  if (!geminiClient) {
    console.log('Initializing Gemini client...')
    await initializeGeminiClient()
    geminiClient = getGeminiClient()
  }

  if (!geminiClient) {
    throw new Error('Failed to initialize Gemini client')
  }

  let focusInstruction = ''
  if (wrongQuestionTexts && wrongQuestionTexts.length > 0) {
    focusInstruction = `IMPORTANT: The user previously answered these questions incorrectly:
${wrongQuestionTexts.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Generate questions that focus on the same concepts and topics as the questions above that were answered incorrectly. Create new questions (not repeats) that test similar knowledge areas where the user needs improvement.`
  } else if (makeHarder) {
    focusInstruction = `IMPORTANT: The user answered all previous questions correctly, so generate a significantly more challenging test. Use:
- More complex, nuanced questions requiring deeper understanding
- Questions that test application and analysis rather than just recall
- Tricky options that require careful reasoning to distinguish
- Advanced topics and subtleties from the notes
- Questions that combine multiple concepts`
  }

  const prompt = `You are an educational assistant. Generate exactly 10 test questions based on the following notes content.

Notes Content:
${noteContent}
${focusInstruction ? '\n' + focusInstruction + '\n' : ''}

Requirements:
1. Generate exactly 10 questions
2. ALL questions must be multiple-choice with exactly 4 options each
3. Questions should test understanding of key concepts, facts, and relationships from the notes
4. For each multiple-choice question, include 4 options labeled A, B, C, D
5. Make questions progressively more challenging${makeHarder ? ' (overall significantly harder than typical questions)' : ''}
6. Ensure questions cover different topics/sections from the notes${wrongQuestionTexts && wrongQuestionTexts.length > 0 ? ' (with emphasis on areas related to the incorrectly answered questions above)' : ''}
7. Only one option should be correct for each question

Return your response as a JSON object with this exact structure:
{
  "questions": [
    {
      "question": "Question text here?",
      "type": "multiple-choice",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option A"
    }
  ]
}

IMPORTANT: All questions must be multiple-choice. Do not include any short-answer questions.

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
        maxOutputTokens: 8192, // Increased to handle longer responses with 10 questions
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
  
  // Check if response was truncated
  const finishReason = data.candidates?.[0]?.finishReason
  if (finishReason === 'MAX_TOKENS') {
    console.warn('Response was truncated due to token limit. Consider increasing maxOutputTokens.')
  }
  
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
  console.log('Response length:', textResponse.length)
  console.log('Finish reason:', finishReason)
  console.log('Gemini response preview (first 500 chars):', textResponse.substring(0, 500))
  if (textResponse.length > 500) {
    console.log('Gemini response preview (last 500 chars):', textResponse.substring(Math.max(0, textResponse.length - 500)))
  }

  // Parse JSON response
  try {
    // Clean the response - remove markdown code blocks if present
    let cleanedResponse = textResponse.trim()
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.replace(/^```json\s*/i, '').replace(/\s*```$/g, '').trim()
    } else if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/g, '').trim()
    }

    // Check if response looks truncated (doesn't end with ] or })
    if (!cleanedResponse.endsWith(']') && !cleanedResponse.endsWith('}')) {
      console.warn('Response may be truncated - attempting to fix incomplete JSON')
      
      // Try to find the last complete question object
      const questionsArrayMatch = cleanedResponse.match(/"questions"\s*:\s*\[/);
      if (questionsArrayMatch && questionsArrayMatch.index !== undefined) {
        const questionsStart = questionsArrayMatch.index + questionsArrayMatch[0].length;
        const questionsContent = cleanedResponse.substring(questionsStart);
        
        // Find the last complete question object (ends with })
        let lastCompleteIndex = -1;
        let braceCount = 0;
        let inString = false;
        let escapeNext = false;
        
        for (let i = 0; i < questionsContent.length; i++) {
          const char = questionsContent[i];
          
          if (escapeNext) {
            escapeNext = false;
            continue;
          }
          
          if (char === '\\') {
            escapeNext = true;
            continue;
          }
          
          if (char === '"' && !escapeNext) {
            inString = !inString;
            continue;
          }
          
          if (!inString) {
            if (char === '{') {
              braceCount++;
            } else if (char === '}') {
              braceCount--;
              if (braceCount === 0) {
                lastCompleteIndex = i;
              }
            }
          }
        }
        
        if (lastCompleteIndex > 0) {
          // Extract valid JSON up to the last complete question
          const validQuestions = questionsContent.substring(0, lastCompleteIndex + 1);
          const beforeQuestions = cleanedResponse.substring(0, questionsStart);
          cleanedResponse = beforeQuestions + validQuestions + ']}';
          console.log('Fixed truncated JSON by extracting complete questions');
        }
      }
    }

    // Try to fix common JSON issues
    // Remove trailing commas before closing brackets/braces
    cleanedResponse = cleanedResponse.replace(/,(\s*[}\]])/g, '$1')

    const parsed = JSON.parse(cleanedResponse) as GeneratedTestResponse

    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      throw new Error('Invalid response format: missing questions array')
    }

    // Ensure we have exactly 10 questions (pad or truncate if needed)
    let questions = parsed.questions.slice(0, 10)
    if (questions.length < 10) {
      console.warn(`Only received ${questions.length} questions, expected 10`)
    }

    // Validate and clean each question (without id first)
    const cleanedQuestions = questions.filter(q => {
      if (!q.question || !q.type) {
        console.warn('Skipping invalid question:', q)
        return false
      }
      return true
    }).map(q => ({
      question: String(q.question || '').trim(),
      type: (q.type === 'multiple-choice' || q.type === 'short-answer') ? q.type : 'short-answer' as const,
      options: q.type === 'multiple-choice' && Array.isArray(q.options) ? q.options.map(opt => String(opt).trim()) : undefined,
      correctAnswer: q.correctAnswer ? String(q.correctAnswer).trim() : undefined,
    }))

    // Add IDs to questions
    return {
      questions: cleanedQuestions.map((q, index) => ({
        ...q,
        id: `q${index + 1}`,
      })) as GeneratedQuestion[],
      tokenUsage
    }
  } catch (error) {
    console.error('Error parsing Gemini response:', error)
    console.error('Raw response length:', textResponse.length)
    console.error('Raw response (first 2000 chars):', textResponse.substring(0, 2000))
    if (textResponse.length > 2000) {
      console.error('Raw response (last 1000 chars):', textResponse.substring(Math.max(0, textResponse.length - 1000)))
    }
    throw new Error(`Failed to parse test questions: ${error instanceof Error ? error.message : String(error)}`)
  }
}

router.post('/generate', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  console.log('Received test generation request')
  
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const { noteId, noteName, noteContent, wrongQuestionTexts, makeHarder }: GenerateTestRequest = req.body

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

    console.log(`Generating test from note: ${noteName} (${noteId})`)

    // Generate test questions using Gemini
    const { questions, tokenUsage } = await generateTestQuestions(noteContent, wrongQuestionTexts, makeHarder)

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

