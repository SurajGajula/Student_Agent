import express from 'express'
import addFolderRouter from './addFolder.js'
import updateFolderRouter from './updateFolder.js'
import deleteFolderRouter from './deleteFolder.js'
import listFoldersRouter from './listFolders.js'

const router = express.Router()

router.use(addFolderRouter)
router.use(updateFolderRouter)
router.use(deleteFolderRouter)
router.use(listFoldersRouter)

export default router

