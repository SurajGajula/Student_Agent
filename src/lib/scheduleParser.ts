import { getApiBaseUrl } from './platform'

export interface ParsedClass {
  name: string
  days: string[]
  timeRange: string
}

/**
 * API endpoint for the backend server
 * Can be configured via environment variable or defaults to localhost
 */
const API_BASE_URL = getApiBaseUrl()

/**
 * Platform-aware image handling
 */
const createFormData = async (imageSource: File | Blob | string): Promise<FormData> => {
  const formData = new FormData()
  
  // React Native - imageSource is a string URI
  if (typeof imageSource === 'string') {
    // @ts-ignore - React Native FormData accepts different types
    formData.append('image', {
      uri: imageSource,
      type: 'image/jpeg',
      name: 'photo.jpg',
    } as any)
  } 
  // Web - imageSource is File or Blob
  else {
    formData.append('image', imageSource)
  }
  
  return formData
}

/**
 * Calls the backend API to parse schedule image using service account credentials
 * @param imageSource - The image file (web) or URI (native) containing the schedule
 * @returns Promise resolving to array of parsed classes
 */
async function extractClassesWithBackendAPI(imageSource: File | Blob | string): Promise<ParsedClass[]> {
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

  try {
    const response = await fetch(`${API_BASE_URL}/api/parse-schedule`, {
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

    throw new Error(`Failed to parse schedule: ${errorMessage}`)
  }

    const data = await response.json()
    
    if (!data.classes || !Array.isArray(data.classes)) {
      throw new Error('Invalid response from backend API: missing classes array')
    }

    return data.classes
  } catch (error: unknown) {
    clearTimeout(timeoutId)
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(
        `Request timed out after 3 minutes. ` +
        `The image processing is taking longer than expected. ` +
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
 * Parse schedule image and extract classes
 * @param imageSource - The image file (web) or URI (native) containing the schedule
 * @returns Promise resolving to array of parsed classes
 */
export async function parseScheduleImage(imageSource: File | Blob | string): Promise<ParsedClass[]> {
  
  // Check backend health first
  const isHealthy = await checkBackendHealth()
  if (!isHealthy) {
    throw new Error(
      `Cannot connect to backend server at ${API_BASE_URL}. ` +
      `Please ensure the backend server is running.`
    )
  }
  
  try {
    const classes = await extractClassesWithBackendAPI(imageSource)
    
    if (classes.length === 0) {
      console.warn('No classes found in schedule image')
    }
    
    return classes
  } catch (error) {
    console.error('Error parsing schedule:', error)
    
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
