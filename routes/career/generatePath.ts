// Load environment variables first
import '../../load-env.js'

import express, { Response } from 'express'
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth.js'
import { checkTokenLimit, recordTokenUsage } from '../../services/usageTracking.js'
import { findOrCreateTargetProfile, getOrGenerateSkillGraph } from './service.js'

const router = express.Router()

router.post('/generate', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const { role, company, seniority = 'mid', major } = req.body

    if (!role || typeof role !== 'string' || !role.trim()) {
      return res.status(400).json({ error: 'Role is required' })
    }

    if (!company || typeof company !== 'string' || !company.trim()) {
      return res.status(400).json({ error: 'Company is required' })
    }

    // Validate seniority
    const validSeniorities = ['entry', 'mid', 'senior', 'staff', 'principal']
    const normalizedSeniority = seniority.toLowerCase()
    if (!validSeniorities.includes(normalizedSeniority)) {
      return res.status(400).json({ 
        error: `Invalid seniority. Must be one of: ${validSeniorities.join(', ')}` 
      })
    }

    // Estimate token usage (skill graph generation uses Gemini)
    const estimatedTokens = 5000 // Conservative estimate
    const limitCheck = await checkTokenLimit(req.userId, estimatedTokens)
    if (!limitCheck.allowed) {
      return res.status(429).json({
        error: 'Monthly token limit exceeded',
        limit: limitCheck.limit,
        current: limitCheck.current,
        remaining: limitCheck.remaining
      })
    }

    console.log(`[Career Path] Starting generation for role="${role.trim()}", company="${company.trim()}", seniority="${normalizedSeniority}"`)

    // Find or create target profile
    let targetId: string
    try {
      targetId = await findOrCreateTargetProfile(
        role.trim(),
        company.trim(),
        normalizedSeniority,
        major?.trim()
      )
      console.log(`[Career Path] Target profile ID: ${targetId}`)
    } catch (error) {
      console.error('[Career Path] Error finding/creating target profile:', error)
      throw error
    }

    // Get or generate skill graph
    let graph: { graphId: string, nodes: any[] }
    try {
      graph = await getOrGenerateSkillGraph(
        targetId,
        role.trim(),
        company.trim(),
        normalizedSeniority,
        major?.trim()
      )
      console.log(`[Career Path] Generated graph with ${graph.nodes.length} nodes`)
    } catch (error) {
      console.error('[Career Path] Error generating skill graph:', error)
      throw error
    }

    // Record token usage (actual usage will be recorded by Gemini service)
    // We'll estimate based on response size
    const actualTokens = estimatedTokens // In production, get from Gemini response
    try {
      await recordTokenUsage(req.userId, actualTokens)
    } catch (usageError) {
      console.error('Error recording token usage:', usageError)
      // Don't fail the request if usage recording fails
    }

    res.json({
      success: true,
      targetId,
      graphId: graph.graphId,
      role: role.trim(),
      company: company.trim(),
      seniority: normalizedSeniority,
      major: major?.trim() || null,
      nodes: graph.nodes
    })
  } catch (error) {
    console.error('[Career Path] Error generating career path:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate career path'
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('[Career Path] Error stack:', errorStack)
    res.status(500).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? errorStack : undefined
    })
  }
})

export default router
