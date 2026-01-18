import express, { Request, Response } from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

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
