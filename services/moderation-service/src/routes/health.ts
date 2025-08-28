import express from 'express'
import { query, validationResult } from 'express-validator'
import prisma from '../config/database.js'
import { reportsService } from '../services/reportsService.js'
import { contentFlagsService } from '../services/contentFlagsService.js'
import { moderationQueueService } from '../services/moderationQueueService.js'
import { appealsService } from '../services/appealsService.js'
import logger from '../config/logger.js'

const router = express.Router()

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Basic health check
 *     description: Check if the Moderation Service is running
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 service:
 *                   type: string
 *                   example: moderation-service
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *               required: [status, service, timestamp]
 */
router.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'moderation-service',
    timestamp: new Date().toISOString(),
  })
})

/**
 * @swagger
 * /health/services:
 *   get:
 *     summary: Check service dependencies
 *     description: Check the health of all service dependencies
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: All services are healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 services:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                         responseTime:
 *                           type: number
 *                         timestamp:
 *                           type: string
 *                           format: date-time
 *                       required: [status, responseTime, timestamp]
 *                     redis:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                         responseTime:
 *                           type: number
 *                         timestamp:
 *                           type: string
 *                           format: date-time
 *                       required: [status, responseTime, timestamp]
 *                   required: [database, redis]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *               required: [status, services, timestamp]
 *       503:
 *         description: One or more services are unhealthy
 */
router.get('/services', async (req, res) => {
  const services = {
    database: { status: 'unknown', responseTime: 0, timestamp: '' },
    redis: { status: 'unknown', responseTime: 0, timestamp: '' },
  }

  let overallStatus = 'healthy'

  // Check database
  try {
    const dbStart = Date.now()
    await prisma.$queryRaw`SELECT 1`
    const dbResponseTime = Date.now() - dbStart

    services.database = {
      status: 'healthy',
      responseTime: dbResponseTime,
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    services.database = {
      status: 'unhealthy',
      responseTime: 0,
      timestamp: new Date().toISOString(),
    }
    overallStatus = 'unhealthy'
    logger.error('Database health check failed:', error)
  }

  // Check Redis (if available)
  if (global.redisClient) {
    try {
      const redisStart = Date.now()
      await global.redisClient.ping()
      const redisResponseTime = Date.now() - redisStart

      services.redis = {
        status: 'healthy',
        responseTime: redisResponseTime,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      services.redis = {
        status: 'unhealthy',
        responseTime: 0,
        timestamp: new Date().toISOString(),
      }
      overallStatus = 'unhealthy'
      logger.error('Redis health check failed:', error)
    }
  } else {
    services.redis = {
      status: 'not-configured',
      responseTime: 0,
      timestamp: new Date().toISOString(),
    }
  }

  const statusCode = overallStatus === 'healthy' ? 200 : 503

  res.status(statusCode).json({
    status: overallStatus,
    services,
    timestamp: new Date().toISOString(),
  })
})

/**
 * @swagger
 * /health/metrics:
 *   get:
 *     summary: Get service metrics
 *     description: Get comprehensive metrics about the moderation service
 *     tags: [Health]
 *     parameters:
 *       - in: query
 *         name: includeStats
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include detailed statistics
 *     responses:
 *       200:
 *         description: Metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 service:
 *                   type: string
 *                   example: moderation-service
 *                 uptime:
 *                   type: number
 *                   description: Service uptime in seconds
 *                 memory:
 *                   type: object
 *                   properties:
 *                     used:
 *                       type: number
 *                     total:
 *                       type: number
 *                     percentage:
 *                       type: number
 *                   required: [used, total, percentage]
 *                 statistics:
 *                   type: object
 *                   properties:
 *                     reports:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         pending:
 *                           type: integer
 *                         resolved:
 *                           type: integer
 *                         byType:
 *                           type: object
 *                       required: [total, pending, resolved, byType]
 *                     contentFlags:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         resolved:
 *                           type: integer
 *                         byType:
 *                           type: object
 *                       required: [total, resolved, byType]
 *                     moderationQueue:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         processed:
 *                           type: integer
 *                         byPriority:
 *                           type: object
 *                       required: [total, processed, byPriority]
 *                     appeals:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         pending:
 *                           type: integer
 *                         approved:
 *                           type: integer
 *                         byStatus:
 *                           type: object
 *                       required: [total, pending, approved, byStatus]
 *                   required: [reports, contentFlags, moderationQueue, appeals]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *               required: [service, uptime, memory, statistics, timestamp]
 */
router.get('/metrics', [query('includeStats').optional().isBoolean()], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      })
    }

    const includeStats = req.query.includeStats !== 'false'
    const startTime = process.hrtime.bigint()

    // Basic metrics
    const uptime = Math.round(process.uptime())
    const memUsage = process.memoryUsage()
    const memory = {
      used: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      total: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
      percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
    }

    let statistics = {}

    if (includeStats) {
      // Get statistics from all services
      const [reportsStats, contentFlagsStats, queueStats, appealsStats] = await Promise.all([
        reportsService.getReportStats(),
        contentFlagsService.getContentFlagStats(),
        moderationQueueService.getQueueStats(),
        appealsService.getAppealStats(),
      ])

      statistics = {
        reports: {
          total: reportsStats.total,
          pending: reportsStats.pending,
          resolved: reportsStats.resolved,
          byType: reportsStats.byType,
        },
        contentFlags: {
          total: contentFlagsStats.total,
          resolved: contentFlagsStats.resolved,
          byType: contentFlagsStats.byType,
        },
        moderationQueue: {
          total: queueStats.total,
          processed: queueStats.processed,
          byPriority: queueStats.byPriority,
        },
        appeals: {
          total: appealsStats.total,
          pending: appealsStats.pending,
          approved: appealsStats.approved,
          byStatus: appealsStats.byStatus,
        },
      }
    }

    const responseTime = Number(process.hrtime.bigint() - startTime) / 1e6 // milliseconds

    res.json({
      service: 'moderation-service',
      uptime,
      memory,
      responseTime,
      statistics,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    logger.error('Get metrics error:', error)
    res.status(500).json({
      error: 'Failed to get metrics',
      message: error.message,
      timestamp: new Date().toISOString(),
    })
  }
})

/**
 * @swagger
 * /health/ping:
 *   get:
 *     summary: Simple ping/pong health check
 *     description: Quick health check that returns pong
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Pong response
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: pong
 */
router.get('/ping', (req, res) => {
  res.send('pong')
})

/**
 * @swagger
 * /health/ready:
 *   get:
 *     summary: Readiness check
 *     description: Check if the service is ready to accept traffic
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is ready
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ready
 *                 checks:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: string
 *                       example: connected
 *                     redis:
 *                       type: string
 *                       example: connected
 *                   required: [database, redis]
 *               required: [status, checks]
 *       503:
 *         description: Service is not ready
 */
router.get('/ready', async (req, res) => {
  const checks = {
    database: 'unknown',
    redis: 'unknown',
  }

  let ready = true

  // Check database
  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = 'connected'
  } catch (error) {
    checks.database = 'disconnected'
    ready = false
  }

  // Check Redis
  if (global.redisClient) {
    try {
      await global.redisClient.ping()
      checks.redis = 'connected'
    } catch (error) {
      checks.redis = 'disconnected'
      ready = false
    }
  } else {
    checks.redis = 'not-configured'
  }

  const statusCode = ready ? 200 : 503
  const status = ready ? 'ready' : 'not-ready'

  res.status(statusCode).json({
    status,
    checks,
    timestamp: new Date().toISOString(),
  })
})

export { router as healthRouter }
