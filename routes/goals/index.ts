import express from 'express'
import addGoalRouter from './addPlan.js'
import deleteGoalRouter from './deletePlan.js'
import listGoalsRouter from './listPlans.js'

const router = express.Router()

router.use(addGoalRouter)
router.use(deleteGoalRouter)
router.use(listGoalsRouter)

export default router

