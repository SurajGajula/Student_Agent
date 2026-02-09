import express, { Request, Response } from 'express'
import { getGeminiClient } from '../services/gemini.js'

const router = express.Router()

router.get('/', (_req: Request, res: Response) => {
  res.json({ 
    message: 'Student Agent API',
    endpoints: {
      health: '/health',
      parseNotes: 'POST /api/parse-notes',
      chat: 'POST /api/chat'
    },
    geminiInitialized: getGeminiClient() !== null
  })
})

export default router

