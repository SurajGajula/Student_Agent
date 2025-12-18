import express, { Request, Response } from 'express'
import { getGeminiClient } from '../services/gemini.js'

const router = express.Router()

router.get('/', (req: Request, res: Response) => {
  res.json({ 
    message: 'Schedule Parser API',
    endpoints: {
      health: '/health',
      parseSchedule: 'POST /api/parse-schedule'
    },
    geminiInitialized: getGeminiClient() !== null
  })
})

export default router

