import express from 'express';
import { getGeminiClient } from '../services/gemini.js';
const router = express.Router();
router.get('/', (_req, res) => {
    res.json({
        status: 'ok',
        geminiInitialized: getGeminiClient() !== null,
        timestamp: new Date().toISOString()
    });
});
export default router;
//# sourceMappingURL=health.js.map