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
        const { name, folderId, days, timeRange } = req.body;
        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ error: 'Class name is required' });
        }
        // Check plan limits for free users
        const { data: usageData } = await supabase
            .from('user_usage')
            .select(`
        plan_id,
        plans!inner(name)
      `)
            .eq('user_id', req.userId)
            .single();
        if (usageData && usageData.plans?.name === 'free') {
            const { count } = await supabase
                .from('classes')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', req.userId);
            if (count !== null && count >= 10) {
                return res.status(403).json({
                    error: 'Free plan limit reached: You can only have 10 classes. Upgrade to add more.'
                });
            }
        }
        const { data, error } = await supabase
            .from('classes')
            .insert({
            user_id: req.userId,
            name: name.trim(),
            folder_id: folderId || null,
            days: days || null,
            time_range: timeRange || null,
        })
            .select()
            .single();
        if (error) {
            console.error('Error adding class:', error);
            return res.status(500).json({ error: 'Failed to add class', message: error.message });
        }
        // Transform to camelCase
        const newClass = {
            id: data.id,
            name: data.name,
            folderId: data.folder_id || null,
            days: data.days || null,
            timeRange: data.time_range || null,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
        };
        res.json(newClass);
    }
    catch (error) {
        console.error('Error in addClass:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to add class';
        res.status(500).json({ error: errorMessage });
    }
});
export default router;
//# sourceMappingURL=addClass.js.map