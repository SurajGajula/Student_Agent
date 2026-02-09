// Load environment variables first
import '../../load-env.js'

import express, { Response } from 'express'
import { createClient } from '@supabase/supabase-js'
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth.js'

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

const router = express.Router()

router.delete('/delete', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const userId = req.userId

    console.log(`[deleteAccount] Starting account deletion for user: ${userId}`)

    // Delete all user data in the correct order (respecting foreign key constraints)
    // 1. Delete user's notes
    const { error: notesError } = await supabase
      .from('notes')
      .delete()
      .eq('user_id', userId)

    if (notesError) {
      console.error('Error deleting notes:', notesError)
      return res.status(500).json({ error: 'Failed to delete user data', message: notesError.message })
    }

    // 2. Delete user's tests
    const { error: testsError } = await supabase
      .from('tests')
      .delete()
      .eq('user_id', userId)

    if (testsError) {
      console.error('Error deleting tests:', testsError)
      return res.status(500).json({ error: 'Failed to delete user data', message: testsError.message })
    }

    // 3. Delete user's flashcards
    const { error: flashcardsError } = await supabase
      .from('flashcards')
      .delete()
      .eq('user_id', userId)

    if (flashcardsError) {
      console.error('Error deleting flashcards:', flashcardsError)
      return res.status(500).json({ error: 'Failed to delete user data', message: flashcardsError.message })
    }

    // 4. Delete user's usage record (contains stripe_customer_id, plan_id, etc.)
    const { error: usageError } = await supabase
      .from('user_usage')
      .delete()
      .eq('user_id', userId)

    if (usageError) {
      console.error('Error deleting user_usage:', usageError)
      return res.status(500).json({ error: 'Failed to delete user data', message: usageError.message })
    }

    // 5. Delete the auth user (this will cascade delete related auth data)
    const { error: authError } = await supabase.auth.admin.deleteUser(userId)

    if (authError) {
      console.error('Error deleting auth user:', authError)
      return res.status(500).json({ error: 'Failed to delete user account', message: authError.message })
    }

    console.log(`[deleteAccount] Successfully deleted account for user: ${userId}`)

    res.json({ success: true, message: 'Account deleted successfully' })
  } catch (error) {
    console.error('Error in deleteAccount:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete account'
    res.status(500).json({ error: errorMessage })
  }
})

export default router
