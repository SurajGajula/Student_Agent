import express from 'express'
import generatePathRouter from './generatePath.js'
import savePathRouter from './savePath.js'
import listPathsRouter from './listPaths.js'
import deletePathRouter from './deletePath.js'
import scanCoursesRouter from './scanCoursesBySkill.js'

const router = express.Router()

router.use('/', generatePathRouter)
router.use('/', savePathRouter)
router.use('/', listPathsRouter)
router.use('/', deletePathRouter)
router.use('/scan-courses', scanCoursesRouter) // Mount at /scan-courses, so route becomes /api/career/scan-courses/:skillId

export default router
