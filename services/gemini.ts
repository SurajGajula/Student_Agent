import { GoogleAuth, OAuth2Client } from 'google-auth-library'
import { existsSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

interface ServiceAccountKey {
  project_id: string
  client_email: string
  [key: string]: unknown
}

interface VertexAIClient {
  token: string
  projectId: string
}

// Initialize Gemini client with service account
let geminiClient: VertexAIClient | null = null
let authClient: GoogleAuth | null = null
let useVertexAI = false
let projectId: string | null = null

// Store service account key for error messages
let serviceAccountKey: ServiceAccountKey | null = null

// Cache access token to avoid refreshing on every request
let cachedAccessToken: string | null = null
let tokenExpiryTime: number | null = null

export function getAuthClient(): GoogleAuth | null {
  return authClient
}

export async function initializeGeminiClient(): Promise<boolean> {
  // Try service account from environment variable first (base64 encoded)
  try {
    let loadedServiceAccountKey: ServiceAccountKey | null = null
    
    // Try environment variable (base64 encoded) - preferred for production
    const serviceAccountBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_BASE64
    if (serviceAccountBase64) {
      try {
        console.log('Attempting to decode service account from GOOGLE_SERVICE_ACCOUNT_BASE64 (length:', serviceAccountBase64.length, ')')
        const serviceAccountJson = Buffer.from(serviceAccountBase64, 'base64').toString('utf8')
        loadedServiceAccountKey = JSON.parse(serviceAccountJson) as ServiceAccountKey
        console.log('Loaded service account from GOOGLE_SERVICE_ACCOUNT_BASE64 environment variable (project:', loadedServiceAccountKey.project_id, ')')
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error('Failed to decode service account from environment variable:', errorMessage)
        if (error instanceof Error && error.stack) {
          console.error('Stack trace:', error.stack)
        }
      }
    } else {
      console.log('GOOGLE_SERVICE_ACCOUNT_BASE64 environment variable not set')
    }
    
    // Fallback to file if env var not available (for local development)
    if (!loadedServiceAccountKey) {
      // Try multiple possible paths (in order of preference)
      const possiblePaths = [
        join(process.cwd(), 'studentagent.json'), // Project root (most reliable)
        join(__dirname, '..', 'studentagent.json'), // Relative to compiled file
        'studentagent.json', // Current directory
      ]
      
      console.log(`[gemini.ts] Looking for studentagent.json file...`)
      console.log(`[gemini.ts] process.cwd(): ${process.cwd()}`)
      console.log(`[gemini.ts] __dirname: ${__dirname}`)
      
      let foundPath: string | null = null
      for (const serviceAccountPath of possiblePaths) {
        console.log(`[gemini.ts] Checking: ${serviceAccountPath} (exists: ${existsSync(serviceAccountPath)})`)
        if (existsSync(serviceAccountPath)) {
          foundPath = serviceAccountPath
          break
        }
      }
      
      if (foundPath) {
        try {
          console.log(`[gemini.ts] ✓ Found file at: ${foundPath}`)
          const fileContent = readFileSync(foundPath, 'utf8')
          loadedServiceAccountKey = JSON.parse(fileContent) as ServiceAccountKey
          console.log(`[gemini.ts] ✓ Loaded service account from studentagent.json file (project: ${loadedServiceAccountKey.project_id})`)
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          console.error(`[gemini.ts] ✗ Failed to read/parse studentagent.json: ${errorMessage}`)
          if (error instanceof Error && error.stack) {
            console.error(`[gemini.ts] Stack trace: ${error.stack}`)
          }
        }
      } else {
        console.error(`[gemini.ts] ✗ studentagent.json not found in any of the checked paths:`)
        possiblePaths.forEach(path => console.error(`[gemini.ts]   - ${path}`))
      }
    }
    
    if (loadedServiceAccountKey) {
      // Store the service account key in module variable for getServiceAccountKey()
      serviceAccountKey = loadedServiceAccountKey
      
      // Set up GoogleAuth with service account credentials
      const auth = new GoogleAuth({
        credentials: loadedServiceAccountKey,
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      })

      // Get access token for authentication
      const client = await auth.getClient()
      const tokenResponse = await (client as OAuth2Client).getAccessToken()
      
      if (tokenResponse.token) {
        // For service accounts, we'll use Vertex AI endpoint with Bearer token
        // Store auth client and project ID for making authenticated requests
        useVertexAI = true
        projectId = loadedServiceAccountKey.project_id
        authClient = auth
        geminiClient = {
          token: tokenResponse.token,
          projectId: projectId,
        }
        console.log(`Gemini client initialized with service account (project: ${projectId})`)
        return true
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Failed to initialize with service account:', errorMessage)
  }

  throw new Error(
    'Failed to initialize Gemini client. Please ensure:\n' +
    '1. GOOGLE_SERVICE_ACCOUNT_BASE64 environment variable is set (base64 encoded JSON), or\n' +
    '2. studentagent.json exists in the project root directory, and\n' +
    '3. The service account has access to Vertex AI (e.g. role "Vertex AI User").'
  )
}

export async function getAccessToken(): Promise<string> {
  if (!authClient) {
    throw new Error('Auth client not initialized')
  }
  
  // Use cached token if still valid (tokens typically expire after 1 hour)
  if (cachedAccessToken && tokenExpiryTime && Date.now() < tokenExpiryTime) {
    return cachedAccessToken
  }
  
  const client = await authClient.getClient()
  const tokenResponse = await (client as OAuth2Client).getAccessToken()
  if (!tokenResponse.token) {
    throw new Error('Failed to get access token')
  }
  cachedAccessToken = tokenResponse.token
  // Cache for 50 minutes (tokens typically valid for 1 hour)
  tokenExpiryTime = Date.now() + (50 * 60 * 1000)
  return cachedAccessToken
}

export function getGeminiClient(): VertexAIClient | null {
  return geminiClient
}

export function isVertexAI(): boolean {
  return useVertexAI
}

export function getProjectId(): string | null {
  return projectId
}

export function getServiceAccountKey(): ServiceAccountKey | null {
  return serviceAccountKey
}

export function setGeminiClient(client: VertexAIClient): void {
  geminiClient = client
}

export function setUseVertexAI(value: boolean): void {
  useVertexAI = value
}

