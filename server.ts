// Load environment variables FIRST before any other imports
import './load-env.js'

import express, { Express } from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { initializeGeminiClient } from './services/gemini.js'
import healthRouter from './routes/health.js'
import indexRouter from './routes/index.js'
import scheduleRouter from './routes/schedule.js'
import notesParseRouter from './routes/notes.js' // Keep parse-notes route
import notesCRUDRouter from './routes/notes/index.js' // New CRUD routes
import classesCRUDRouter from './routes/classes/index.js' // New classes CRUD routes
import chatRouter from './routes/chat.js'
import testsRouter from './routes/tests/index.js' // Updated to use index
import flashcardsRouter from './routes/flashcards/index.js' // Updated to use index
import foldersCRUDRouter from './routes/folders/index.js' // New folders CRUD routes
import usageRouter from './routes/usage.js'
import stripeRouter from './routes/stripe.js'
import configRouter from './routes/config.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app: Express = express()

// Enable CORS for frontend
const frontendUrl = process.env.FRONTEND_URL || process.env.AMPLIFY_URL
const allowedOrigins = frontendUrl 
  ? [frontendUrl]
  : [
      'http://localhost:5173', // Vite default
      'http://localhost:8081', // Expo Metro bundler
      'http://localhost:19006', // Expo web
      'http://192.168.1.56:8081', // Network access for Expo
      'http://192.168.1.56:5173', // Network access for Vite
      'https://main.d295pany09fs1r.amplifyapp.com' // Amplify frontend
    ]

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true)
    
    // Allow all Amplify domains
    if (origin.includes('.amplifyapp.com')) {
      return callback(null, true)
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      // In production, be more permissive to avoid CORS issues
      // You can restrict this later if needed
      callback(null, true)
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))

// Stripe webhook must be before JSON parser (it uses raw body)
app.use('/api/stripe', stripeRouter)

app.use(express.json())

// Config endpoint (public, no auth required)
app.use('/api', configRouter)

// API Routes (must be before static file serving)
app.use('/health', healthRouter)
app.use('/api', scheduleRouter)
app.use('/api', notesParseRouter) // Keep parse-notes route
app.use('/api/notes', notesCRUDRouter) // New notes CRUD routes
app.use('/api/classes', classesCRUDRouter) // New classes CRUD routes
app.use('/api/folders', foldersCRUDRouter) // New folders CRUD routes
app.use('/api', chatRouter)
app.use('/api/tests', testsRouter) // Includes generate + CRUD
app.use('/api/flashcards', flashcardsRouter) // Includes generate + CRUD
app.use('/api', usageRouter)
app.use('/', indexRouter)

// Serve static files from Expo web-build directory in production
if (process.env.NODE_ENV === 'production') {
  // Check for Expo web build first, fallback to dist for backward compatibility
  const webBuildPath = path.join(__dirname, 'web-build')
  const distPath = path.join(__dirname, 'dist')
  
  let staticPath = distPath
  if (fs.existsSync(webBuildPath)) {
    staticPath = webBuildPath
  }
  
  app.use(express.static(staticPath))
  
  // Serve index.html for all non-API routes (SPA routing)
  // This must be last to catch all remaining routes
  // Express 5: Use a function to match all routes not starting with /api
  app.use((req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
      return next()
    }
    // Serve index.html for all other routes
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

