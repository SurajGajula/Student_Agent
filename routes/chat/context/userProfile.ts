// Load environment variables first
import '../../../load-env.js'

import { createClient } from '@supabase/supabase-js'
import { getUserUsage } from '../../../services/usageTracking.js'
import type { UserProfile } from './types.js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

/**
 * Fetch user profile data including plan info and usage stats
 * Note: Email and username metadata would need to be passed from the request
 * or fetched separately if needed. For now, we focus on usage/plan data.
 */
export async function fetchUserProfile(userId: string, email?: string | null, username?: string): Promise<UserProfile> {
  // Get usage stats (includes plan info)
  const usage = await getUserUsage(userId)

  return {
    userId,
    email: email || null,
    username: username || 'User',
    planName: usage.planName,
    tokensUsed: usage.tokensUsed,
    monthlyLimit: usage.monthlyLimit,
    remaining: usage.remaining,
    metadata: {}
  }
}
