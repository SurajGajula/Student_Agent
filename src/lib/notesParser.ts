/**
 * API endpoint for the backend server
 * Can be configured via environment variable or defaults to localhost
 */
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

/**
 * Calls the backend API to parse notes image using service account credentials
 * @param imageFile - The image file containing the notes
 * @returns Promise resolving to extracted text
 */
async function extractNotesWithBackendAPI(imageFile: File | Blob): Promise<string> {
  const formData = new FormData()
  formData.append('image', imageFile)

  // Add timeout to prevent hanging (increased for Gemini API processing time)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 180000) // 180 second (3 minute) timeout

  try {
    const response = await fetch(`${API_BASE_URL}/api/parse-notes`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    })
    
    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.error || errorData.message || `HTTP ${response.status} ${response.statusText}`
      
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
 * Parse notes image and extract text
 * @param imageFile - The image file containing handwritten notes
 * @returns Promise resolving to extracted text
 */
export async function parseNotesImage(imageFile: File | Blob): Promise<string> {
  console.log('Parsing notes via backend API at', API_BASE_URL)
  
  // Check backend health first
  const isHealthy = await checkBackendHealth()
  if (!isHealthy) {
    throw new Error(
      `Cannot connect to backend server at ${API_BASE_URL}. ` +
      `Please ensure the backend server is running:\n` +
      `  npm run dev:server\n\n` +
      `Or start both frontend and backend together:\n` +
      `  npm run dev:all`
    )
  }
  
  console.log('Backend server is reachable, sending image...')
  
  try {
    const text = await extractNotesWithBackendAPI(imageFile)
    console.log('Parsed notes text length:', text.length)
    
    if (text.length === 0) {
      console.warn('No text found in notes image')
    }
    
    return text
  } catch (error) {
    console.error('Error parsing notes:', error)
    
    // Provide helpful error message if backend is not reachable
    if (error instanceof TypeError && (error.message.includes('fetch') || error.message.includes('Failed to fetch'))) {
      throw new Error(
        `Network error: Cannot connect to backend API at ${API_BASE_URL}. ` +
        `Please ensure the backend server is running (npm run dev:server).`
      )
    }
    
    throw error
  }
}

