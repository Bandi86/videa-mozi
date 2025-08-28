import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import responseTime from 'response-time'
import rateLimit from 'express-rate-limit'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { authenticateToken } from './middleware/auth.js'
import { errorHandler } from './middleware/error.js'
import { requestLogging } from './middleware/logging.js'
import { setupSwagger } from './config/swagger.js'
import { healthRouter } from './routes/health.js'
import logger from './config/logger.js'

// Environment variables
const PORT = process.env.PORT || 3001
const NODE_ENV = process.env.NODE_ENV || 'development'

// Service URLs
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3002'
const CONTENT_SERVICE_URL = process.env.CONTENT_SERVICE_URL || 'http://localhost:3003'
const SOCIAL_SERVICE_URL = process.env.SOCIAL_SERVICE_URL || 'http://localhost:3004'
const MODERATION_SERVICE_URL = process.env.MODERATION_SERVICE_URL || 'http://localhost:3005'
const MEDIA_SERVICE_URL = process.env.MEDIA_SERVICE_URL || 'http://localhost:3006'
const MONITORING_SERVICE_URL = process.env.MONITORING_SERVICE_URL || 'http://localhost:3007'

// Create Express app
const app = express()

// Global middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        imgSrc: ["'self'", 'data:', 'https:', 'http:'],
        connectSrc: ["'self'", 'https:', 'http:'],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }),
)

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key'],
  }),
)

app.use(compression())
app.use(responseTime())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

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

// Health check routes (direct, no authentication required)
app.use('/health', healthRouter)

// Swagger documentation
setupSwagger(app)

// Authentication middleware for protected routes
app.use('/api', authenticateToken)

// Service proxy routes
// User Service routes
app.use(
  '/api/v1/auth',
  createProxyMiddleware({
    target: USER_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/v1/auth': '/api/v1/auth' },
  }),
)

app.use(
  '/api/v1/users',
  createProxyMiddleware({
    target: USER_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/v1/users': '/api/v1/users' },
  }),
)

// Content Service routes
app.use(
  '/api/v1/content',
  createProxyMiddleware({
    target: CONTENT_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/v1/content': '/api/v1/content' },
  }),
)

app.use(
  '/api/v1/categories',
  createProxyMiddleware({
    target: CONTENT_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/v1/categories': '/api/v1/categories' },
  }),
)

// Social Service routes
app.use(
  '/api/v1/posts',
  createProxyMiddleware({
    target: SOCIAL_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/v1/posts': '/api/v1/posts' },
  }),
)

app.use(
  '/api/v1/comments',
  createProxyMiddleware({
    target: SOCIAL_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/v1/comments': '/api/v1/comments' },
  }),
)

app.use(
  '/api/v1/likes',
  createProxyMiddleware({
    target: SOCIAL_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/v1/likes': '/api/v1/likes' },
  }),
)

app.use(
  '/api/v1/shares',
  createProxyMiddleware({
    target: SOCIAL_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/v1/shares': '/api/v1/shares' },
  }),
)

app.use(
  '/api/v1/followers',
  createProxyMiddleware({
    target: SOCIAL_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/v1/followers': '/api/v1/followers' },
  }),
)

app.use(
  '/api/v1/tags',
  createProxyMiddleware({
    target: SOCIAL_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/v1/tags': '/api/v1/tags' },
  }),
)

// Moderation Service routes
app.use(
  '/api/v1/reports',
  createProxyMiddleware({
    target: MODERATION_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/v1/reports': '/api/v1/reports' },
  }),
)

// Media Service routes
app.use(
  '/api/v1/images',
  createProxyMiddleware({
    target: MEDIA_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/v1/images': '/api/v1/images' },
  }),
)

app.use(
  '/api/v1/uploads',
  createProxyMiddleware({
    target: MEDIA_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/v1/uploads': '/api/v1/uploads' },
  }),
)

// Monitoring Service routes (admin only)
app.use(
  '/health/monitoring',
  createProxyMiddleware({
    target: MONITORING_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/health/monitoring': '/monitoring' },
  }),
)

// 404 handler for unmatched API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'API endpoint not found',
    message: `The requested API endpoint ${req.originalUrl} does not exist.`,
    availableEndpoints: {
      auth: '/api/v1/auth/*',
      users: '/api/v1/users/*',
      content: '/api/v1/content/*',
      categories: '/api/v1/categories/*',
      posts: '/api/v1/posts/*',
      comments: '/api/v1/comments/*',
      likes: '/api/v1/likes/*',
      shares: '/api/v1/shares/*',
      followers: '/api/v1/followers/*',
      tags: '/api/v1/tags/*',
      reports: '/api/v1/reports/*',
      images: '/api/v1/images/*',
      uploads: '/api/v1/uploads/*',
    },
  })
})

// 404 handler for unmatched routes
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `The requested path ${req.originalUrl} does not exist.`,
    availableRoutes: {
      health: '/health/*',
      api: '/api/v1/*',
      docs: '/api-docs',
    },
  })
})

// Global error handler (must be last)
app.use(errorHandler)

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down API Gateway gracefully')
  process.exit(0)
})

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down API Gateway gracefully')
  process.exit(0)
})

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 API Gateway started on port ${PORT}`)
  logger.info(`📚 API Documentation: http://localhost:${PORT}/api-docs`)
  logger.info(`💚 Health Check: http://localhost:${PORT}/health`)
  logger.info(`📊 Monitoring Dashboard: http://localhost:${PORT}/health/monitoring/dashboard/html`)

  if (NODE_ENV === 'development') {
    logger.info('🔧 Development mode enabled')
    logger.info(`🔗 User Service: ${USER_SERVICE_URL}`)
    logger.info(`🎬 Content Service: ${CONTENT_SERVICE_URL}`)
    logger.info(`👥 Social Service: ${SOCIAL_SERVICE_URL}`)
    logger.info(`🛡️  Moderation Service: ${MODERATION_SERVICE_URL}`)
    logger.info(`🖼️  Media Service: ${MEDIA_SERVICE_URL}`)
    logger.info(`📈 Monitoring Service: ${MONITORING_SERVICE_URL}`)
  }
})

export default app
