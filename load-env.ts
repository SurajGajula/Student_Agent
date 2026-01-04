// This file must be imported FIRST before any other imports
// Environment variables must be set directly (via export, Railway, Docker, etc.)
// No .env file loading - use environment variables only

// Verify required variables are loaded from environment
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
  console.error('Missing required environment variables:')
  console.error('SUPABASE_URL:', process.env.SUPABASE_URL ? '✓' : '✗')
  console.error('SUPABASE_SECRET_KEY:', process.env.SUPABASE_SECRET_KEY ? '✓' : '✗')
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Please set SUPABASE_URL and SUPABASE_SECRET_KEY as environment variables.'
  )
}

