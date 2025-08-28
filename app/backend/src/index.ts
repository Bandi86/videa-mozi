import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import path from 'path'
import dotenv from 'dotenv'
import usersRoutes from './routes/users.js'
import authRoutes from './routes/auth.js'
import healthRoutes from './routes/health.js'
// Social Features Routes
import postsRoutes from './routes/posts.js'
import commentsRoutes from './routes/comments.js'
import likesRoutes from './routes/likes.js'
import followersRoutes from './routes/followers.js'
import sharesRoutes from './routes/shares.js'
import reportsRoutes from './routes/reports.js'
import categoriesRoutes from './routes/categories.js'
import tagsRoutes from './routes/tags.js'
import imagesRoutes from './routes/images.js'
import contentRoutes from './routes/content.js'
import {
  corsOptions,
  securityHeaders,
  securityLogger,
  authRateLimiter,
  apiRateLimiter,
  contentRateLimiter,
  sanitizeInput,
} from './middlewares/security.js'
import {
  requestMonitoring,
  errorMonitoring,
  performanceProfiling,
  systemHealthMonitoring,
  trafficMonitoring,
  memoryMonitoring,
  securityMonitoring,
} from './middlewares/monitoring.js'
import { handleRateLimitError } from './middlewares/rateLimit.js'
import { swaggerUi, swaggerSpec } from './config/swagger.js'
import logger, { logAuthEvent, logSecurityEvent, logBusinessEvent } from './config/logger.js'
import {
  httpLogger,
  requestBodyLogger,
  responseBodyLogger,
  errorLogger,
  performanceLogger,
} from './middlewares/httpLogger.js'
import { correlationId } from './middlewares/correlation.js'
import { maintenanceMode } from './middlewares/maintenance.js'
import {
  extendResponse,
  responseFormat,
  wrapLegacyResponses,
} from './middlewares/responseFormat.js'
import { collectMetrics, metricsEndpoint } from './middlewares/metrics.js'
import { conditionalCompression } from './middlewares/compression.js'

dotenv.config({
  debug: process.env.DEBUG === 'true',
})

const app = express()
const PORT = process.env.PORT || 3001

// === EARLY MIDDLEWARE (Security & Infrastructure) ===

// Correlation ID for request tracking
app.use(correlationId)

// Security headers (must be early)
app.use(securityHeaders)
app.use(helmet())

// CORS configuration
app.use(cors(corsOptions))

// Maintenance mode check
app.use(maintenanceMode)

// Request/Response compression
app.use(conditionalCompression)

// === LOGGING & MONITORING ===

// HTTP logging
app.use(httpLogger)

// Performance monitoring
app.use(performanceLogger)

// Request/Response body logging (optional, for debugging)
if (process.env.LOG_REQUEST_BODY === 'true') {
  app.use(requestBodyLogger)
}
if (process.env.LOG_RESPONSE_BODY === 'true') {
  app.use(responseBodyLogger)
}

// Security event logging
app.use(securityLogger)

// === ADVANCED MONITORING ===
// Request monitoring and performance tracking
app.use(requestMonitoring)

// System health monitoring
app.use(systemHealthMonitoring)

// Traffic monitoring and anomaly detection
app.use(trafficMonitoring)

// Memory monitoring and alerts
app.use(memoryMonitoring)

// Security pattern monitoring
app.use(securityMonitoring)

// Performance profiling
app.use(performanceProfiling)

// Input sanitization (must come before body parsing)
app.use(sanitizeInput)

// Metrics collection
app.use(collectMetrics)

// === PARSING & FORMATTING ===

// Body parsing middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Extend response with helper methods
app.use(extendResponse)

// Response formatting
app.use(responseFormat)

// Legacy response wrapping for backward compatibility
app.use(wrapLegacyResponses)

// === DEVELOPMENT LOGGING ===
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('combined'))
}

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Videa Mozi Backend API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
  })
})

// Static file serving for uploaded images
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

// API Documentation
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    swaggerOptions: {
      url: '/api-docs/swagger.json',
    },
  }),
)

// Serve raw Swagger JSON
app.get('/api-docs/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.send(swaggerSpec)
})

// Health and monitoring routes (always available)
app.use('/health', healthRoutes)

// Metrics endpoint
app.get('/metrics', metricsEndpoint)

// API Routes with specific rate limiting

// Authentication routes - strict rate limiting
app.use('/api/v1/auth', authRateLimiter, authRoutes)

// User management - general rate limiting
app.use('/api/v1/users', apiRateLimiter, usersRoutes)

// Content operations - content-specific rate limiting
app.use('/api/v1/content', contentRateLimiter, contentRoutes)

// Social Features API Routes - general rate limiting
app.use('/api/v1/posts', apiRateLimiter, postsRoutes)
app.use('/api/v1/comments', apiRateLimiter, commentsRoutes)
app.use('/api/v1/likes', apiRateLimiter, likesRoutes)
app.use('/api/v1/followers', apiRateLimiter, followersRoutes)
app.use('/api/v1/shares', apiRateLimiter, sharesRoutes)
app.use('/api/v1/reports', apiRateLimiter, reportsRoutes)
app.use('/api/v1/categories', apiRateLimiter, categoriesRoutes)
app.use('/api/v1/tags', apiRateLimiter, tagsRoutes)
app.use('/api/v1/images', apiRateLimiter, imagesRoutes)

// 404 handler for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
  })
})

// Global error handler
app.use(errorLogger) // Log errors first
app.use(errorMonitoring) // Record error metrics
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Handle rate limit errors
  if (err.name === 'RateLimiterError') {
    return handleRateLimitError(err, req, res, next)
  }

  // Handle CORS errors
  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({
      error: 'CORS error',
      message: 'Origin not allowed',
    })
  }

  // Handle validation errors
  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: 'Validation error',
      details: err.errors,
    })
  }

  // Handle Prisma errors
  if (err.code && err.code.startsWith('P')) {
    console.error('Database error:', err)
    return res.status(500).json({
      error: 'Database error',
      message: 'An internal database error occurred',
    })
  }

  // Generic error response
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    message: 'Something went wrong. Please try again later.',
  })
})

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully')
  logBusinessEvent('server_shutdown', 'application', 'SIGTERM')
  process.exit(0)
})

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully')
  logBusinessEvent('server_shutdown', 'application', 'SIGINT')
  process.exit(0)
})

// Log uncaught exceptions
process.on('uncaughtException', err => {
  logger.error('Uncaught Exception:', err)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

app.listen(PORT, () => {
  const serverInfo = {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    apiDocsUrl: `http://localhost:${PORT}/api-docs`,
    swaggerJsonUrl: `http://localhost:${PORT}/api-docs/swagger.json`,
  }

  logger.info('🚀 Videa Mozi Backend started successfully', serverInfo)
  logBusinessEvent('server_startup', 'application', PORT.toString(), serverInfo)

  // Console output for development convenience
  console.log(`🚀 Videa Mozi Backend running on http://localhost:${PORT}`)
  console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`)
  console.log(`📖 Swagger JSON: http://localhost:${PORT}/api-docs/swagger.json`)
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`)
})
