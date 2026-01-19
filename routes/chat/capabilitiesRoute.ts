import express, { Response } from 'express'
import capabilityRegistry from './capabilities/index.js'

const router = express.Router()

// Public list of chat capabilities (for UI help / docs)
router.get('/capabilities', (_req, res: Response) => {
  const capabilities = capabilityRegistry.getAllCapabilities().map(cap => ({
    id: cap.id,
    description: cap.description,
    keywords: cap.keywords,
    requiredContext: cap.requiredContext || [],
    examples: cap.examples || []
  }))

  res.json({
    success: true,
    capabilities
  })
})

export default router

