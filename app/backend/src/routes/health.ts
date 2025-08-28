import express from 'express'
import MonitoringService from '../services/monitoringService.js'
import { DatabaseOptimizationService } from '../services/databaseOptimizationService.js'
import { CacheService } from '../services/cacheService.js'
import responseTime from 'response-time'
import logger from '../config/logger.js'

const router = express.Router()

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Get comprehensive health status
 *     description: Returns detailed health information about the application and its dependencies
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Application is healthy
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
 *                   type: integer
 *                   description: Application uptime in seconds
 *                 version:
 *                   type: string
 *                 services:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           enum: [up, down]
 *                         responseTime:
 *                           type: integer
 *                         lastCheck:
 *                           type: string
 *                           format: date-time
 *       503:
 *         description: Application is unhealthy
 */
router.get('/', async (req, res) => {
  try {
    const healthStatus = await getHealthStatus()
    const statusCode = healthStatus.status === 'healthy' ? 200 : 503

    res.status(statusCode).json(healthStatus)
  } catch (error) {
    logger.error('Health check failed:', error)
    res.status(503).json({
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString(),
    })
  }
})

/**
 * @swagger
 * /ready:
 *   get:
 *     summary: Readiness probe
 *     description: Checks if the application is ready to serve traffic
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Application is ready
 *       503:
 *         description: Application is not ready
 */
router.get('/ready', async (req, res) => {
  try {
    const readinessStatus = await getReadinessStatus()
    const statusCode = readinessStatus.status === 'ready' ? 200 : 503

    res.status(statusCode).json(readinessStatus)
  } catch (error) {
    logger.error('Readiness check failed:', error)
    res.status(503).json({
      status: 'not_ready',
      error: 'Readiness check failed',
      timestamp: new Date().toISOString(),
    })
  }
})

/**
 * @swagger
 * /live:
 *   get:
 *     summary: Liveness probe
 *     description: Checks if the application is running (always returns 200 if server is up)
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Application is alive
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: alive
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: integer
 *                   description: Application uptime in seconds
 */
router.get('/live', (req, res) => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  })
})

/**
 * @swagger
 * /metrics:
 *   get:
 *     summary: Get application metrics
 *     description: Returns detailed application metrics including request counts, error rates, and performance data
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 requests:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     successful:
 *                       type: integer
 *                     failed:
 *                       type: integer
 *                     averageResponseTime:
 *                       type: number
 *                 errors:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     byType:
 *                       type: object
 *                 performance:
 *                   type: object
 *                   properties:
 *                     memoryUsage:
 *                       type: object
 *                     cpuUsage:
 *                       type: object
 *                     uptime:
 *                       type: integer
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.get('/metrics', (req, res) => {
  const metrics = getMetrics()
  res.json(metrics)
})

// Middleware to track response times and update metrics
router.use(
  responseTime((req: any, res: any, time: number) => {
    const success = res.statusCode < 400
    const errorType =
      res.statusCode >= 500 ? 'server_error' : res.statusCode >= 400 ? 'client_error' : undefined

    updateMetrics(success, time, errorType)
  }),
)

/**
 * @swagger
 * /health/dashboard:
 *   get:
 *     summary: Health monitoring dashboard
 *     description: Simple HTML dashboard showing application health and metrics
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: HTML dashboard
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 */
router.get('/dashboard', async (req, res) => {
  try {
    const healthStatus = await getHealthStatus()
    const metrics = getMetrics()

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Videa Mozi - Health Dashboard</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
            .healthy { background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
            .unhealthy { background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
            .metric { background-color: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 5px; }
            .metric h3 { margin-top: 0; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background-color: #f8f9fa; }
            .refresh { position: fixed; top: 20px; right: 20px; }
        </style>
        <meta http-equiv="refresh" content="30">
    </head>
    <body>
        <h1>🚀 Videa Mozi Health Dashboard</h1>

        <div class="status ${healthStatus.status === 'healthy' ? 'healthy' : 'unhealthy'}">
            <h2>Status: ${healthStatus.status.toUpperCase()}</h2>
            <p><strong>Version:</strong> ${healthStatus.version}</p>
            <p><strong>Uptime:</strong> ${Math.floor(healthStatus.uptime / 3600)}h ${Math.floor((healthStatus.uptime % 3600) / 60)}m</p>
            <p><strong>Last Check:</strong> ${new Date(healthStatus.timestamp).toLocaleString()}</p>
        </div>

        <div class="metric">
            <h3>📊 Services Status</h3>
            <table>
                <tr><th>Service</th><th>Status</th><th>Response Time</th><th>Last Check</th></tr>
                <tr>
                    <td>Database</td>
                    <td>${healthStatus.services.database.status}</td>
                    <td>${healthStatus.services.database.responseTime || 'N/A'}ms</td>
                    <td>${new Date(healthStatus.services.database.lastCheck).toLocaleString()}</td>
                </tr>
            </table>
        </div>

        <div class="metric">
            <h3>🧠 System Resources</h3>
            <table>
                <tr><th>Resource</th><th>Usage</th><th>Status</th></tr>
                <tr>
                    <td>Memory</td>
                    <td>${healthStatus.services.memory.used}MB / ${healthStatus.services.memory.total}MB (${healthStatus.services.memory.percentage}%)</td>
                    <td>${healthStatus.services.memory.status}</td>
                </tr>
                <tr>
                    <td>CPU</td>
                    <td>${healthStatus.services.cpu.usage}%</td>
                    <td>${healthStatus.services.cpu.status}</td>
                </tr>
            </table>
        </div>

        <div class="metric">
            <h3>📈 Request Metrics</h3>
            <table>
                <tr><th>Metric</th><th>Value</th></tr>
                <tr><td>Total Requests</td><td>${metrics.requests.total}</td></tr>
                <tr><td>Successful Requests</td><td>${metrics.requests.successful}</td></tr>
                <tr><td>Failed Requests</td><td>${metrics.requests.failed}</td></tr>
                <tr><td>Average Response Time</td><td>${metrics.requests.averageResponseTime.toFixed(2)}ms</td></tr>
            </table>
        </div>

        <div class="metric">
            <h3>❌ Error Summary</h3>
            <p>Total Errors: ${metrics.errors.total}</p>
            ${
              Object.keys(metrics.errors.byType).length > 0
                ? `<table>
                    <tr><th>Error Type</th><th>Count</th></tr>
                    ${Object.entries(metrics.errors.byType)
                      .map(([type, count]) => `<tr><td>${type}</td><td>${count}</td></tr>`)
                      .join('')}
                </table>`
                : '<p>No errors recorded</p>'
            }
        </div>

        <div class="refresh">
            <p>🔄 Auto-refreshes every 30 seconds</p>
            <button onclick="location.reload()">Refresh Now</button>
        </div>
    </body>
    </html>`

    res.setHeader('Content-Type', 'text/html')
    res.send(html)
  } catch (error) {
    logger.error('Dashboard error:', error)
    res.status(500).send('<h1>Error loading dashboard</h1>')
  }
})

/**
 * @swagger
 * /monitoring/dashboard:
 *   get:
 *     summary: Get comprehensive monitoring dashboard
 *     description: Returns real-time system health, performance metrics, database stats, and alerts
 *     tags: [Monitoring]
 *     parameters:
 *       - in: query
 *         name: hours
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 168
 *           default: 24
 *         description: Number of hours of historical data to include
 *     responses:
 *       200:
 *         description: Monitoring dashboard data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 systemHealth:
 *                   type: object
 *                   properties:
 *                     cpuUsage:
 *                       type: number
 *                     memoryUsage:
 *                       type: number
 *                     uptime:
 *                       type: number
 *                     loadAverage:
 *                       type: array
 *                       items:
 *                         type: number
 *                     totalMemory:
 *                       type: integer
 *                     freeMemory:
 *                       type: integer
 *                 performance:
 *                   type: object
 *                   properties:
 *                     avgResponseTime:
 *                       type: integer
 *                     totalRequests:
 *                       type: integer
 *                     errorRate:
 *                       type: integer
 *                     throughput:
 *                       type: integer
 *                 database:
 *                   type: object
 *                   properties:
 *                     avgExecutionTime:
 *                       type: integer
 *                     totalQueries:
 *                       type: integer
 *                     slowQueryRate:
 *                       type: integer
 *                 errors:
 *                   type: object
 *                   properties:
 *                     totalErrors:
 *                       type: integer
 *                     uniqueErrors:
 *                       type: integer
 *                 alerts:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       type:
 *                         type: string
 *                         enum: [error, warning, info]
 *                       message:
 *                         type: string
 *                       severity:
 *                         type: integer
 */

/**
 * @swagger
 * /monitoring/performance:
 *   get:
 *     summary: Get performance analytics
 *     description: Returns detailed performance metrics grouped by endpoint
 *     tags: [Monitoring]
 *     parameters:
 *       - in: query
 *         name: hours
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 168
 *           default: 24
 *         description: Number of hours of historical data to include
 *     responses:
 *       200:
 *         description: Performance analytics data
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   endpoint:
 *                     type: string
 *                   count:
 *                     type: integer
 *                   avgResponseTime:
 *                     type: integer
 *                   minResponseTime:
 *                     type: integer
 *                   maxResponseTime:
 *                     type: integer
 *                   errorCount:
 *                     type: integer
 *                   successRate:
 *                     type: integer
 */

/**
 * @swagger
 * /monitoring/database:
 *   get:
 *     summary: Get database performance analytics
 *     description: Returns detailed database query performance metrics
 *     tags: [Monitoring]
 *     parameters:
 *       - in: query
 *         name: hours
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 168
 *           default: 24
 *         description: Number of hours of historical data to include
 *     responses:
 *       200:
 *         description: Database analytics data
 */

/**
 * @swagger
 * /monitoring/health-score:
 *   get:
 *     summary: Get system health score
 *     description: Returns an overall health score (0-100) based on various system metrics
 *     tags: [Monitoring]
 *     responses:
 *       200:
 *         description: Health score
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 score:
 *                   type: integer
 *                   minimum: 0
 *                   maximum: 100
 *                 status:
 *                   type: string
 *                   enum: [critical, poor, fair, good, excellent]
 *                 factors:
 *                   type: object
 *                   properties:
 *                     memoryUsage:
 *                       type: string
 *                     cpuUsage:
 *                       type: string
 *                     loadAverage:
 *                       type: string
 *                     errorRate:
 *                       type: string
 */

/**
 * @swagger
 * /database/health:
 *   get:
 *     summary: Get database connection health
 *     description: Checks database connectivity and response time
 *     tags: [Database]
 *     responses:
 *       200:
 *         description: Database is healthy
 *       503:
 *         description: Database is unhealthy
 */
router.get('/database/health', async (req, res) => {
  try {
    const health = await DatabaseOptimizationService.getConnectionHealth()
    const statusCode = health.status === 'healthy' ? 200 : 503

    res.status(statusCode).json(health)
  } catch (error) {
    logger.error('Database health check failed:', error)
    res.status(503).json({
      status: 'error',
      error: 'Database health check failed',
      timestamp: new Date().toISOString(),
    })
  }
})

// Comprehensive monitoring dashboard
router.get('/monitoring/dashboard', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24
    const dashboard = MonitoringService.getMonitoringDashboard(hours)

    res.json({
      ...dashboard,
      timestamp: new Date().toISOString(),
      period: `${hours} hours`,
    })
  } catch (error) {
    logger.error('Monitoring dashboard error:', error)
    res.status(500).json({
      error: 'Failed to load monitoring dashboard',
      timestamp: new Date().toISOString(),
    })
  }
})

// Performance analytics
router.get('/monitoring/performance', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24
    const analytics = MonitoringService.getPerformanceAnalytics(hours)

    res.json({
      analytics,
      timestamp: new Date().toISOString(),
      period: `${hours} hours`,
    })
  } catch (error) {
    logger.error('Performance analytics error:', error)
    res.status(500).json({
      error: 'Failed to load performance analytics',
      timestamp: new Date().toISOString(),
    })
  }
})

// Database analytics
router.get('/monitoring/database', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24
    const analytics = MonitoringService.getDatabaseAnalytics(hours)

    res.json({
      analytics,
      timestamp: new Date().toISOString(),
      period: `${hours} hours`,
    })
  } catch (error) {
    logger.error('Database analytics error:', error)
    res.status(500).json({
      error: 'Failed to load database analytics',
      timestamp: new Date().toISOString(),
    })
  }
})

// Health score
router.get('/monitoring/health-score', async (req, res) => {
  try {
    const score = MonitoringService.getHealthScore()

    let status: string
    if (score >= 90) status = 'excellent'
    else if (score >= 80) status = 'good'
    else if (score >= 60) status = 'fair'
    else if (score >= 40) status = 'poor'
    else status = 'critical'

    const factors = {
      memoryUsage: score >= 80 ? 'Good' : score >= 60 ? 'High' : 'Critical',
      cpuUsage: score >= 80 ? 'Good' : score >= 60 ? 'High' : 'Critical',
      loadAverage: score >= 80 ? 'Good' : score >= 60 ? 'High' : 'Critical',
      errorRate: score >= 80 ? 'Good' : score >= 60 ? 'High' : 'Critical',
    }

    res.json({
      score,
      status,
      factors,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    logger.error('Health score error:', error)
    res.status(500).json({
      error: 'Failed to calculate health score',
      timestamp: new Date().toISOString(),
    })
  }
})

/**
 * @swagger
 * /database/stats:
 *   get:
 *     summary: Get database statistics
 *     description: Returns comprehensive database statistics
 *     tags: [Database]
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 */
router.get('/database/stats', async (req, res) => {
  try {
    const stats = await DatabaseOptimizationService.getDatabaseStats()
    res.json(stats)
  } catch (error) {
    logger.error('Database stats retrieval failed:', error)
    res.status(500).json({
      error: 'Failed to retrieve database statistics',
      timestamp: new Date().toISOString(),
    })
  }
})

/**
 * @swagger
 * /database/optimization:
 *   get:
 *     summary: Get database optimization suggestions
 *     description: Analyzes query patterns and suggests optimizations
 *     tags: [Database]
 *     responses:
 *       200:
 *         description: Optimization suggestions retrieved
 */
router.get('/database/optimization', async (req, res) => {
  try {
    const maintenance = await DatabaseOptimizationService.performMaintenance()
    res.json(maintenance)
  } catch (error) {
    logger.error('Database optimization check failed:', error)
    res.status(500).json({
      error: 'Failed to perform database optimization check',
      timestamp: new Date().toISOString(),
    })
  }
})

/**
 * @swagger
 * /database/index-suggestions:
 *   get:
 *     summary: Get database index optimization suggestions
 *     description: Analyzes query patterns and suggests index optimizations
 *     tags: [Database]
 *     responses:
 *       200:
 *         description: Index suggestions retrieved
 */
router.get('/database/index-suggestions', async (req, res) => {
  try {
    const suggestions = await DatabaseOptimizationService.suggestIndexOptimizations()
    res.json(suggestions)
  } catch (error) {
    logger.error('Index suggestions retrieval failed:', error)
    res.status(500).json({
      error: 'Failed to retrieve index suggestions',
      timestamp: new Date().toISOString(),
    })
  }
})

/**
 * @swagger
 * /database/query-metrics:
 *   get:
 *     summary: Get query performance metrics
 *     description: Returns database query performance metrics
 *     tags: [Database]
 *     parameters:
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [1h, 24h, 7d]
 *         description: Time range for metrics
 *     responses:
 *       200:
 *         description: Query metrics retrieved
 */
router.get('/database/query-metrics', async (req, res) => {
  try {
    const timeRange = (req.query.range as '1h' | '24h' | '7d') || '24h'
    const metrics = await DatabaseOptimizationService.getQueryMetrics(timeRange)
    res.json(metrics)
  } catch (error) {
    logger.error('Query metrics retrieval failed:', error)
    res.status(500).json({
      error: 'Failed to retrieve query metrics',
      timestamp: new Date().toISOString(),
    })
  }
})

/**
 * @swagger
 * /cache/stats:
 *   get:
 *     summary: Get cache statistics
 *     description: Returns comprehensive cache statistics and performance metrics
 *     tags: [Cache]
 *     responses:
 *       200:
 *         description: Cache statistics retrieved
 */
router.get('/cache/stats', async (req, res) => {
  try {
    const stats = await CacheService.getCacheStats()
    res.json(stats)
  } catch (error) {
    logger.error('Cache stats retrieval failed:', error)
    res.status(500).json({
      error: 'Failed to retrieve cache statistics',
      timestamp: new Date().toISOString(),
    })
  }
})

/**
 * @swagger
 * /cache/clear:
 *   post:
 *     summary: Clear all cache (Admin only)
 *     description: Clears all cached data. This endpoint should be used with caution.
 *     tags: [Cache]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cache cleared successfully
 *       500:
 *         description: Failed to clear cache
 */
router.post('/cache/clear', async (req, res) => {
  try {
    const success = await CacheService.clearAll()
    if (success) {
      res.json({
        message: 'Cache cleared successfully',
        timestamp: new Date().toISOString(),
      })
    } else {
      res.status(500).json({
        error: 'Failed to clear cache',
        timestamp: new Date().toISOString(),
      })
    }
  } catch (error) {
    logger.error('Cache clear operation failed:', error)
    res.status(500).json({
      error: 'Failed to clear cache',
      timestamp: new Date().toISOString(),
    })
  }
})

/**
 * @swagger
 * /cache/warmup:
 *   post:
 *     summary: Warm up cache with popular data
 *     description: Preloads frequently accessed data into cache
 *     tags: [Cache]
 *     responses:
 *       200:
 *         description: Cache warmup initiated
 */
router.post('/cache/warmup', async (req, res) => {
  try {
    await CacheService.warmupCache()
    res.json({
      message: 'Cache warmup initiated',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    logger.error('Cache warmup failed:', error)
    res.status(500).json({
      error: 'Failed to warm up cache',
      timestamp: new Date().toISOString(),
    })
  }
})

// Advanced monitoring dashboard (HTML)
router.get('/monitoring/dashboard/html', async (req, res) => {
  try {
    const dashboard = MonitoringService.getMonitoringDashboard(24)
    const healthScore = MonitoringService.getHealthScore()

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Videa Mozi - Advanced Monitoring Dashboard</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f7fa; color: #333; }
            .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; text-align: center; }
            .health-score { font-size: 48px; font-weight: bold; margin: 10px 0; }
            .status-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: bold; text-transform: uppercase; font-size: 12px; }
            .status-excellent { background: #4CAF50; color: white; }
            .status-good { background: #8BC34A; color: white; }
            .status-fair { background: #FFC107; color: black; }
            .status-poor { background: #FF9800; color: white; }
            .status-critical { background: #F44336; color: white; }

            .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px; }
            .metric-card { background: white; padding: 25px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .metric-title { font-size: 18px; font-weight: bold; margin-bottom: 15px; color: #667eea; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px; }
            .metric-value { font-size: 32px; font-weight: bold; color: #333; margin-bottom: 10px; }
            .metric-subtitle { font-size: 14px; color: #666; margin-bottom: 15px; }

            .alerts-section { margin-bottom: 30px; }
            .alert-item { padding: 15px; margin-bottom: 10px; border-radius: 8px; border-left: 4px solid; }
            .alert-error { background: #ffebee; border-left-color: #f44336; }
            .alert-warning { background: #fff3e0; border-left-color: #ff9800; }
            .alert-info { background: #e3f2fd; border-left-color: #2196f3; }

            .performance-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            .performance-table th, .performance-table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
            .performance-table th { background: #f8f9fa; font-weight: bold; }

            .refresh-btn { background: #667eea; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 14px; margin-top: 20px; }
            .refresh-btn:hover { background: #5a67d8; }

            .last-updated { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🚀 Videa Mozi Advanced Monitoring Dashboard</h1>
                <div class="health-score">${healthScore.score}/100</div>
                <span class="status-badge status-${healthScore.status}">${healthScore.status}</span>
            </div>

            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-title">📊 System Health</div>
                    <div class="metric-value">${Math.round((dashboard.systemHealth?.memoryUsage || 0) * 100)}%</div>
                    <div class="metric-subtitle">Memory Usage</div>
                    <div>CPU: ${(dashboard.systemHealth?.cpuUsage || 0).toFixed(2)}s</div>
                    <div>Uptime: ${Math.round((dashboard.systemHealth?.uptime || 0) / 3600)}h</div>
                    <div>Load Avg: ${(dashboard.systemHealth?.loadAverage || []).map(l => l.toFixed(2)).join(', ')}</div>
                </div>

                <div class="metric-card">
                    <div class="metric-title">⚡ Performance</div>
                    <div class="metric-value">${dashboard.performance?.avgResponseTime || 0}ms</div>
                    <div class="metric-subtitle">Avg Response Time</div>
                    <div>Total Requests: ${dashboard.performance?.totalRequests || 0}</div>
                    <div>Error Rate: ${dashboard.performance?.errorRate || 0}%</div>
                    <div>Throughput: ${dashboard.performance?.throughput || 0}/sec</div>
                </div>

                <div class="metric-card">
                    <div class="metric-title">🗄️ Database</div>
                    <div class="metric-value">${dashboard.database?.avgExecutionTime || 0}ms</div>
                    <div class="metric-subtitle">Avg Query Time</div>
                    <div>Total Queries: ${dashboard.database?.totalQueries || 0}</div>
                    <div>Slow Query Rate: ${dashboard.database?.slowQueryRate || 0}%</div>
                    <div>Active Connections: ${dashboard.database?.avgConnectionCount || 0}</div>
                </div>

                <div class="metric-card">
                    <div class="metric-title">🚨 Errors</div>
                    <div class="metric-value">${dashboard.errors?.totalErrors || 0}</div>
                    <div class="metric-subtitle">Total Errors (24h)</div>
                    <div>Unique Errors: ${dashboard.errors?.uniqueErrors || 0}</div>
                    <div>Most Common: ${dashboard.errors?.mostCommonError?.error || 'None'}</div>
                </div>
            </div>

            <div class="alerts-section">
                <h2>🚨 Active Alerts</h2>
                ${
                  (dashboard.alerts || [])
                    .map(
                      alert => `
                    <div class="alert-item alert-${alert.type}">
                        <strong>${alert.message}</strong>
                        <br><small>Severity: ${alert.severity}/10 | ${new Date(alert.timestamp).toLocaleString()}</small>
                    </div>
                `,
                    )
                    .join('') ||
                  '<div class="alert-item alert-info"><strong>✅ No active alerts</strong></div>'
                }
            </div>

            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-title">📈 Recent Requests</div>
                    <table class="performance-table">
                        <thead>
                            <tr>
                                <th>Endpoint</th>
                                <th>Response Time</th>
                                <th>Status</th>
                                <th>Success</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${
                              (dashboard.performance?.recentRequests || [])
                                .slice(0, 5)
                                .map(
                                  req => `
                                <tr>
                                    <td>${req.method} ${req.endpoint}</td>
                                    <td>${req.responseTime}ms</td>
                                    <td>${req.statusCode}</td>
                                    <td>${req.statusCode >= 400 ? '❌' : '✅'}</td>
                                </tr>
                            `,
                                )
                                .join('') || '<tr><td colspan="4">No recent requests</td></tr>'
                            }
                        </tbody>
                    </table>
                </div>

                <div class="metric-card">
                    <div class="metric-title">🐌 Slow Queries</div>
                    <table class="performance-table">
                        <thead>
                            <tr>
                                <th>Query Pattern</th>
                                <th>Execution Time</th>
                                <th>Connections</th>
                                <th>Type</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${
                              (dashboard.database?.recentQueries || [])
                                .slice(0, 5)
                                .map(
                                  query => `
                                <tr>
                                    <td>${query.query.substring(0, 50)}...</td>
                                    <td>${query.executionTime}ms</td>
                                    <td>${query.connectionCount}</td>
                                    <td>${query.slowQuery ? '🐌 Slow' : '⚡ Fast'}</td>
                                </tr>
                            `,
                                )
                                .join('') || '<tr><td colspan="4">No recent queries</td></tr>'
                            }
                        </tbody>
                    </table>
                </div>
            </div>

            <div style="text-align: center; margin-top: 30px;">
                <button class="refresh-btn" onclick="location.reload()">🔄 Refresh Dashboard</button>
                <br><br>
                <a href="/health/dashboard" style="color: #667eea; text-decoration: none;">📊 Basic Health Dashboard</a> |
                <a href="/api-docs" style="color: #667eea; text-decoration: none;">📚 API Documentation</a>
            </div>

            <div class="last-updated">
                Last updated: ${new Date().toLocaleString()} |
                Period: 24 hours |
                Health Score: ${healthScore.score}/100 (${healthScore.status})
            </div>
        </div>

        <script>
            // Auto-refresh every 30 seconds
            setTimeout(() => {
                if (confirm('Refresh dashboard for latest data?')) {
                    location.reload();
                }
            }, 30000);
        </script>
    </body>
    </html>`

    res.setHeader('Content-Type', 'text/html')
    res.send(html)
  } catch (error) {
    logger.error('Monitoring dashboard error:', error)
    res.status(500).send('<h1>Error loading monitoring dashboard</h1>')
  }
})

export default router
