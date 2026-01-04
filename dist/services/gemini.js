import { GoogleAuth } from 'google-auth-library';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Initialize Gemini client with service account
let geminiClient = null;
let authClient = null;
let useVertexAI = false;
let projectId = null;
// Store service account key for error messages
let serviceAccountKey = null;
// Cache access token to avoid refreshing on every request
let cachedAccessToken = null;
let tokenExpiryTime = null;
export function getAuthClient() {
    return authClient;
}
export async function initializeGeminiClient() {
    // Try service account first (using Application Default Credentials)
    try {
        const serviceAccountPath = join(__dirname, '..', 'studentagent.json');
        if (existsSync(serviceAccountPath)) {
            serviceAccountKey = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
            // Set up GoogleAuth with service account credentials
            const auth = new GoogleAuth({
                credentials: serviceAccountKey,
                scopes: ['https://www.googleapis.com/auth/cloud-platform'],
            });
            // Get access token for authentication
            const client = await auth.getClient();
            const tokenResponse = await client.getAccessToken();
            if (tokenResponse.token) {
                // For service accounts, we'll use Vertex AI endpoint with Bearer token
                // Store auth client and project ID for making authenticated requests
                useVertexAI = true;
                projectId = serviceAccountKey.project_id;
                authClient = auth;
                geminiClient = {
                    token: tokenResponse.token,
                    projectId: projectId,
                };
                console.log(`Gemini client initialized with service account (project: ${projectId})`);
                return true;
            }
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Failed to initialize with service account:', errorMessage);
    }
    throw new Error('Failed to initialize Gemini client. Please ensure:\n' +
        '1. studentagent.json exists in the project root directory, and\n' +
        '2. The service account has access to Vertex AI (e.g. role "Vertex AI User").');
}
export async function getAccessToken() {
    if (!authClient) {
        throw new Error('Auth client not initialized');
    }
    // Use cached token if still valid (tokens typically expire after 1 hour)
    if (cachedAccessToken && tokenExpiryTime && Date.now() < tokenExpiryTime) {
        return cachedAccessToken;
    }
    const client = await authClient.getClient();
    const tokenResponse = await client.getAccessToken();
    if (!tokenResponse.token) {
        throw new Error('Failed to get access token');
    }
    cachedAccessToken = tokenResponse.token;
    // Cache for 50 minutes (tokens typically valid for 1 hour)
    tokenExpiryTime = Date.now() + (50 * 60 * 1000);
    return cachedAccessToken;
}
export function getGeminiClient() {
    return geminiClient;
}
export function isVertexAI() {
    return useVertexAI;
}
export function getProjectId() {
    return projectId;
}
export function getServiceAccountKey() {
    return serviceAccountKey;
}
export function setGeminiClient(client) {
    geminiClient = client;
}
export function setUseVertexAI(value) {
    useVertexAI = value;
}
//# sourceMappingURL=gemini.js.map