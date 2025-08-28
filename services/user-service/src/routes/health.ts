import express from 'express'
import os from 'os'
import { query, validationResult } from 'express-validator'
import prisma from '../config/database.js'
import logger from '../config/logger.js'

const router = express.Router()

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check
 *     description: Check service health and basic metrics
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
 *                   example: "healthy"
 *                 service:
 *                   type: string
 *                   example: "user-service"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
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
 *                   description: Memory usage information
 *                 database:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [connected, disconnected]
 *                     responseTime:
 *                       type: number
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                   description: Database connection status
 *               required: [status, service, timestamp, uptime, memory, database]
 *       503:
 *         description: Service is unhealthy
 */
router.get('/', async (req, res) => {
  try {
    const startTime = Date.now()

    // Check database connection
    let dbStatus = 'disconnected'
    let dbResponseTime = 0

    try {
      const dbStartTime = Date.now()
      await prisma.$queryRaw`SELECT 1`
      dbResponseTime = Date.now() - dbStartTime
      dbStatus = 'connected'
    } catch (error) {
      logger.error('Database health check failed:', error)
    }

    // Get memory information
    const totalMemory = os.totalmem()
    const freeMemory = os.freemem()
    const usedMemory = totalMemory - freeMemory
    const memoryPercentage = Math.round((usedMemory / totalMemory) * 100)

    const health = {
      status: dbStatus === 'connected' ? 'healthy' : 'unhealthy',
      service: 'user-service',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        used: Math.round(usedMemory / 1024 / 1024), // MB
        total: Math.round(totalMemory / 1024 / 1024), // MB
        percentage: memoryPercentage,
      },
      database: {
        status: dbStatus,
        responseTime: dbResponseTime,
        timestamp: new Date().toISOString(),
      },
      system: {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        cpuCount: os.cpus().length,
        loadAverage: os.loadavg(),
      },
    }

    const statusCode = health.status === 'healthy' ? 200 : 503
    res.status(statusCode).json(health)
  } catch (error: any) {
    logger.error('Health check error:', error)
    res.status(503).json({
      status: 'unhealthy',
      service: 'user-service',
      timestamp: new Date().toISOString(),
      error: error.message,
    })
  }
})

/**
 * @swagger
 * /health/services:
 *   get:
 *     summary: Services health check
 *     description: Check health of dependent services
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Services health retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
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
 */
router.get('/services', async (req, res) => {
  try {
    const services: any = {}

    // Database health
    const dbStartTime = Date.now()
    try {
      await prisma.$queryRaw`SELECT 1`
      services.database = {
        status: 'healthy',
        responseTime: Date.now() - dbStartTime,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      services.database = {
        status: 'unhealthy',
        responseTime: Date.now() - dbStartTime,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }

    // Redis health (if available)
    const redisStartTime = Date.now()
    try {
      // TODO: Add Redis client check when Redis is integrated
      services.redis = {
        status: 'not_configured',
        responseTime: Date.now() - redisStartTime,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      services.redis = {
        status: 'unhealthy',
        responseTime: Date.now() - redisStartTime,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }

    const overallStatus = Object.values(services).every(
      (service: any) => service.status === 'healthy',
    )
      ? 'healthy'
      : 'unhealthy'

    res.json({
      status: overallStatus,
      services,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    logger.error('Services health check error:', error)
    res.status(503).json({
      status: 'unhealthy',
      services: {},
      timestamp: new Date().toISOString(),
      error: error.message,
    })
  }
})

/**
 * @swagger
 * /health/metrics:
 *   get:
 *     summary: Application metrics
 *     description: Get detailed application metrics
 *     tags: [Health]
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [1h, 24h, 7d, 30d]
 *           default: 24h
 *         description: Time period for metrics
 *     responses:
 *       200:
 *         description: Metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 period:
 *                   type: string
 *                 metrics:
 *                   type: object
 *                   properties:
 *                     users:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         active:
 *                           type: integer
 *                         verified:
 *                           type: integer
 *                         byRole:
 *                           type: object
 *                         byStatus:
 *                           type: object
 *                       required: [total, active, verified, byRole, byStatus]
 *                     performance:
 *                       type: object
 *                       properties:
 *                         uptime:
 *                           type: number
 *                         memoryUsage:
 *                           type: number
 *                         cpuUsage:
 *                           type: number
 *                       required: [uptime, memoryUsage, cpuUsage]
 *                     database:
 *                       type: object
 *                       properties:
 *                         connectionPool:
 *                           type: object
 *                         queryCount:
 *                           type: integer
 *                         slowQueries:
 *                           type: integer
 *                       required: [connectionPool, queryCount, slowQueries]
 *                   required: [users, performance, database]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *               required: [period, metrics, timestamp]
 */
router.get(
  '/metrics',
  [query('period').optional().isIn(['1h', '24h', '7d', '30d'])],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        })
      }

      const period = (req.query.period as string) || '24h'

      // Calculate date range
      const now = new Date()
      let dateFrom: Date

      switch (period) {
        case '1h':
          dateFrom = new Date(now.getTime() - 60 * 60 * 1000)
          break
        case '24h':
          dateFrom = new Date(now.getTime() - 24 * 60 * 60 * 1000)
          break
        case '7d':
          dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case '30d':
          dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
        default:
          dateFrom = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      }

      // Get user statistics
      const userStats = await prisma.user.groupBy({
        by: ['role'],
        _count: true,
        where: {
          createdAt: {
            gte: dateFrom,
          },
        },
      })

      const totalUsers = await prisma.user.count()
      const activeUsers = await prisma.user.count({
        where: { status: 'ACTIVE' },
      })
      const verifiedUsers = await prisma.user.count({
        where: { isEmailVerified: true },
      })

      const usersByRole = await prisma.user.groupBy({
        by: ['role'],
        _count: true,
      })

      const usersByStatus = await prisma.user.groupBy({
        by: ['status'],
        _count: true,
      })

      // Get memory usage
      const memUsage = process.memoryUsage()
      const totalMemory = os.totalmem()
      const freeMemory = os.freemem()
      const memoryPercentage = ((totalMemory - freeMemory) / totalMemory) * 100

      // Get CPU usage
      const cpus = os.cpus()
      let totalIdle = 0
      let totalTick = 0

      cpus.forEach(cpu => {
        for (const type in cpu.times) {
          totalTick += (cpu.times as any)[type]
        }
        totalIdle += cpu.times.idle
      })

      const idle = totalIdle / cpus.length
      const total = totalTick / cpus.length
      const cpuUsage = 100 - ~~((100 * idle) / total)

      const metrics = {
        period,
        metrics: {
          users: {
            total: totalUsers,
            active: activeUsers,
            verified: verifiedUsers,
            byRole: usersByRole.reduce(
              (acc, item) => {
                acc[item.role] = item._count
                return acc
              },
              {} as Record<string, number>,
            ),
            byStatus: usersByStatus.reduce(
              (acc, item) => {
                acc[item.status] = item._count
                return acc
              },
              {} as Record<string, number>,
            ),
          },
          performance: {
            uptime: process.uptime(),
            memoryUsage: memoryPercentage,
            cpuUsage: cpuUsage,
          },
          database: {
            connectionPool: {
              active: 1, // TODO: Get actual connection pool stats
              idle: 0,
              waiting: 0,
            },
            queryCount: 0, // TODO: Implement query counting
            slowQueries: 0, // TODO: Implement slow query tracking
          },
        },
        timestamp: new Date().toISOString(),
      }

      res.json(metrics)
    } catch (error: any) {
      logger.error('Metrics error:', error)
      res.status(500).json({
        error: 'Failed to get metrics',
        message: error.message,
        timestamp: new Date().toISOString(),
      })
    }
  },
)

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
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "pong"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *               required: [message, timestamp]
 */
router.get('/ping', (req, res) => {
  res.json({
    message: 'pong',
    timestamp: new Date().toISOString(),
  })
})

/**
 * @swagger
 * /health/ready:
 *   get:
 *     summary: Readiness check
 *     description: Check if service is ready to accept traffic
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
 *                   example: "ready"
 *                 service:
 *                   type: string
 *                   example: "user-service"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *               required: [status, service, timestamp]
 *       503:
 *         description: Service is not ready
 */
router.get('/ready', async (req, res) => {
  try {
    // Check database readiness
    await prisma.$queryRaw`SELECT 1`

    res.json({
      status: 'ready',
      service: 'user-service',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    logger.error('Readiness check failed:', error)
    res.status(503).json({
      status: 'not ready',
      service: 'user-service',
      timestamp: new Date().toISOString(),
      error: 'Database not ready',
    })
  }
})

export { router as healthRouter }
