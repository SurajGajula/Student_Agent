import express, { Request, Response } from 'express'
import { getGeminiClient } from '../services/gemini.js'

const router = express.Router()

router.get('/', (_req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    geminiInitialized: getGeminiClient() !== null,
    timestamp: new Date().toISOString()
  })
})

export default router

