import express from 'express'
import { prisma } from '../index.js'
import { redis } from '../index.js'
import logger from '../config/logger.js'

const router = express.Router()

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Get Social Service health status
 *     description: Returns comprehensive health information about the Social Service
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Social Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [healthy, unhealthy]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                 database:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                     connectionTime:
 *                       type: number
 *                 redis:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                     connectionTime:
 *                       type: number
 *                 metrics:
 *                   type: object
 *                   properties:
 *                     totalPosts:
 *                       type: integer
 *                     totalUsers:
 *                       type: integer
 *                     totalComments:
 *                       type: integer
 *                     totalLikes:
 *                       type: integer
 *                     totalShares:
 *                       type: integer
 *                     totalFollowers:
 *                       type: integer
 *               required: [status, timestamp]
 *       503:
 *         description: Social Service is unhealthy
 */
router.get('/', async (req, res) => {
  try {
    const startTime = Date.now()
    let databaseStatus = 'unhealthy'
    let databaseConnectionTime = 0
    let redisStatus = 'unhealthy'
    let redisConnectionTime = 0
    let totalPosts = 0
    let totalUsers = 0
    let totalComments = 0
    let totalLikes = 0
    let totalShares = 0
    let totalFollowers = 0

    // Check database connection
    try {
      const dbStartTime = Date.now()
      await prisma.$queryRaw`SELECT 1`
      databaseConnectionTime = Date.now() - dbStartTime
      databaseStatus = 'healthy'

      // Get social statistics
      const [postsCount, usersCount, commentsCount, likesCount, sharesCount, followersCount] =
        await Promise.all([
          prisma.posts.count(),
          prisma.users.count(),
          prisma.comments.count(),
          prisma.likes.count(),
          prisma.shares.count(),
          prisma.followers.count(),
        ])

      totalPosts = postsCount
      totalUsers = usersCount
      totalComments = commentsCount
      totalLikes = likesCount
      totalShares = sharesCount
      totalFollowers = followersCount
    } catch (error) {
      logger.error('Database health check failed:', error)
      databaseStatus = 'unhealthy'
    }

    // Check Redis connection
    try {
      const redisStartTime = Date.now()
      await redis.ping()
      redisConnectionTime = Date.now() - redisStartTime
      redisStatus = 'healthy'
    } catch (error) {
      logger.error('Redis health check failed:', error)
      redisStatus = 'unhealthy'
    }

    const uptime = process.uptime()
    const overallStatus =
      databaseStatus === 'healthy' && redisStatus === 'healthy' ? 'healthy' : 'unhealthy'
    const statusCode = overallStatus === 'healthy' ? 200 : 503

    const health = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Math.round(uptime),
      service: 'Social Service',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      database: {
        status: databaseStatus,
        connectionTime: databaseConnectionTime,
      },
      redis: {
        status: redisStatus,
        connectionTime: redisConnectionTime,
      },
      metrics: {
        totalPosts,
        totalUsers,
        totalComments,
        totalLikes,
        totalShares,
        totalFollowers,
      },
    }

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
 * /health/ping:
 *   get:
 *     summary: Simple ping/pong health check
 *     description: Returns a simple pong response to verify the Social Service is running
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Social Service is responding
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
 *                 service:
 *                   type: string
 *                   example: Social Service
 *               required: [status, timestamp, service]
 */
router.get('/ping', (req, res) => {
  res.json({
    status: 'pong',
    timestamp: new Date().toISOString(),
    service: 'Social Service',
    uptime: Math.round(process.uptime()),
  })
})

/**
 * @swagger
 * /health/ready:
 *   get:
 *     summary: Readiness probe
 *     description: Checks if the Social Service is ready to accept traffic
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Social Service is ready
 *       503:
 *         description: Social Service is not ready
 */
router.get('/ready', async (req, res) => {
  try {
    // Check database readiness
    await prisma.$queryRaw`SELECT 1`

    // Check Redis readiness
    await redis.ping()

    res.json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      service: 'Social Service',
    })
  } catch (error) {
    logger.error('Readiness check failed:', error)
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      service: 'Social Service',
      error: 'Service dependencies are not available',
    })
  }
})

/**
 * @swagger
 * /health/metrics:
 *   get:
 *     summary: Get Social Service metrics
 *     description: Returns performance and usage metrics for the Social Service
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
 *                 memory:
 *                   type: object
 *                 process:
 *                   type: object
 *                 social:
 *                   type: object
 *                 engagement:
 *                   type: object
 *               required: [timestamp, uptime]
 */
router.get('/metrics', async (req, res) => {
  try {
    const memUsage = process.memoryUsage()

    // Get social statistics
    const [postsStats, engagementStats, activityStats] = await Promise.all([
      prisma.posts.aggregate({
        _count: { id: true },
        _avg: { likesCount: true, commentsCount: true, sharesCount: true },
        _sum: { likesCount: true, commentsCount: true, sharesCount: true },
      }),
      prisma.posts.aggregate({
        _count: { id: true },
        _avg: { likesCount: true, commentsCount: true, sharesCount: true },
        _max: { likesCount: true, commentsCount: true, sharesCount: true },
      }),
      prisma.activityFeed.count(),
    ])

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
      process: {
        pid: process.pid,
        platform: process.platform,
        version: process.version,
        arch: process.arch,
      },
      social: {
        posts: {
          total: postsStats._count.id,
          avgLikes: postsStats._avg.likesCount || 0,
          avgComments: postsStats._avg.commentsCount || 0,
          avgShares: postsStats._avg.sharesCount || 0,
          totalLikes: postsStats._sum.likesCount || 0,
          totalComments: postsStats._sum.commentsCount || 0,
          totalShares: postsStats._sum.sharesCount || 0,
        },
        engagement: {
          maxLikes: engagementStats._max.likesCount || 0,
          maxComments: engagementStats._max.commentsCount || 0,
          maxShares: engagementStats._max.sharesCount || 0,
        },
        activity: {
          totalActivities: activityStats,
        },
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

export { router as healthRouter }
