import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import expressRateLimit from 'express-rate-limit'
import { createServer } from 'http'
import { connectDatabase } from './config/database.js'
import logger from './config/logger.js'
import { errorHandler, requestTimeout, circuitBreaker } from './middleware/error.js'
import { securityLogging, trafficAnalysis } from './middleware/logging.js'
import { reportsRouter } from './routes/reports.js'
import { contentFlagsRouter } from './routes/contentFlags.js'
import { moderationQueueRouter } from './routes/moderationQueue.js'
import { appealsRouter } from './routes/appeals.js'
import { healthRouter } from './routes/health.js'
import { websocketRouter } from './routes/websocket.js'
import { initializeWebSocket, WebSocketServer } from './websocket/server.js'
import { initializeGraphQL } from './graphql/index.js'

// Load environment variables
const PORT = process.env.PORT || 3005
const NODE_ENV = process.env.NODE_ENV || 'development'

// Create Express app
const app = express()
const server = createServer(app)

// Global middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  }),
)

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  }),
)

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Rate limiting
const limiter = expressRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
})
app.use('/api/', limiter)

// Security and logging middleware
app.use(securityLogging)
app.use(trafficAnalysis)

// Health check endpoint (no auth required)
app.use('/health', healthRouter)

// WebSocket information endpoint
app.use('/websocket', websocketRouter)

// API routes
app.use('/api/reports', reportsRouter)
app.use('/api/content-flags', contentFlagsRouter)
app.use('/api/moderation-queue', moderationQueueRouter)
app.use('/api/appeals', appealsRouter)

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    availableEndpoints: {
      reports: '/api/reports',
      'content-flags': '/api/content-flags',
      'moderation-queue': '/api/moderation-queue',
      appeals: '/api/appeals',
      health: '/health',
      websocket: '/websocket',
    },
    timestamp: new Date().toISOString(),
  })
})

// Error handling middleware (must be last)
app.use(errorHandler)
app.use(requestTimeout)

// Initialize services
async function initializeServices(): Promise<void> {
  try {
    // Connect to database
    await connectDatabase()
    logger.info('📊 Database connected successfully')

    // Initialize GraphQL
    await initializeGraphQL(app)
    logger.info('🔗 GraphQL initialized at /graphql')

    // Initialize WebSocket server
    const websocketServer = new WebSocketServer()
    await websocketServer.initialize(server)
    logger.info('🚀 WebSocket server initialized')

    logger.info('🎉 Moderation Service initialized successfully')
  } catch (error) {
    logger.error('Failed to initialize services:', error)
    throw error
  }
}

// Start server
async function startServer(): Promise<void> {
  try {
    await initializeServices()

    server.listen(PORT, () => {
      const protocol = NODE_ENV === 'production' ? 'https' : 'http'
      const websocketUrl =
        NODE_ENV === 'production' ? `wss://localhost:${PORT}` : `ws://localhost:${PORT}`

      logger.info(`🚀 Moderation Service running on ${protocol}://localhost:${PORT}`)
      logger.info(`📊 Health check: ${protocol}://localhost:${PORT}/health`)
      logger.info(`🔗 GraphQL Playground: ${protocol}://localhost:${PORT}/graphql`)
      logger.info(`🚀 WebSocket Server: ${websocketUrl}`)
      logger.info(`📖 API Documentation: ${protocol}://localhost:${PORT}/api-docs`)

      if (NODE_ENV === 'development') {
        logger.info(`🔗 WebSocket Test: ${protocol}://localhost:${PORT}/websocket/test`)
      }
    })
  } catch (error) {
    logger.error('Failed to start server:', error)
    process.exit(1)
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

// Handle uncaught exceptions
process.on('uncaughtException', error => {
  logger.error('Uncaught Exception:', error)
  process.exit(1)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully')
  server.close(() => {
    logger.info('Process terminated')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully')
  server.close(() => {
    logger.info('Process terminated')
    process.exit(0)
  })
})

// Start the server
startServer().catch(error => {
  logger.error('Failed to start server:', error)
  process.exit(1)
})

export default app
