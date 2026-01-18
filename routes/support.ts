import express, { Request, Response } from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

// Serve the support HTML page
router.get('/', (req: Request, res: Response) => {
  // Try multiple possible paths (works in both dev and production)
  const possiblePaths = [
    path.join(__dirname, '..', 'public', 'support.html'),
    path.join(process.cwd(), 'public', 'support.html'),
    path.join(process.cwd(), 'dist', '..', 'public', 'support.html'),
  ]
  
  let supportHtmlPath: string | null = null
  for (const possiblePath of possiblePaths) {
    if (fs.existsSync(possiblePath)) {
      supportHtmlPath = possiblePath
      break
    }
  }
  
  if (supportHtmlPath) {
    res.sendFile(path.resolve(supportHtmlPath))
  } else {
    // Fallback if file doesn't exist - log for debugging
    console.error('Support HTML not found. Tried paths:', possiblePaths)
    res.status(404).send('Support page not found. Please contact surajgajula@thesfstudio.com')
  }
})

// Handle support form submissions
router.post('/submit', (req: Request, res: Response) => {
  const { name, email, subject, message } = req.body

  // Validate required fields
  if (!name || !email || !message) {
    return res.status(400).json({ 
      success: false, 
      error: 'Name, email, and message are required' 
    })
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid email format' 
    })
  }

  // Log the support request (you can extend this to send emails later)
  console.log('=== Support Request Received ===')
  console.log(`Name: ${name}`)
  console.log(`Email: ${email}`)
  console.log(`Subject: ${subject || 'No subject'}`)
  console.log(`Message: ${message}`)
  console.log(`Timestamp: ${new Date().toISOString()}`)
  console.log('================================')

  // TODO: Add email sending functionality here
  // For now, we'll just log it and return success
  // You can add nodemailer or another email service later

  res.json({ 
    success: true, 
    message: 'Support request received. We will get back to you soon!' 
  })
})

export default router
