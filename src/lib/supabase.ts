import { createClient } from '@supabase/supabase-js'

// Note: In Vite, environment variables are accessed via import.meta.env (not process.env)
// Variables must be prefixed with VITE_ to be exposed to client-side code
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in your .env file.'
  )
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey)

