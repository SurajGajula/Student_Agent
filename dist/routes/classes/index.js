import express from 'express';
import addClassRouter from './addClass.js';
import deleteClassRouter from './deleteClass.js';
import listClassesRouter from './listClasses.js';
import moveClassRouter from './moveClass.js';
const router = express.Router();
router.use(addClassRouter);
router.use(deleteClassRouter);
router.use(listClassesRouter);
router.use(moveClassRouter);
export default router;
//# sourceMappingURL=index.js.map