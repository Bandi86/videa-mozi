import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import expressRateLimit from 'express-rate-limit'
import { createServer } from 'http'
import { connectDatabase } from './config/database.js'
import prisma from './config/database.js'
import logger from './config/logger.js'
import { errorHandler, requestTimeout, circuitBreaker } from './middleware/error.js'
import { securityLogging, trafficAnalysis } from './middleware/logging.js'
import { postsRouter } from './routes/posts.js'
import { commentsRouter } from './routes/comments.js'
import { likesRouter } from './routes/likes.js'
import { sharesRouter } from './routes/shares.js'
import { followersRouter } from './routes/followers.js'
import { notificationsRouter } from './routes/notifications.js'
import { healthRouter } from './routes/health.js'
import { websocketRouter } from './routes/websocket.js'
import SocialWebSocketServer from './websocket/server.js'
import { initializeGraphQL } from './graphql/index.js'
import { initializeConsumer } from '../../../shared/src/messaging/consumers.js'
import { handleSocialServiceEvent } from './messaging/handlers.js'

// Load environment variables
const PORT = process.env.PORT || 3003
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
app.use('/api/posts', postsRouter)
app.use('/api/comments', commentsRouter)
app.use('/api/likes', likesRouter)
app.use('/api/shares', sharesRouter)
app.use('/api/followers', followersRouter)
app.use('/api/notifications', notificationsRouter)

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    availableEndpoints: {
      posts: '/api/posts',
      comments: '/api/comments',
      likes: '/api/likes',
      shares: '/api/shares',
      followers: '/api/followers',
      notifications: '/api/notifications',
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
    const websocketServer = new SocialWebSocketServer()
    await websocketServer.initialize(server)
    logger.info('🚀 WebSocket server initialized')

    // Initialize message consumer
    const consumer = await initializeConsumer({
      url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
      queue: 'social-service-queue',
      exchange: 'social-service-exchange',
    })
    await consumer.consume(handleSocialServiceEvent)
    logger.info('📨 Message consumer initialized and consuming events')

    logger.info('🎉 Social Service initialized successfully')
  } catch (error) {
    logger.error('Failed to initialize services:', error)
    process.exit(1)
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

      logger.info(`🚀 Social Service running on ${protocol}://localhost:${PORT}`)
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

// Export clients for use in other modules
export { prisma }

// Note: Redis is created locally in websocket server, but we export a reference for routes
// This will be fixed properly when we centralize Redis connection management
export const redis = null as any

export default app
