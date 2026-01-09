import express from 'express'
import chatRouter from '../chat.js'
import intentRouter from './intent.js'

const router = express.Router()

// Register chat routes
router.use('/', chatRouter)
router.use('/', intentRouter) // Mounts at /route

export default router
