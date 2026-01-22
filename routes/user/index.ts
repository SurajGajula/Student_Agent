import express from 'express'
import deleteAccountRouter from './deleteAccount.js'

const router = express.Router()

router.use('/', deleteAccountRouter)

export default router
