import express from 'express'
import chatRouter from '../chat.js'
import intentRouter from './intent.js'
import capabilitiesRouter from './capabilitiesRoute.js'

const router = express.Router()

// Register chat routes
router.use('/', chatRouter)
router.use('/', intentRouter) // Mounts at /route
router.use('/', capabilitiesRouter) // /capabilities

export default router
