import express from 'express';
import generateFlashcardRouter from '../flashcards.js'; // Keep the existing generate route
import addFlashcardRouter from './addFlashcard.js';
import deleteFlashcardRouter from './deleteFlashcard.js';
import listFlashcardsRouter from './listFlashcards.js';
import moveFlashcardRouter from './moveFlashcard.js';
const router = express.Router();
// Keep the generate route at /generate
router.use(generateFlashcardRouter);
// Add CRUD routes
router.use(addFlashcardRouter);
router.use(deleteFlashcardRouter);
router.use(listFlashcardsRouter);
router.use(moveFlashcardRouter);
export default router;
//# sourceMappingURL=index.js.map