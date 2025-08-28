import express from 'express'
import { ServiceHealthChecker } from '../middleware/error.js'
import logger from '../config/logger.js'

const router = express.Router()

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Get API Gateway health status
 *     description: Returns comprehensive health information about the API Gateway and all connected services
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: API Gateway is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [healthy, degraded, unhealthy]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   description: Uptime in seconds
 *                 memory:
 *                   type: object
 *                   properties:
 *                     used:
 *                       type: number
 *                     total:
 *                       type: number
 *                     usage:
 *                       type: number
 *                 services:
 *                   type: object
 *                   description: Status of all connected services
 *                   additionalProperties:
 *                     type: boolean
 *               required: [status, timestamp]
 *       503:
 *         description: API Gateway is unhealthy
 */
router.get('/', async (_req, res) => {
  try {
    const uptime = process.uptime()
    const memUsage = process.memoryUsage()
    const serviceHealth = ServiceHealthChecker.getHealthStatus()

    // Calculate overall health
    const unhealthyServices = Object.values(serviceHealth).filter(healthy => !healthy).length
    const totalServices = Object.keys(serviceHealth).length

    let status: 'healthy' | 'degraded' | 'unhealthy'
    if (unhealthyServices === 0) {
      status = 'healthy'
    } else if (unhealthyServices < totalServices * 0.5) {
      status = 'degraded'
    } else {
      status = 'unhealthy'
    }

    const health = {
      status,
      timestamp: new Date().toISOString(),
      uptime: Math.round(uptime),
      memory: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        total: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        usage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100), // %
      },
      services: serviceHealth,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        architecture: process.arch,
        pid: process.pid,
      },
    }

    const statusCode = status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503
    res.status(statusCode).json(health)
  } catch (error) {
    logger.error('Health check failed:', error)
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      uptime: Math.round(process.uptime()),
    })
  }
})

/**
 * @swagger
 * /health/services:
 *   get:
 *     summary: Get individual service health status
 *     description: Returns detailed health information for each connected service
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service health information retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 services:
 *                   type: object
 *                   additionalProperties:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       url:
 *                         type: string
 *                       healthy:
 *                         type: boolean
 *                       lastCheck:
 *                         type: number
 *                       responseTime:
 *                         type: number
 *               required: [services]
 */
router.get('/services', async (_req, res) => {
  try {
    const serviceHealth = ServiceHealthChecker.getHealthStatus()

    // Enhanced service information
    const services = {
      'user-service': {
        name: 'User Service',
        url: process.env.USER_SERVICE_URL || 'http://localhost:3002',
        healthy: serviceHealth['user-service'] || false,
        description: 'Authentication, user management, and profiles',
      },
      'content-service': {
        name: 'Content Service',
        url: process.env.CONTENT_SERVICE_URL || 'http://localhost:3003',
        healthy: serviceHealth['content-service'] || false,
        description: 'Movie and series catalog management',
      },
      'social-service': {
        name: 'Social Service',
        url: process.env.SOCIAL_SERVICE_URL || 'http://localhost:3004',
        healthy: serviceHealth['social-service'] || false,
        description: 'Posts, comments, likes, shares, and followers',
      },
      'moderation-service': {
        name: 'Moderation Service',
        url: process.env.MODERATION_SERVICE_URL || 'http://localhost:3005',
        healthy: serviceHealth['moderation-service'] || false,
        description: 'Reports and content moderation',
      },
      'media-service': {
        name: 'Media Service',
        url: process.env.MEDIA_SERVICE_URL || 'http://localhost:3006',
        healthy: serviceHealth['media-service'] || false,
        description: 'Image and file uploads',
      },
      'monitoring-service': {
        name: 'Monitoring Service',
        url: process.env.MONITORING_SERVICE_URL || 'http://localhost:3007',
        healthy: serviceHealth['monitoring-service'] || false,
        description: 'System health and performance monitoring',
      },
    }

    res.json({
      services,
      timestamp: new Date().toISOString(),
      summary: {
        total: Object.keys(services).length,
        healthy: Object.values(services).filter(s => s.healthy).length,
        unhealthy: Object.values(services).filter(s => !s.healthy).length,
      },
    })
  } catch (error) {
    logger.error('Service health check failed:', error)
    res.status(500).json({
      error: 'Failed to retrieve service health',
      timestamp: new Date().toISOString(),
    })
  }
})

/**
 * @swagger
 * /health/metrics:
 *   get:
 *     summary: Get API Gateway metrics
 *     description: Returns performance and usage metrics for the API Gateway
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   description: Uptime in seconds
 *                 memory:
 *                   type: object
 *                   properties:
 *                     rss:
 *                       type: number
 *                     heapTotal:
 *                       type: number
 *                     heapUsed:
 *                       type: number
 *                     external:
 *                       type: number
 *                 process:
 *                   type: object
 *                   properties:
 *                     pid:
 *                       type: integer
 *                     platform:
 *                       type: string
 *                     version:
 *                       type: string
 *                     arch:
 *                       type: string
 *                 environment:
 *                   type: object
 *                   properties:
 *                     node_env:
 *                       type: string
 *                     timezone:
 *                       type: string
 */
router.get('/metrics', async (_req, res) => {
  try {
    const memUsage = process.memoryUsage()
    const cpuUsage = process.cpuUsage()

    const metrics = {
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        external: Math.round(memUsage.external / 1024 / 1024), // MB
        usage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100), // %
      },
      cpu: {
        user: Math.round(cpuUsage.user / 1000), // ms
        system: Math.round(cpuUsage.system / 1000), // ms
        total: Math.round((cpuUsage.user + cpuUsage.system) / 1000), // ms
      },
      process: {
        pid: process.pid,
        platform: process.platform,
        version: process.version,
        arch: process.arch,
        cwd: process.cwd(),
      },
      environment: {
        node_env: process.env.NODE_ENV,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        hostname: require('os').hostname(),
      },
      performance: {
        loadAverage: require('os').loadavg(),
        freemem: Math.round(require('os').freemem() / 1024 / 1024), // MB
        totalmem: Math.round(require('os').totalmem() / 1024 / 1024), // MB
      },
    }

    res.json(metrics)
  } catch (error) {
    logger.error('Metrics retrieval failed:', error)
    res.status(500).json({
      error: 'Failed to retrieve metrics',
      timestamp: new Date().toISOString(),
    })
  }
})

/**
 * @swagger
 * /health/ping:
 *   get:
 *     summary: Simple ping/pong health check
 *     description: Returns a simple pong response to verify the API Gateway is running
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: API Gateway is responding
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: pong
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   description: Uptime in seconds
 *               required: [status, timestamp, uptime]
 */
router.get('/ping', (_req, res) => {
  res.json({
    status: 'pong',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    service: 'API Gateway',
  })
})

/**
 * @swagger
 * /health/ready:
 *   get:
 *     summary: Readiness probe
 *     description: Checks if the API Gateway is ready to accept traffic
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: API Gateway is ready
 *       503:
 *         description: API Gateway is not ready
 */
router.get('/ready', async (_req, res) => {
  try {
    const serviceHealth = ServiceHealthChecker.getHealthStatus()

    // Check if critical services are healthy
    const criticalServices = ['user-service', 'content-service']
    const criticalServicesHealthy = criticalServices.every(service => serviceHealth[service])

    if (criticalServicesHealthy) {
      res.json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        services: serviceHealth,
      })
    } else {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        services: serviceHealth,
        message: 'Critical services are not healthy',
      })
    }
  } catch (error) {
    logger.error('Readiness check failed:', error)
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: 'Readiness check failed',
    })
  }
})

export { router as healthRouter }
