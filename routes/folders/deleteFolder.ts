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

router.delete('/delete/:id', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const { id } = req.params
    const { type } = req.query

    if (!type || !['note', 'class', 'test', 'flashcard'].includes(type as string)) {
      return res.status(400).json({ error: 'Valid folder type is required' })
    }

    // Check if folder exists and belongs to user
    const { data: existingFolder, error: checkError } = await supabase
      .from('folders')
      .select('id, type')
      .eq('id', id)
      .eq('user_id', req.userId)
      .eq('type', type)
      .single()

    if (checkError || !existingFolder) {
      return res.status(404).json({ error: 'Folder not found' })
    }

    // Check for subfolders of the same type
    const { data: subfolders } = await supabase
      .from('folders')
      .select('id')
      .eq('parent_folder_id', id)
      .eq('type', type)
      .eq('user_id', req.userId)
      .limit(1)

    if (subfolders && subfolders.length > 0) {
      return res.status(400).json({ error: 'Cannot delete folder: it contains subfolders' })
    }

    // Check for items based on type
    let hasItems = false
    const tableName = type === 'class' ? 'classes' : type === 'note' ? 'notes' : type === 'test' ? 'tests' : 'flashcards'
    
    const { data: items } = await supabase
      .from(tableName)
      .select('id')
      .eq('folder_id', id)
      .eq('user_id', req.userId)
      .limit(1)

    hasItems = (items && items.length > 0) || false

    if (hasItems) {
      return res.status(400).json({ error: 'Cannot delete folder: it contains items' })
    }

    const { error } = await supabase
      .from('folders')
      .delete()
      .eq('id', id)
      .eq('user_id', req.userId)
      .eq('type', type)

    if (error) {
      console.error('Error deleting folder:', error)
      return res.status(500).json({ error: 'Failed to delete folder', message: error.message })
    }

    res.json({ success: true, message: 'Folder deleted successfully' })
  } catch (error) {
    console.error('Error in deleteFolder:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete folder'
    res.status(500).json({ error: errorMessage })
  }
})

export default router

