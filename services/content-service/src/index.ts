import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import responseTime from 'response-time'
import rateLimit from 'express-rate-limit'
// import { body, validationResult } from 'express-validator' // Not used yet
import { PrismaClient } from '@prisma/client'
import Redis from 'ioredis'
import { setupSwagger } from './config/swagger.js'
import logger from './config/logger.js'
import { apolloServer } from './graphql/index.js'
import { moviesRouter } from './routes/movies.js'
import { seriesRouter } from './routes/series.js'
import { categoriesRouter } from './routes/categories.js'
import { healthRouter } from './routes/health.js'
import { websocketRouter } from './routes/websocket.js'
import { initializeWebSocket, WebSocketServer } from './websocket/server.js'

// Extend global type for WebSocket server
declare global {
  var websocketServer: WebSocketServer | undefined
}
import { errorHandler } from './middleware/error.js'
import { requestLogging } from './middleware/logging.js'
import { performanceMonitoring } from './middleware/performance.js'

// Environment variables
const PORT = process.env.PORT || 3003
const NODE_ENV = process.env.NODE_ENV || 'development'
const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/videa_mozi_content'
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

// Initialize clients
const prisma = new PrismaClient({
  log: NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
})

// Logger is already imported above

// Create Express app
const app = express()

// Global middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  }),
)

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  }),
)

app.use(compression())
app.use(responseTime())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Request logging
app.use(requestLogging)

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil((15 * 60 * 1000) / 1000),
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: req => req.path.startsWith('/health'), // Skip health checks
})

app.use(limiter)

// Performance monitoring
app.use(performanceMonitoring)

// Swagger documentation
setupSwagger(app)

// GraphQL endpoint
await apolloServer.start()
apolloServer.applyMiddleware({
  app,
  path: '/graphql',
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})

// Health check (no authentication required)
app.use('/health', healthRouter)

// API routes
app.use('/api/v1/movies', moviesRouter)
app.use('/api/v1/series', seriesRouter)
app.use('/api/v1/categories', categoriesRouter)

// WebSocket information endpoint
app.use('/websocket', websocketRouter)

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `The requested path ${req.originalUrl} does not exist.`,
    availableEndpoints: {
      movies: '/api/v1/movies/*',
      series: '/api/v1/series/*',
      categories: '/api/v1/categories/*',
      health: '/health/*',
      docs: '/api-docs',
      graphql: '/graphql',
      graphiql: '/graphql (with playground in development)',
      websocket: '/websocket/*',
      ws: 'ws://localhost:3003 (WebSocket endpoint)',
    },
  })
})

// Global error handler
app.use(errorHandler)

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down Content Service gracefully')
  await redis.quit()
  await prisma.$disconnect()
  process.exit(0)
})

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down Content Service gracefully')
  await redis.quit()
  await prisma.$disconnect()
  process.exit(0)
})

// Connect to database and Redis
async function connectServices() {
  try {
    // Connect to database (temporarily disabled due to Prisma compatibility issues)
    // await prisma.$connect()
    logger.info('Database connection temporarily disabled (Prisma compatibility issue)')

    // Connect to Redis
    await redis.connect()
    logger.info('✅ Connected to Redis')

    // Start server
    const server = app.listen(PORT, () => {
      logger.info(`🚀 Content Service started on port ${PORT}`)
      logger.info(`📚 REST API Documentation: http://localhost:${PORT}/api-docs`)
      logger.info(`🔺 GraphQL Playground: http://localhost:${PORT}/graphql`)
      logger.info(`🔌 WebSocket Server: ws://localhost:${PORT}`)
      logger.info(`📋 WebSocket Info: http://localhost:${PORT}/websocket`)
      logger.info(`💚 Health Check: http://localhost:${PORT}/health`)

      if (NODE_ENV === 'development') {
        logger.info('🔧 Development mode enabled')
        logger.info(`🗄️  Database: ${DATABASE_URL.split('@')[1]}`)
        logger.info(`🔴 Redis: ${REDIS_URL}`)
        logger.info(`📊 GraphQL Schema: Available at /graphql`)
        logger.info(`🔌 WebSocket: Real-time features enabled`)
      }
    })

    // Initialize WebSocket server
    const websocketServer = initializeWebSocket(server)
    logger.info(`🔌 WebSocket Server initialized on port ${PORT}`)

    // Export websocket server for use in other modules
    global.websocketServer = websocketServer
  } catch (error) {
    logger.error('❌ Failed to connect to services:', error)
    process.exit(1)
  }
}

// Export for testing
export { app, prisma, redis }

// Start the service
connectServices().catch(error => {
  logger.error('❌ Failed to start Content Service:', error)
  process.exit(1)
})
