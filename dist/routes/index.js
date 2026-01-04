import express from 'express';
import { getGeminiClient } from '../services/gemini.js';
const router = express.Router();
router.get('/', (_req, res) => {
    res.json({
        message: 'Schedule Parser API',
        endpoints: {
            health: '/health',
            parseSchedule: 'POST /api/parse-schedule'
        },
        geminiInitialized: getGeminiClient() !== null
    });
});
export default router;
//# sourceMappingURL=index.js.map