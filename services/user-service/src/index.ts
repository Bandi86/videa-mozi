import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import responseTime from 'response-time'
import * as bodyParser from 'body-parser'
import expressRateLimit from 'express-rate-limit'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

import { connectDatabase } from './config/database.js'
import logger, { logBusinessEvent } from './config/logger.js'

// Import routes
import { authRouter } from './routes/auth.js'
import { usersRouter } from './routes/users.js'
import { healthRouter } from './routes/health.js'
import { websocketRouter } from './routes/websocket.js'

// Import middleware
import errorHandler from './middleware/error.js'
import logging from './middleware/logging.js'
import security from './middleware/security.js'

// Import WebSocket
import { initializeWebSocket, WebSocketServer } from './websocket/server.js'

// Import GraphQL
import { apolloServer } from './graphql/index.js'

// Import Messaging
import { initializeConsumer } from '../../../shared/dist/messaging/consumers.js'
import { handleUserServiceEvent } from './messaging/handlers.js'

// Environment variables
const PORT = process.env.PORT || 3002
const NODE_ENV = process.env.NODE_ENV || 'development'
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*'

// Create Express app
const app = express()

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
    origin: CORS_ORIGIN,
    credentials: true,
  }),
)

// Rate limiting
const limiter = expressRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
})

app.use(limiter)

// Body parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Compression
app.use(compression())

// Response time monitoring
app.use(responseTime())

// Custom middleware
app.use(logging)
app.use(security)

// Health check endpoint (before other middleware)
app.use('/health', healthRouter)

// API routes
app.use('/api/auth', authRouter)
app.use('/api/users', usersRouter)
app.use('/api/websocket', websocketRouter)

// GraphQL endpoint
await apolloServer.start()
apolloServer.applyMiddleware({ app, path: '/graphql' })

logger.info('GraphQL endpoint enabled at /graphql')

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    availableRoutes: {
      auth: '/api/auth/*',
      users: '/api/users/*',
      websocket: '/api/websocket/*',
      graphql: '/graphql',
      health: '/health/*',
    },
  })
})

// Error handling middleware (must be last)
app.use(errorHandler)

// Start server function
const startServer = async (): Promise<void> => {
  try {
    // Connect to database (Prisma compatibility issue - temporarily disabled)
    // await connectDatabase()
    logger.info('Database connection temporarily disabled (Prisma compatibility issue)')

    // Initialize WebSocket server
    const server = app.listen(PORT, () => {
      const protocol = NODE_ENV === 'production' ? 'https' : 'http'
      const websocketUrl =
        NODE_ENV === 'production' ? `wss://localhost:${PORT}` : `ws://localhost:${PORT}`

      logger.info(`🚀 User Service running on ${protocol}://localhost:${PORT}`)
      logger.info(`📊 Health check: ${protocol}://localhost:${PORT}/health`)
      logger.info(`🔐 Authentication: ${protocol}://localhost:${PORT}/api/auth`)
      logger.info(`👥 Users: ${protocol}://localhost:${PORT}/api/users`)
      logger.info(`🔗 GraphQL Playground: ${protocol}://localhost:${PORT}/graphql`)
      logger.info(`🌐 WebSocket: ${websocketUrl}`)

      logBusinessEvent('service_started', {
        service: 'user-service',
        port: PORT,
        environment: NODE_ENV,
        timestamp: new Date().toISOString(),
      })
    })

    // Initialize WebSocket
    const websocketServer = initializeWebSocket(server)
    ;(global as any).websocketServer = websocketServer

    // Initialize message consumer
    const consumer = await initializeConsumer({
      url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
      queue: 'user-service-queue',
      exchange: 'user-service-exchange',
    })

    // TODO: Implement proper event handling when messaging is fully set up
    logger.info('Message consumer initialized')

    logger.info('📨 Message consumer initialized')
    logger.info('🎉 User Service initialized successfully')
  } catch (error: any) {
    logger.error('Failed to start server:', error)
    throw error
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', error => {
  logger.error('Uncaught Exception:', error)
  process.exit(1)
})

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

// Start the server
startServer().catch(error => {
  logger.error('Failed to start server:', error)
  process.exit(1)
})

export default app
