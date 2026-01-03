import express, { Request, Response } from 'express'

interface Mention {
  noteId: string
  noteName: string
}

interface ChatRequest {
  message: string
  mentions: Mention[]
}

const router = express.Router()

// Chat endpoint - placeholder for future chat functionality
router.post('/chat', async (req: Request, res: Response) => {
  console.log('Received chat request')
  
  try {
    const { message }: ChatRequest = req.body

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' })
    }

    // Placeholder for future chat functionality
    // For now, just acknowledge the message
    res.json({
      success: true,
      message: 'Chat functionality coming soon',
    })
  } catch (error) {
    console.error('Error processing chat request:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    res.status(500).json({
      error: 'Failed to process chat request',
      message: errorMessage,
    })
  }
})

export default router

