import express from 'express'
import generateTestRouter from '../tests.js' // Keep the existing generate route
import addTestRouter from './addTest.js'
import deleteTestRouter from './deleteTest.js'
import listTestsRouter from './listTests.js'
import moveTestRouter from './moveTest.js'

const router = express.Router()

// Keep the generate route at /generate
router.use(generateTestRouter)
// Add CRUD routes
router.use(addTestRouter)
router.use(deleteTestRouter)
router.use(listTestsRouter)
router.use(moveTestRouter)

export default router

