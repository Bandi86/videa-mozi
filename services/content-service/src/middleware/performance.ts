import { Request, Response, NextFunction } from 'express'
import logger from '../config/logger.js'

/**
 * Performance monitoring middleware
 * Tracks request duration and performance metrics
 */
export const performanceMonitoring = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now()
  const timestamp = new Date().toISOString()

  // Log request start
  logger.info('REQUEST_START', {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    timestamp,
  })

  // Override res.end to capture response time
  const originalEnd = res.end
  res.end = function (chunk?: any, encoding?: BufferEncoding | (() => void)) {
    const duration = Date.now() - start

    // Log request completion
    logger.info('REQUEST_COMPLETE', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      performance: duration < 100 ? 'GOOD' : duration < 500 ? 'OK' : 'SLOW',
    })

    // Call original end method
    return originalEnd.call(this, chunk, typeof encoding === 'string' ? encoding : undefined)
  }

  next()
}

/**
 * Response time header middleware
 * Adds X-Response-Time header to all responses
 */
export const responseTimeMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now()

  res.on('finish', () => {
    const duration = Date.now() - start
    res.setHeader('X-Response-Time', `${duration}ms`)
  })

  next()
}

/**
 * Request size limit middleware
 * Monitors request payload size
 */
export const requestSizeMonitor = (req: Request, res: Response, next: NextFunction) => {
  let data = ''

  req.on('data', chunk => {
    data += chunk
  })

  req.on('end', () => {
    if (data.length > 1024 * 1024) {
      // 1MB
      logger.warn('LARGE_REQUEST', {
        method: req.method,
        url: req.url,
        size: `${(data.length / 1024 / 1024).toFixed(2)}MB`,
        ip: req.ip,
      })
    }
  })

  next()
}

/**
 * Memory usage monitoring middleware
 * Logs memory usage for long-running requests
 */
export const memoryMonitor = (req: Request, res: Response, next: NextFunction) => {
  const startMemory = process.memoryUsage()
  const startTime = Date.now()

  res.on('finish', () => {
    const duration = Date.now() - startTime

    // Only log for requests taking longer than 1 second
    if (duration > 1000) {
      const endMemory = process.memoryUsage()
      const memoryDiff = {
        rss: endMemory.rss - startMemory.rss,
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal,
      }

      logger.info('MEMORY_USAGE', {
        method: req.method,
        url: req.url,
        duration: `${duration}ms`,
        memoryDiff,
      })
    }
  })

  next()
}
