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
router.post('/add', authenticateUser, async (req, res) => {
    try {
        if (!req.userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const { name, type, parentFolderId } = req.body;
        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ error: 'Folder name is required' });
        }
        if (!type || !['note', 'class', 'test', 'flashcard'].includes(type)) {
            return res.status(400).json({ error: 'Valid folder type is required' });
        }
        const { data, error } = await supabase
            .from('folders')
            .insert({
            user_id: req.userId,
            name: name.trim(),
            type: type,
            parent_folder_id: parentFolderId || null,
        })
            .select()
            .single();
        if (error) {
            console.error('Error adding folder:', error);
            return res.status(500).json({ error: 'Failed to add folder', message: error.message });
        }
        // Transform to camelCase
        const newFolder = {
            id: data.id,
            name: data.name,
            type: data.type,
            parentFolderId: data.parent_folder_id || null,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
        };
        res.json(newFolder);
    }
    catch (error) {
        console.error('Error in addFolder:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to add folder';
        res.status(500).json({ error: errorMessage });
    }
});
export default router;
//# sourceMappingURL=addFolder.js.map