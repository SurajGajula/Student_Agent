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
router.put('/update/:id', authenticateUser, async (req, res) => {
    try {
        if (!req.userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const { id } = req.params;
        const { name, type, parentFolderId } = req.body;
        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ error: 'Folder name is required' });
        }
        if (!type || !['note', 'class', 'test', 'flashcard'].includes(type)) {
            return res.status(400).json({ error: 'Valid folder type is required' });
        }
        // Check if folder exists and belongs to user
        const { data: existingFolder, error: checkError } = await supabase
            .from('folders')
            .select('id, type')
            .eq('id', id)
            .eq('user_id', req.userId)
            .eq('type', type)
            .single();
        if (checkError || !existingFolder) {
            return res.status(404).json({ error: 'Folder not found or type mismatch' });
        }
        // Prevent self-reference
        if (parentFolderId === id) {
            return res.status(400).json({ error: 'Folder cannot be its own parent' });
        }
        // Check for circular reference in parent chain (only within same type)
        if (parentFolderId) {
            let currentParentId = parentFolderId;
            const visited = new Set([id]);
            while (currentParentId) {
                if (visited.has(currentParentId)) {
                    return res.status(400).json({ error: 'Cannot create circular folder reference' });
                }
                visited.add(currentParentId);
                const { data: parentFolder } = await supabase
                    .from('folders')
                    .select('parent_folder_id, type')
                    .eq('id', currentParentId)
                    .eq('user_id', req.userId)
                    .eq('type', type)
                    .single();
                if (!parentFolder || parentFolder.type !== type) {
                    break;
                }
                currentParentId = parentFolder?.parent_folder_id || null;
            }
        }
        const { data, error } = await supabase
            .from('folders')
            .update({
            name: name.trim(),
            parent_folder_id: parentFolderId || null,
            updated_at: new Date().toISOString(),
        })
            .eq('id', id)
            .eq('user_id', req.userId)
            .eq('type', type)
            .select()
            .single();
        if (error) {
            console.error('Error updating folder:', error);
            return res.status(500).json({ error: 'Failed to update folder', message: error.message });
        }
        // Transform to camelCase
        const updatedFolder = {
            id: data.id,
            name: data.name,
            type: data.type,
            parentFolderId: data.parent_folder_id || null,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
        };
        res.json(updatedFolder);
    }
    catch (error) {
        console.error('Error in updateFolder:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to update folder';
        res.status(500).json({ error: errorMessage });
    }
});
export default router;
//# sourceMappingURL=updateFolder.js.map