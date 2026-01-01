// Load environment variables FIRST before any other imports
import './load-env.js'

import express, { Express } from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { initializeGeminiClient } from './services/gemini.js'
import healthRouter from './routes/health.js'
import indexRouter from './routes/index.js'
import scheduleRouter from './routes/schedule.js'
import notesRouter from './routes/notes.js'
import chatRouter from './routes/chat.js'
import testsRouter from './routes/tests.js'
import flashcardsRouter from './routes/flashcards.js'
import usageRouter from './routes/usage.js'
import stripeRouter from './routes/stripe.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app: Express = express()

// Enable CORS for frontend
const frontendUrl = process.env.FRONTEND_URL || process.env.RAILWAY_PUBLIC_DOMAIN || 'http://localhost:5173'
app.use(cors({
  origin: frontendUrl,
  credentials: true
}))

// Stripe webhook must be before JSON parser (it uses raw body)
app.use('/api/stripe', stripeRouter)

app.use(express.json())

// API Routes (must be before static file serving)
app.use('/health', healthRouter)
app.use('/api', scheduleRouter)
app.use('/api', notesRouter)
app.use('/api', chatRouter)
app.use('/api/tests', testsRouter)
app.use('/api/flashcards', flashcardsRouter)
app.use('/api', usageRouter)
app.use('/', indexRouter)

// Serve static files from Expo web-build directory in production
if (process.env.NODE_ENV === 'production') {
  // Check for Expo web build first, fallback to dist for backward compatibility
  const fs = require('fs')
  const webBuildPath = path.join(__dirname, 'web-build')
  const distPath = path.join(__dirname, 'dist')
  
  let staticPath = distPath
  if (fs.existsSync(webBuildPath)) {
    staticPath = webBuildPath
  }
  
  app.use(express.static(staticPath))
  
  // Serve index.html for all non-API routes (SPA routing)
  // This must be last to catch all remaining routes
  app.get('*', (req, res) => {
    // API routes are already handled above, so this is safe
    res.sendFile(path.join(staticPath, 'index.html'))
  })
}

// Initialize Gemini client asynchronously (don't block server startup)
initializeGeminiClient()
  .then(() => {
    console.log('Gemini client initialization completed')
  })
  .catch((error) => {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Gemini client initialization failed:', errorMessage)
    console.error('Server will still run, but schedule parsing will fail until client is initialized')
  })

const PORT = process.env.PORT || 3001

// Start server immediately (don't wait for Gemini initialization)
const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  console.log(`Health check: http://localhost:${PORT}/health`)
  console.log(`Root endpoint: http://localhost:${PORT}/`)
  console.log('Initializing Gemini client in background...')
})

// Increase server timeout to accommodate long-running Gemini API requests
server.timeout = 300000 // 5 minutes (300 seconds)
server.keepAliveTimeout = 300000 // 5 minutes
server.headersTimeout = 300000 // 5 minutes

