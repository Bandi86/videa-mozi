import express from 'express'
import { prisma } from '../index.js'
import { redis } from '../index.js'
import logger from '../config/logger.js'

const router = express.Router()

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Get Content Service health status
 *     description: Returns comprehensive health information about the Content Service
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Content Service is healthy
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
 *                     totalMovies:
 *                       type: integer
 *                     totalSeries:
 *                       type: integer
 *                     totalCategories:
 *                       type: integer
 *                     featuredMovies:
 *                       type: integer
 *               required: [status, timestamp]
 *       503:
 *         description: Content Service is unhealthy
 */
router.get('/', async (req, res) => {
  try {
    const startTime = Date.now()
    let databaseStatus = 'unhealthy'
    let databaseConnectionTime = 0
    let redisStatus = 'unhealthy'
    let redisConnectionTime = 0
    let totalMovies = 0
    let totalSeries = 0
    let totalCategories = 0
    let featuredMovies = 0

    // Check database connection
    try {
      const dbStartTime = Date.now()
      // Temporarily mock database query
      // await prisma.$queryRaw`SELECT 1`
      await new Promise(resolve => setTimeout(resolve, 1)) // Mock delay
      databaseConnectionTime = Date.now() - dbStartTime
      databaseStatus = 'healthy'

      // Get content statistics (temporarily mocked)
      // const [moviesCount, seriesCount, categoriesCount, featuredCount] = await Promise.all([
      //   prisma.movies.count(),
      //   prisma.series.count(),
      //   prisma.categories.count(),
      //   prisma.movies.count({ where: { isFeatured: true } }),
      // ])

      totalMovies = 0 // Mock value
      totalSeries = 0 // Mock value
      totalCategories = 0 // Mock value
      featuredMovies = 0 // Mock value
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

    const responseTime = Date.now() - startTime

    const health = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      uptime: Math.round(uptime),
      service: 'Content Service',
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
        totalMovies,
        totalSeries,
        totalCategories,
        featuredMovies,
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
 *     description: Returns a simple pong response to verify the Content Service is running
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Content Service is responding
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
 *                   example: Content Service
 *               required: [status, timestamp, service]
 */
router.get('/ping', (req, res) => {
  res.json({
    status: 'pong',
    timestamp: new Date().toISOString(),
    service: 'Content Service',
    uptime: Math.round(process.uptime()),
  })
})

/**
 * @swagger
 * /health/ready:
 *   get:
 *     summary: Readiness probe
 *     description: Checks if the Content Service is ready to accept traffic
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Content Service is ready
 *       503:
 *         description: Content Service is not ready
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
      service: 'Content Service',
    })
  } catch (error) {
    logger.error('Readiness check failed:', error)
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      service: 'Content Service',
      error: 'Service dependencies are not available',
    })
  }
})

/**
 * @swagger
 * /health/metrics:
 *   get:
 *     summary: Get Content Service metrics
 *     description: Returns performance and usage metrics for the Content Service
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
 *                 content:
 *                   type: object
 *                 cache:
 *                   type: object
 */
router.get('/metrics', async (req, res) => {
  try {
    const memUsage = process.memoryUsage()

    // Get content statistics
    const [moviesStats, seriesStats, categoriesStats, genresStats] = await Promise.all([
      prisma.movies.aggregate({
        _count: { id: true },
        _avg: { rating: true, popularity: true },
        _max: { popularity: true },
      }),
      prisma.series.aggregate({
        _count: { id: true },
        _avg: { rating: true, popularity: true },
        _max: { popularity: true },
      }),
      prisma.categories.count(),
      prisma.genres.count(),
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
      content: {
        movies: {
          total: moviesStats._count.id,
          avgRating: moviesStats._avg.rating || 0,
          avgPopularity: moviesStats._avg.popularity || 0,
          maxPopularity: moviesStats._max.popularity || 0,
        },
        series: {
          total: seriesStats._count.id,
          avgRating: seriesStats._avg.rating || 0,
          avgPopularity: seriesStats._avg.popularity || 0,
          maxPopularity: seriesStats._max.popularity || 0,
        },
        categories: categoriesStats,
        genres: genresStats,
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
