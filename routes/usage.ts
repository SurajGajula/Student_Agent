import express, { Response } from 'express'
import { authenticateUser, AuthenticatedRequest } from './middleware/auth.js'
import { getUserUsage } from '../services/usageTracking.js'

const router = express.Router()

router.get('/usage', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    console.log(`Fetching usage for user ${req.userId}`)
    const usage = await getUserUsage(req.userId)
    console.log(`Usage data retrieved:`, usage)

    res.json({
      success: true,
      ...usage
    })
  } catch (error) {
    console.error('Error fetching usage:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('Usage fetch error details:', errorMessage, errorStack)
    res.status(500).json({
      error: 'Failed to fetch usage',
      message: errorMessage,
      details: process.env.NODE_ENV === 'development' ? errorStack : undefined,
    })
  }
})

export default router

