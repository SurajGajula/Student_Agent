// Load environment variables first
import '../../load-env.js';
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser } from '../middleware/auth.js';
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error('Missing Supabase environment variables');
}
const supabase = createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});
const router = express.Router();
router.put('/move/:id', authenticateUser, async (req, res) => {
    try {
        if (!req.userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const { id } = req.params;
        const { folderId } = req.body;
        // First check if flashcard set exists and belongs to user
        const { data: existingSet, error: checkError } = await supabase
            .from('flashcards')
            .select('id')
            .eq('id', id)
            .eq('user_id', req.userId)
            .single();
        if (checkError || !existingSet) {
            return res.status(404).json({ error: 'Flashcard set not found' });
        }
        const { data, error } = await supabase
            .from('flashcards')
            .update({
            folder_id: folderId || null,
            updated_at: new Date().toISOString(),
        })
            .eq('id', id)
            .eq('user_id', req.userId)
            .select()
            .single();
        if (error) {
            console.error('Error moving flashcard set:', error);
            return res.status(500).json({ error: 'Failed to move flashcard set', message: error.message });
        }
        // Transform to camelCase
        const updatedSet = {
            id: data.id,
            name: data.name,
            folderId: data.folder_id || null,
            noteId: data.note_id,
            noteName: data.note_name,
            cards: data.cards || [],
            createdAt: data.created_at,
            updatedAt: data.updated_at,
        };
        res.json(updatedSet);
    }
    catch (error) {
        console.error('Error in moveFlashcard:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to move flashcard set';
        res.status(500).json({ error: errorMessage });
    }
});
export default router;
//# sourceMappingURL=moveFlashcard.js.map