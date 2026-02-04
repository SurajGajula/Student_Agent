import express, { Response } from 'express'
import multer from 'multer'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import os from 'os'

const execAsync = promisify(exec)
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

router.post('/parse-notes', authenticateUser, upload.single('image'), async (req: AuthenticatedRequest, res: Response) => {
  console.log('Received notes parsing request')
  
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

    // Check for YouTube URL or file
    const youtubeUrl = req.body.youtubeUrl
    const hasFile = !!req.file
    const hasYoutubeUrl = youtubeUrl && typeof youtubeUrl === 'string' && 
      (youtubeUrl.includes('youtube.com/watch') || youtubeUrl.includes('youtu.be/'))

    if (!hasFile && !hasYoutubeUrl) {
      return res.status(400).json({ error: 'Please provide either a file or a YouTube URL' })
    }

    let prompt = ''
    let estimatedTokens = 2000
    let parts: any[] = []
    let videoTitleFromInfo: string | undefined = undefined

    if (hasYoutubeUrl) {
      // Validate YouTube URL format
      const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
      const videoIdMatch = youtubeUrl.match(youtubeRegex)
      if (!videoIdMatch) {
        return res.status(400).json({ error: 'Invalid YouTube URL format' })
      }
      
      const videoId = videoIdMatch[1]
      console.log(`Processing YouTube video: ${youtubeUrl} (ID: ${videoId})`)

      // Extract audio only using yt-dlp (much more token-efficient than video)
      console.log('Extracting audio only from YouTube video using yt-dlp')
      
      // Create temporary file for audio output (yt-dlp will add extension)
      // Defined outside try block so it's accessible in catch block for transcript fallback
      const tempDir = os.tmpdir()
      const tempFileBase = path.join(tempDir, `audio_${Date.now()}`)
      
      try {
        
        // Use yt-dlp to extract audio and get video title
        console.log('Downloading audio with yt-dlp...')
        
        // First, get video title
        try {
          const { stdout: titleOutput } = await execAsync(`yt-dlp --get-title --no-warnings --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" "${youtubeUrl}"`, {
            timeout: 30000
          })
          videoTitleFromInfo = titleOutput.trim()
          console.log(`Video title: ${videoTitleFromInfo}`)
        } catch (titleError) {
          console.log('Could not fetch video title, will extract from response:', titleError instanceof Error ? titleError.message : String(titleError))
        }
        
        // Extract audio in best available format (opus is typically best quality)
        // Add user agent and other options to avoid 403 errors
        // Try multiple strategies to bypass YouTube's restrictions
        const ytDlpStrategies = [
          // Strategy 1: Android client (often more reliable)
          `yt-dlp -x --audio-format opus --audio-quality 0 --no-warnings --user-agent "Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36" --extractor-args "youtube:player_client=android" -o "${tempFileBase}.%(ext)s" "${youtubeUrl}"`,
          // Strategy 2: Web client with modern user agent
          `yt-dlp -x --audio-format opus --audio-quality 0 --no-warnings --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" --extractor-args "youtube:player_client=web" -o "${tempFileBase}.%(ext)s" "${youtubeUrl}"`,
          // Strategy 3: iOS client
          `yt-dlp -x --audio-format opus --audio-quality 0 --no-warnings --user-agent "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15" --extractor-args "youtube:player_client=ios" -o "${tempFileBase}.%(ext)s" "${youtubeUrl}"`,
          // Strategy 4: TV client
          `yt-dlp -x --audio-format opus --audio-quality 0 --no-warnings --extractor-args "youtube:player_client=tv" -o "${tempFileBase}.%(ext)s" "${youtubeUrl}"`
        ]
        
        let downloadSuccess = false
        let lastError: Error | null = null
        
        for (let i = 0; i < ytDlpStrategies.length; i++) {
          try {
            console.log(`Trying download strategy ${i + 1}/${ytDlpStrategies.length}...`)
            await execAsync(ytDlpStrategies[i], {
              timeout: 600000 // 10 minute timeout for long videos
            })
            downloadSuccess = true
            console.log(`Download successful with strategy ${i + 1}`)
            break
          } catch (strategyError) {
            lastError = strategyError instanceof Error ? strategyError : new Error(String(strategyError))
            console.log(`Strategy ${i + 1} failed:`, lastError.message)
            if (i < ytDlpStrategies.length - 1) {
              // Wait a bit before trying next strategy
              await new Promise(resolve => setTimeout(resolve, 2000))
            }
          }
        }
        
        if (!downloadSuccess) {
          // If all strategies fail, try to use transcript API as fallback
          console.log('All download strategies failed, attempting to use transcript API as fallback...')
          throw new Error('YT_DLP_FALLBACK_TO_TRANSCRIPT')
        }
        
        // Find the actual file that was created (yt-dlp adds extension)
        let tempFile = `${tempFileBase}.opus`
        if (!fs.existsSync(tempFile)) {
          // Try other common extensions
          const extensions = ['opus', 'webm', 'm4a', 'mp3']
          tempFile = extensions.find(ext => fs.existsSync(`${tempFileBase}.${ext}`)) ? 
            `${tempFileBase}.${extensions.find(ext => fs.existsSync(`${tempFileBase}.${ext}`))}` : 
            tempFile
        }
        
        if (!fs.existsSync(tempFile)) {
          throw new Error('Audio file was not created by yt-dlp')
        }
        
        // Read the audio file
        const audioBuffer = fs.readFileSync(tempFile)
        console.log(`Downloaded audio: ${audioBuffer.length} bytes`)
        
        // Determine mime type from file extension
        const ext = path.extname(tempFile).toLowerCase()
        const audioMimeType = 
          ext === '.opus' || ext === '.webm' ? 'audio/webm' :
          ext === '.mp3' ? 'audio/mpeg' :
          ext === '.m4a' ? 'audio/mp4' :
          'audio/webm' // Default to webm
        
        // Clean up temp file
        fs.unlinkSync(tempFile)
        
        // Convert audio buffer to base64
        const base64Audio = audioBuffer.toString('base64')
        
        prompt = `Listen to this audio from a YouTube video and generate comprehensive lecture notes.
Write the notes as if you are directly explaining the content and concepts yourself, using the audio as a reference.

IMPORTANT: At the very beginning of your response, on the first line, provide ONLY the video title in this exact format:
VIDEO_TITLE: ${videoTitleFromInfo}

Then on the next line, start the notes content.

Requirements for the notes:
- Write in first person or direct explanation style (avoid phrases like "the video says", "the audio explains", "here is the content", etc.)
- Include main topics and concepts covered
- Include key points and explanations
- Include important formulas or equations (preserve as written)
- Include examples and use cases
- Include any course codes, dates, or references
- Use plain text only - NO markdown formatting (no **, ###, ##, *, etc.)
- Format with clear sections using plain text headers (just capitalized text, no markdown)
- Use bullet points with plain text dashes (-) only
- Return only the notes content after the VIDEO_TITLE line, no introductory or concluding text`

        // Audio processing uses much fewer tokens than video (88K vs 910K)
        // Estimate: ~50-100K tokens for 1 hour of audio vs 900K+ for video
        estimatedTokens = Math.ceil(audioBuffer.length / 100) + 3000 // Rough estimate
        
        // Send audio as inline data instead of video URL
        parts = [
          { text: prompt },
          {
            inlineData: {
              mimeType: audioMimeType,
              data: base64Audio,
            },
          },
        ]
      } catch (audioError) {
        console.error('Error extracting audio:', audioError)
        
        // If yt-dlp fails, try to use YouTube transcript API as fallback
        if (audioError instanceof Error && audioError.message === 'YT_DLP_FALLBACK_TO_TRANSCRIPT') {
          console.log('Attempting to use YouTube transcript API...')
          try {
            // Try to get transcript using yt-dlp's transcript feature
            let transcriptText = ''
            try {
              const { stdout: transcriptOutput } = await execAsync(`yt-dlp --write-auto-sub --sub-lang en --skip-download --no-warnings --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" "${youtubeUrl}" 2>&1 || yt-dlp --list-subs --no-warnings "${youtubeUrl}"`, {
                timeout: 30000
              })
              
              // Try to extract transcript directly
              const transcriptCommand = `yt-dlp --write-auto-sub --sub-lang en --skip-download --convert-subs srt --no-warnings --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" -o "${tempFileBase}.%(ext)s" "${youtubeUrl}"`
              await execAsync(transcriptCommand, { timeout: 60000 })
              
              // Look for SRT file
              const srtFile = `${tempFileBase}.en.srt`
              if (fs.existsSync(srtFile)) {
                const srtContent = fs.readFileSync(srtFile, 'utf-8')
                // Parse SRT: remove timestamps and sequence numbers, keep only text
                transcriptText = srtContent
                  .replace(/\d+\n\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}\n/g, '')
                  .replace(/^\d+\n/gm, '')
                  .split('\n')
                  .filter(line => line.trim().length > 0)
                  .join(' ')
                fs.unlinkSync(srtFile)
              }
            } catch (transcriptDlpError) {
              console.log('yt-dlp transcript extraction failed, trying direct API...')
            }
            
            // If yt-dlp transcript failed, try direct YouTube API
            if (!transcriptText || transcriptText.length < 100) {
              const transcriptUrl = `https://www.youtube.com/api/timedtext?lang=en&v=${videoId}&fmt=srv3`
              const transcriptResponse = await fetch(transcriptUrl, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
              })
              
              if (transcriptResponse.ok) {
                const transcriptXml = await transcriptResponse.text()
                // Parse XML transcript to text
                const textMatches = transcriptXml.match(/<text[^>]*>([^<]+)<\/text>/g)
                if (textMatches && textMatches.length > 0) {
                  transcriptText = textMatches
                    .map(match => match.replace(/<text[^>]*>|<\/text>/g, '').trim())
                    .filter(text => text.length > 0)
                    .join(' ')
                }
              }
            }
            
            if (transcriptText && transcriptText.length > 100) {
              console.log(`Using transcript (${transcriptText.length} chars) instead of audio`)
              
              // Use transcript text instead of audio
              prompt = `Generate comprehensive lecture notes from this YouTube video transcript.

Video Title: ${videoTitleFromInfo || 'Unknown'}

Transcript:
${transcriptText.substring(0, 100000)}${transcriptText.length > 100000 ? '...' : ''}

IMPORTANT: At the very beginning of your response, on the first line, provide ONLY the video title in this exact format:
VIDEO_TITLE: ${videoTitleFromInfo || 'Unknown'}

Then on the next line, start the notes content.

Requirements for the notes:
- Write in first person or direct explanation style (avoid phrases like "the transcript says", "the video explains", etc.)
- Include main topics and concepts covered
- Include key points and explanations
- Include important formulas or equations (preserve as written)
- Include examples and use cases
- Include any course codes, dates, or references
- Use plain text only - NO markdown formatting (no **, ###, ##, *, etc.)
- Format with clear sections using plain text headers (just capitalized text, no markdown)
- Use bullet points with plain text dashes (-) only
- Return only the notes content after the VIDEO_TITLE line, no introductory or concluding text`

              estimatedTokens = Math.ceil(transcriptText.length / 4) + 3000 // Rough estimate: ~4 chars per token
              
              parts = [
                { text: prompt }
              ]
            } else {
              throw new Error('Could not extract transcript - video may not have captions enabled')
            }
          } catch (transcriptError) {
            console.error('Transcript fallback also failed:', transcriptError)
            return res.status(500).json({ 
              error: 'Failed to extract audio or transcript from YouTube video. The video may be unavailable, private, restricted, or may not have captions enabled. Please ensure the video has captions/subtitles available.',
              suggestion: 'Try: 1) Ensure the video has captions enabled, 2) Update yt-dlp: pip install --upgrade yt-dlp, or 3) Try a different video',
              details: process.env.NODE_ENV === 'development' ? (audioError instanceof Error ? audioError.message : String(audioError)) : undefined
            })
          }
        } else {
          return res.status(500).json({ 
            error: 'Failed to extract audio from YouTube video. The video may be unavailable, private, or restricted.',
            suggestion: 'Try: 1) Update yt-dlp: pip install --upgrade yt-dlp, 2) Ensure the video is public and accessible, or 3) Try a different video',
            details: process.env.NODE_ENV === 'development' ? (audioError instanceof Error ? audioError.message : String(audioError)) : undefined
          })
        }
      }
    } else {
      // File processing (existing logic)
      if (!req.file) {
        return res.status(400).json({ error: 'No file provided' })
      }

      console.log(`Processing file: ${req.file.originalname}, size: ${req.file.size} bytes, type: ${req.file.mimetype}`)

      const fileBuffer = req.file.buffer
      const base64File = fileBuffer.toString('base64')
    const mimeType = req.file.mimetype || 'image/png'

      // Validate mime type and set appropriate prompt
      const isPdf = mimeType === 'application/pdf'
      const isImage = mimeType.startsWith('image/')
      
      if (!isImage && !isPdf) {
        return res.status(400).json({ error: 'Invalid file type. Please upload an image or PDF file.' })
      }

      // Adjust prompt based on file type
      prompt = isPdf 
        ? `Extract all text from this PDF document. 
Preserve the structure, formatting, and organization of the content including:
- Headers and section titles
- Bullet points and lists
- Paragraphs and line breaks
- Any mathematical formulas or equations (preserve as written)
- Course codes, dates, and page numbers

Return the extracted text exactly as it appears, maintaining the original formatting and structure.
Do not add any commentary or explanations, just return the raw extracted text.`
        : `Extract all text from this image of handwritten lecture notes. 
Preserve the structure, formatting, and organization of the notes including:
- Headers and section titles
- Bullet points and lists
- Paragraphs and line breaks
- Any mathematical formulas or equations (preserve as written)
- Course codes, dates, and page numbers

Return the extracted text exactly as it appears, maintaining the original formatting and structure.
Do not add any commentary or explanations, just return the raw extracted text.`

    // Check token limit before making API call
      // Estimate tokens needed - PDFs can be larger so increase estimate
      estimatedTokens = isPdf ? 5000 : 2000

      parts = [
        { text: prompt },
        {
          inlineData: {
            mimeType: mimeType,
            data: base64File,
          },
        },
      ]
    }
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
          parts: parts,
        }],
        generationConfig: {
          temperature: hasYoutubeUrl ? 0.3 : 0.1, // Slightly higher for YouTube to allow more natural note generation
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

    // For YouTube videos, extract the video title from the response or use title from video info
    let videoTitle: string | undefined = undefined
    let notesText = textResponse
    
    if (hasYoutubeUrl) {
      // Use title from video info if we extracted audio, otherwise try to extract from response
      if (videoTitleFromInfo) {
        videoTitle = videoTitleFromInfo
        // Remove VIDEO_TITLE line from response if present
        notesText = textResponse.replace(/^VIDEO_TITLE:\s*.+?(?:\n|$)/i, '').trim()
      } else {
        // Look for VIDEO_TITLE: prefix at the start of the response (for transcript-based processing)
        const titleMatch = textResponse.match(/^VIDEO_TITLE:\s*(.+?)(?:\n|$)/i)
        if (titleMatch && titleMatch[1]) {
          videoTitle = titleMatch[1].trim()
          // Remove the title line from the notes text
          notesText = textResponse.replace(/^VIDEO_TITLE:\s*.+?(?:\n|$)/i, '').trim()
        }
      }
    }

    // Return the extracted text (and video title if available)
    if (hasYoutubeUrl && videoTitle) {
      res.json({ text: notesText, videoTitle: videoTitle })
    } else {
      res.json({ text: notesText })
    }
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

