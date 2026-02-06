import { getApiBaseUrl } from './platform'

/**
 * Platform-aware file handling (supports images and PDFs)
 */
const createFormData = async (imageSource: File | Blob | string): Promise<FormData> => {
  const formData = new FormData()
  
  // React Native - imageSource is a string URI
  if (typeof imageSource === 'string') {
    // @ts-ignore - React Native FormData accepts different types
    // Note: For PDFs on React Native, would need document picker instead
    formData.append('image', {
      uri: imageSource,
      type: 'image/jpeg',
      name: 'photo.jpg',
    } as any)
  } 
  // Web - imageSource is File or Blob (can be image or PDF)
  else {
    formData.append('image', imageSource)
  }
  
  return formData
}

/**
 * Calls the backend API to parse notes from YouTube URL using service account credentials
 * @param youtubeUrl - The YouTube video URL
 * @returns Promise resolving to extracted text
 */
async function extractNotesFromYouTube(youtubeUrl: string): Promise<{ text: string; videoTitle?: string }> {
  const API_BASE_URL = getApiBaseUrl()

  // Get auth token
  const { supabase } = await import('./supabase')
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    throw new Error('You must be logged in to use this feature')
  }

  // Add timeout to prevent hanging (increased for Gemini API processing time, YouTube videos take longer)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 300000) // 5 minute timeout for YouTube videos

  try {
    const formData = new FormData()
    formData.append('youtubeUrl', youtubeUrl)

    const response = await fetch(`${API_BASE_URL}/api/parse-notes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      },
      body: formData,
      signal: controller.signal,
    })
    
    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.error || errorData.message || `HTTP ${response.status} ${response.statusText}`
      
      if (response.status === 401) {
        throw new Error('Authentication required. Please log in to use this feature.')
      }
      
      if (response.status === 429) {
        const remaining = errorData.remaining || 0
        const limit = errorData.limit || 0
        throw new Error(
          `Monthly token limit exceeded. You have used ${limit - remaining} of ${limit} tokens. ` +
          `Please upgrade your plan or wait until next month.`
        )
      }
      
      if (response.status === 500) {
        throw new Error(
          `Backend API error: ${errorMessage}. ` +
          `Please ensure the backend server is running and studentagent.json is in the root directory.`
        )
      }
      
      if (response.status === 400) {
        throw new Error(`Invalid request: ${errorMessage}`)
      }

      throw new Error(`Failed to parse YouTube video: ${errorMessage}`)
    }

    const data = await response.json()
    
    if (typeof data.text !== 'string') {
      throw new Error('Invalid response from backend API: missing text field')
    }

    return {
      text: data.text,
      videoTitle: data.videoTitle
    }
  } catch (error: unknown) {
    clearTimeout(timeoutId)
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(
        `Request timed out after 5 minutes. ` +
        `The video processing is taking longer than expected. ` +
        `Please try again or check if the server is running at ${API_BASE_URL}`
      )
    }
    
    // Re-throw other errors
    throw error
  }
}

/**
 * Calls the backend API to parse notes file (image or PDF) using service account credentials
 * @param imageSource - The image file or PDF (web) or URI (native) containing the notes
 * @returns Promise resolving to extracted text
 */
async function extractNotesWithBackendAPI(imageSource: File | Blob | string): Promise<string> {
  const formData = await createFormData(imageSource)

  // Get auth token
  const { supabase } = await import('./supabase')
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    throw new Error('You must be logged in to use this feature')
  }

  // Add timeout to prevent hanging (increased for Gemini API processing time)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 180000) // 180 second (3 minute) timeout
  const API_BASE_URL = getApiBaseUrl()

  try {
    const response = await fetch(`${API_BASE_URL}/api/parse-notes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      },
      body: formData,
      signal: controller.signal,
    })
    
    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.error || errorData.message || `HTTP ${response.status} ${response.statusText}`
      
      if (response.status === 401) {
        throw new Error('Authentication required. Please log in to use this feature.')
      }
      
      if (response.status === 429) {
        const remaining = errorData.remaining || 0
        const limit = errorData.limit || 0
        throw new Error(
          `Monthly token limit exceeded. You have used ${limit - remaining} of ${limit} tokens. ` +
          `Please upgrade your plan or wait until next month.`
        )
      }
      
      if (response.status === 500) {
        throw new Error(
          `Backend API error: ${errorMessage}. ` +
          `Please ensure the backend server is running and studentagent.json is in the root directory.`
        )
      }
      
      if (response.status === 400) {
        throw new Error(`Invalid request: ${errorMessage}`)
      }

      throw new Error(`Failed to parse notes: ${errorMessage}`)
    }

    const data = await response.json()
    
    if (typeof data.text !== 'string') {
      throw new Error('Invalid response from backend API: missing text field')
    }

    return data.text
  } catch (error: unknown) {
    clearTimeout(timeoutId)
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(
        `Request timed out after 3 minutes. ` +
        `The file processing is taking longer than expected. ` +
        `Please try again or check if the server is running at ${API_BASE_URL}`
      )
    }
    
    // Re-throw other errors
    throw error
  }
}

/**
 * Check if backend server is reachable
 */
async function checkBackendHealth(): Promise<boolean> {
  try {
    const API_BASE_URL = getApiBaseUrl()
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000), // 5 second timeout for health check
    })
    return response.ok
  } catch (error) {
    return false
  }
}

/**
 * Parse notes from YouTube URL and extract text
 * @param youtubeUrl - The YouTube video URL
 * @returns Promise resolving to object with extracted text and video title
 */
export async function parseNotesFromYouTube(youtubeUrl: string): Promise<{ text: string; videoTitle?: string }> {
  const API_BASE_URL = getApiBaseUrl()
  
  // Check backend health first
  const isHealthy = await checkBackendHealth()
  if (!isHealthy) {
    throw new Error(
      `Cannot connect to backend server at ${API_BASE_URL}. ` +
      `Please ensure the backend server is running.`
    )
  }
  
  try {
    const result = await extractNotesFromYouTube(youtubeUrl)
    
    if (result.text.length === 0) {
      console.warn('No text found in YouTube video')
    }
    
    return result
  } catch (error) {
    console.error('Error parsing YouTube video:', error)
    
    // Provide helpful error message if backend is not reachable
    if (error instanceof TypeError && (error.message.includes('fetch') || error.message.includes('Failed to fetch'))) {
      throw new Error(
        `Network error: Cannot connect to backend API at ${API_BASE_URL}. ` +
        `Please ensure the backend server is running.`
      )
    }
    
    throw error
  }
}

/**
 * Parse notes file (image or PDF) and extract text
 * @param imageSource - The image file or PDF (web) or URI (native) containing notes
 * @returns Promise resolving to extracted text
 */
export async function parseNotesImage(imageSource: File | Blob | string): Promise<string> {
  const API_BASE_URL = getApiBaseUrl()
  
  // Check backend health first
  const isHealthy = await checkBackendHealth()
  if (!isHealthy) {
    throw new Error(
      `Cannot connect to backend server at ${API_BASE_URL}. ` +
      `Please ensure the backend server is running.`
    )
  }
  
  try {
    const text = await extractNotesWithBackendAPI(imageSource)
    
    if (text.length === 0) {
      console.warn('No text found in notes file')
    }
    
    return text
  } catch (error) {
    console.error('Error parsing notes:', error)
    
    // Provide helpful error message if backend is not reachable
    if (error instanceof TypeError && (error.message.includes('fetch') || error.message.includes('Failed to fetch'))) {
      throw new Error(
        `Network error: Cannot connect to backend API at ${API_BASE_URL}. ` +
        `Please ensure the backend server is running.`
      )
    }
    
    throw error
  }
}
