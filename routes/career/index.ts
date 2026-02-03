import express from 'express'
import generatePathRouter from './generatePath.js'
import savePathRouter from './savePath.js'
import listPathsRouter from './listPaths.js'
import deletePathRouter from './deletePath.js'

const router = express.Router()

router.use('/', generatePathRouter)
router.use('/', savePathRouter)
router.use('/', listPathsRouter)
router.use('/', deletePathRouter)

export default router
