import express, { Request, Response } from 'express'
import { getGeminiClient, getProjectId, getServiceAccountKey } from '../services/gemini.js'

const router = express.Router()

router.get('/', (_req: Request, res: Response) => {
  const geminiClient = getGeminiClient()
  const serviceAccount = getServiceAccountKey()
  
  res.json({ 
    status: 'ok', 
    geminiInitialized: geminiClient !== null,
    geminiProjectId: getProjectId() || null,
    hasServiceAccount: serviceAccount !== null,
    serviceAccountProject: serviceAccount?.project_id || null,
    hasGoogleServiceAccountEnvVar: !!process.env.GOOGLE_SERVICE_ACCOUNT_BASE64,
    timestamp: new Date().toISOString()
  })
})

export default router

