// Load environment variables first
import '../load-env.js'

import { createClient } from '@supabase/supabase-js'

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

interface UserUsage {
  plan_id: string | null
  tokens_used_this_month: number
  last_monthly_reset: string | null
}

interface PlanLimits {
  name: string
  monthly_token_limit: number
}

/**
 * Get or create user usage record (defaults to free plan)
 */
async function getOrCreateUserUsage(userId: string): Promise<UserUsage> {
  // Try to get existing usage record
  const { data: existingUsage, error: fetchError } = await supabase
    .from('user_usage')
    .select('*')
    .eq('user_id', userId)
    .single()

  // If record exists, return it
  if (existingUsage && !fetchError) {
    return existingUsage as UserUsage
  }

  // If error is not "no rows returned", log it
  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error('Error fetching user usage:', fetchError)
  }

  // Get free plan ID
  const { data: freePlan, error: planError } = await supabase
    .from('plans')
    .select('id')
    .eq('name', 'free')
    .single()

  if (!freePlan || planError) {
    console.error('Error fetching free plan:', planError)
    throw new Error(`Free plan not found in database: ${planError?.message || 'Plan not found'}`)
  }

  // Create new user usage record with free plan
  const currentMonthStart = new Date()
  currentMonthStart.setDate(1)
  currentMonthStart.setHours(0, 0, 0, 0)

  const { data: newUsage, error: insertError } = await supabase
    .from('user_usage')
    .insert({
      user_id: userId,
      plan_id: freePlan.id,
      tokens_used_this_month: 0,
      last_monthly_reset: currentMonthStart.toISOString().split('T')[0]
    })
    .select()
    .single()

  if (insertError || !newUsage) {
    console.error('Error creating user usage record:', insertError)
    throw new Error(`Failed to create user usage record: ${insertError?.message || 'Unknown error'}`)
  }

  console.log(`Created user usage record for user ${userId} with free plan`)
  return newUsage as UserUsage
}

/**
 * Check if user has exceeded monthly token limit
 */
export async function checkTokenLimit(
  userId: string,
  tokensToUse: number
): Promise<{ allowed: boolean; remaining: number; limit: number; current: number }> {
  const usage = await getOrCreateUserUsage(userId)

  // Check if monthly reset is needed
  const currentMonthStart = new Date()
  currentMonthStart.setDate(1)
  currentMonthStart.setHours(0, 0, 0, 0)
  const currentMonthStartStr = currentMonthStart.toISOString().split('T')[0]

  const lastReset = usage.last_monthly_reset
  const needsReset = !lastReset || lastReset < currentMonthStartStr

  if (needsReset) {
    // Reset monthly usage
    await supabase
      .from('user_usage')
      .update({
        tokens_used_this_month: 0,
        last_monthly_reset: currentMonthStartStr
      })
      .eq('user_id', userId)
    
    usage.tokens_used_this_month = 0
  }

  // Get plan limits
  const { data: plan } = await supabase
    .from('plans')
    .select('monthly_token_limit')
    .eq('id', usage.plan_id)
    .single()

  if (!plan) {
    throw new Error('Plan not found')
  }

  const limit = plan.monthly_token_limit
  const current = usage.tokens_used_this_month
  const totalAfter = current + tokensToUse
  const remaining = Math.max(0, limit - totalAfter)

  return {
    allowed: totalAfter <= limit,
    remaining,
    limit,
    current
  }
}

/**
 * Record token usage for a user
 */
export async function recordTokenUsage(
  userId: string,
  tokens: number
): Promise<void> {
  if (!userId) {
    throw new Error('User ID is required to record token usage')
  }
  
  if (tokens <= 0) {
    console.warn(`Skipping token recording: tokens is ${tokens} (must be > 0)`)
    return
  }

  console.log(`Recording ${tokens} tokens for user ${userId}`)
  const usage = await getOrCreateUserUsage(userId)

  // Check if monthly reset is needed
  const currentMonthStart = new Date()
  currentMonthStart.setDate(1)
  currentMonthStart.setHours(0, 0, 0, 0)
  const currentMonthStartStr = currentMonthStart.toISOString().split('T')[0]

  const lastReset = usage.last_monthly_reset
  const needsReset = !lastReset || lastReset < currentMonthStartStr

  if (needsReset) {
    // Reset and set new usage
    const { error } = await supabase
      .from('user_usage')
      .update({
        tokens_used_this_month: tokens,
        last_monthly_reset: currentMonthStartStr,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)

    if (error) {
      console.error('Error recording token usage:', error)
      throw new Error('Failed to record token usage')
    }
  } else {
    // Increment existing usage
    const { error } = await supabase
      .from('user_usage')
      .update({
        tokens_used_this_month: (usage.tokens_used_this_month || 0) + tokens,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)

    if (error) {
      console.error('Error recording token usage:', error)
      throw new Error('Failed to record token usage')
    }
  }
}

/**
 * Get user usage statistics
 */
export async function getUserUsage(userId: string): Promise<{
  planName: string
  tokensUsed: number
  monthlyLimit: number
  remaining: number
}> {
  const usage = await getOrCreateUserUsage(userId)

  // Check if monthly reset is needed
  const currentMonthStart = new Date()
  currentMonthStart.setDate(1)
  currentMonthStart.setHours(0, 0, 0, 0)
  const currentMonthStartStr = currentMonthStart.toISOString().split('T')[0]

  const lastReset = usage.last_monthly_reset
  const needsReset = !lastReset || lastReset < currentMonthStartStr

  if (needsReset) {
    // Reset monthly usage
    await supabase
      .from('user_usage')
      .update({
        tokens_used_this_month: 0,
        last_monthly_reset: currentMonthStartStr
      })
      .eq('user_id', userId)
    
    usage.tokens_used_this_month = 0
  }

  // Get plan details
  const { data: plan } = await supabase
    .from('plans')
    .select('name, monthly_token_limit')
    .eq('id', usage.plan_id)
    .single()

  if (!plan) {
    throw new Error('Plan not found')
  }

  const tokensUsed = usage.tokens_used_this_month || 0
  const monthlyLimit = plan.monthly_token_limit
  const remaining = Math.max(0, monthlyLimit - tokensUsed)

  return {
    planName: plan.name,
    tokensUsed,
    monthlyLimit,
    remaining
  }
}

