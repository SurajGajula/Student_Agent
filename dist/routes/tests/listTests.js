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
router.get('/list', authenticateUser, async (req, res) => {
    try {
        if (!req.userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const { data: tests, error } = await supabase
            .from('tests')
            .select('*')
            .eq('user_id', req.userId)
            .order('created_at', { ascending: false });
        if (error) {
            console.error('Error listing tests:', error);
            return res.status(500).json({ error: 'Failed to list tests', message: error.message });
        }
        // Transform from snake_case to camelCase and parse JSONB questions
        const transformedTests = (tests || []).map((test) => ({
            id: test.id,
            name: test.name,
            folderId: test.folder_id || null,
            noteId: test.note_id,
            noteName: test.note_name,
            questions: test.questions || [],
            createdAt: test.created_at,
            updatedAt: test.updated_at,
        }));
        res.json(transformedTests);
    }
    catch (error) {
        console.error('Error in listTests:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to list tests';
        res.status(500).json({ error: errorMessage });
    }
});
export default router;
//# sourceMappingURL=listTests.js.map