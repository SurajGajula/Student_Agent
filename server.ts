import express, { Express } from 'express'
import cors from 'cors'
import { initializeGeminiClient } from './services/gemini.js'
import healthRouter from './routes/health.js'
import indexRouter from './routes/index.js'
import scheduleRouter from './routes/schedule.js'
import notesRouter from './routes/notes.js'
import chatRouter from './routes/chat.js'
import testsRouter from './routes/tests.js'

const app: Express = express()

// Enable CORS for frontend
app.use(cors())
app.use(express.json())

// Routes
app.use('/health', healthRouter)
app.use('/', indexRouter)
app.use('/api', scheduleRouter)
app.use('/api', notesRouter)
app.use('/api', chatRouter)
app.use('/api/tests', testsRouter)

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

