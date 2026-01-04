import express, { Request, Response } from 'express'

const router = express.Router()

// Public endpoint to serve frontend configuration
// This allows the frontend to get environment variables at runtime
router.get('/config', (_req: Request, res: Response) => {
  // Debug: Log what we're getting from environment
  console.log('[config.ts] Environment variables check:')
  console.log('[config.ts] SUPABASE_URL:', process.env.SUPABASE_URL ? 'SET (' + process.env.SUPABASE_URL.substring(0, 30) + '...)' : 'MISSING')
  console.log('[config.ts] SUPABASE_PUBLISHABLE_KEY:', process.env.SUPABASE_PUBLISHABLE_KEY ? 'SET (length: ' + process.env.SUPABASE_PUBLISHABLE_KEY.length + ')' : 'MISSING')
  console.log('[config.ts] STRIPE_PUBLISHABLE_KEY:', process.env.STRIPE_PUBLISHABLE_KEY ? 'SET (length: ' + process.env.STRIPE_PUBLISHABLE_KEY.length + ')' : 'MISSING')
  
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || '',
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    apiUrl: process.env.API_URL || process.env.FRONTEND_URL || process.env.AMPLIFY_URL || 'http://localhost:3001',
    // Debug info (remove in production)
    _debug: {
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasSupabasePublishableKey: !!process.env.SUPABASE_PUBLISHABLE_KEY,
      hasStripePublishableKey: !!process.env.STRIPE_PUBLISHABLE_KEY,
      envKeys: Object.keys(process.env).filter(k => k.includes('SUPABASE') || k.includes('STRIPE'))
    }
  })
})

export default router

