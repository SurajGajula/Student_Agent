// This file must be imported FIRST before any other imports
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load backend.env file
dotenv.config({ path: join(__dirname, 'backend.env') })

// Verify required variables are loaded
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
  console.error('Missing required environment variables:')
  console.error('SUPABASE_URL:', process.env.SUPABASE_URL ? '✓' : '✗')
  console.error('SUPABASE_SECRET_KEY:', process.env.SUPABASE_SECRET_KEY ? '✓' : '✗')
  throw new Error('Missing Supabase environment variables. Please check backend.env file.')
}

