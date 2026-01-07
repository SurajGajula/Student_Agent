// This file must be imported FIRST before any other imports
// Load environment variables from .env file if it exists
import dotenv from 'dotenv'

// Load .env file from project root (process.cwd() is already the project root)
dotenv.config()

// Verify required variables are loaded from environment
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
  console.error('Missing required environment variables:')
  console.error('SUPABASE_URL:', process.env.SUPABASE_URL ? '✓' : '✗')
  console.error('SUPABASE_SECRET_KEY:', process.env.SUPABASE_SECRET_KEY ? '✓' : '✗')
  console.error('\nPlease ensure .env file exists in the project root with:')
  console.error('  SUPABASE_URL=your-supabase-url')
  console.error('  SUPABASE_SECRET_KEY=your-supabase-secret-key')
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Please set SUPABASE_URL and SUPABASE_SECRET_KEY in .env file or as environment variables.'
  )
}

