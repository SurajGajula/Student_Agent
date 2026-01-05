import express, { Request, Response } from 'express'

const router = express.Router()

// Public endpoint to serve frontend configuration
// This allows the frontend to get environment variables at runtime
router.get('/config', (req: Request, res: Response) => {
  // Debug: Log what we're getting from environment
  console.log('[config.ts] Environment variables check:')
  console.log('[config.ts] SUPABASE_URL:', process.env.SUPABASE_URL ? 'SET (' + process.env.SUPABASE_URL.substring(0, 30) + '...)' : 'MISSING')
  console.log('[config.ts] SUPABASE_PUBLISHABLE_KEY:', process.env.SUPABASE_PUBLISHABLE_KEY ? 'SET (length: ' + process.env.SUPABASE_PUBLISHABLE_KEY.length + ')' : 'MISSING')
  console.log('[config.ts] STRIPE_PUBLISHABLE_KEY:', process.env.STRIPE_PUBLISHABLE_KEY ? 'SET (length: ' + process.env.STRIPE_PUBLISHABLE_KEY.length + ')' : 'MISSING')
  
  // Determine API URL - use request origin if on same domain, otherwise use environment or default
  const requestProtocol = req.protocol || 'https'
  const requestHost = req.get('host') || 'studentagent.site'
  const requestOrigin = `${requestProtocol}://${requestHost}`
  
  // If we're in production on studentagent.site, return the request origin (same domain)
  // Otherwise use environment variable or default
  const apiUrl = process.env.API_URL || 
    (requestHost.includes('studentagent.site') ? requestOrigin : 
     (process.env.NODE_ENV === 'production' ? 'https://studentagent.site' : 'http://localhost:3001'))
  
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || '',
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    apiUrl: apiUrl,
    // Debug info (remove in production)
    _debug: {
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasSupabasePublishableKey: !!process.env.SUPABASE_PUBLISHABLE_KEY,
      hasStripePublishableKey: !!process.env.STRIPE_PUBLISHABLE_KEY,
      requestHost: requestHost,
      requestOrigin: requestOrigin,
      apiUrl: apiUrl,
      envKeys: Object.keys(process.env).filter(k => k.includes('SUPABASE') || k.includes('STRIPE') || k.includes('API_URL'))
    }
  })
})

export default router

