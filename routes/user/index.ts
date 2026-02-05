import express from 'express'
import deleteAccountRouter from './deleteAccount.js'
import profileRouter from './profile.js'

const router = express.Router()

router.use('/', deleteAccountRouter)
router.use('/', profileRouter)

export default router
