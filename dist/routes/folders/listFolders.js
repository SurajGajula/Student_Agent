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
        const { data: folders, error } = await supabase
            .from('folders')
            .select('*')
            .eq('user_id', req.userId)
            .order('created_at', { ascending: false });
        if (error) {
            console.error('Error listing folders:', error);
            return res.status(500).json({ error: 'Failed to list folders', message: error.message });
        }
        // Transform from snake_case to camelCase
        const transformedFolders = (folders || []).map((folder) => ({
            id: folder.id,
            name: folder.name,
            type: folder.type || 'note', // Default to 'note' for backward compatibility
            parentFolderId: folder.parent_folder_id || null,
            createdAt: folder.created_at,
            updatedAt: folder.updated_at,
        }));
        res.json(transformedFolders);
    }
    catch (error) {
        console.error('Error in listFolders:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to list folders';
        res.status(500).json({ error: errorMessage });
    }
});
export default router;
//# sourceMappingURL=listFolders.js.map