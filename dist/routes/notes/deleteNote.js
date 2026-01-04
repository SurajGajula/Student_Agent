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
router.delete('/delete/:id', authenticateUser, async (req, res) => {
    try {
        if (!req.userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const { id } = req.params;
        // First check if note exists and belongs to user
        const { data: existingNote, error: checkError } = await supabase
            .from('notes')
            .select('id')
            .eq('id', id)
            .eq('user_id', req.userId)
            .single();
        if (checkError || !existingNote) {
            return res.status(404).json({ error: 'Note not found' });
        }
        const { error } = await supabase
            .from('notes')
            .delete()
            .eq('id', id)
            .eq('user_id', req.userId);
        if (error) {
            console.error('Error deleting note:', error);
            return res.status(500).json({ error: 'Failed to delete note', message: error.message });
        }
        res.json({ success: true, message: 'Note deleted successfully' });
    }
    catch (error) {
        console.error('Error in deleteNote:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to delete note';
        res.status(500).json({ error: errorMessage });
    }
});
export default router;
//# sourceMappingURL=deleteNote.js.map