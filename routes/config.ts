import express, { Request, Response } from 'express'

const router = express.Router()

// Public endpoint to serve frontend configuration
// This allows the frontend to get environment variables at runtime
router.get('/config', (_req: Request, res: Response) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || '',
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    apiUrl: process.env.API_URL || process.env.FRONTEND_URL || process.env.AMPLIFY_URL || 'http://localhost:3001'
  })
})

export default router

