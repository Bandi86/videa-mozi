import { Request, Response, NextFunction } from 'express'
import logger, { logContentEvent } from '../config/logger.js'

/**
 * Request logging middleware
 * Logs all incoming requests with performance metrics
 */
export const requestLogging = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now()
  const timestamp = new Date().toISOString()

  // Log request
  logger.info('Content Service Request:', {
    timestamp,
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    headers: {
      'content-type': req.get('Content-Type'),
      authorization: req.get('Authorization') ? '[PRESENT]' : '[NOT PRESENT]',
    },
    query: req.query,
    params: req.params,
    bodySize: req.get('Content-Length'),
  })

  // Log response
  res.on('finish', () => {
    const endTime = Date.now()
    const responseTime = endTime - startTime
    const timestamp = new Date().toISOString()

    logger.info('Content Service Response:', {
      timestamp,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      ip: req.ip,
      contentLength: res.get('Content-Length'),
      // Flag slow requests
      performance: responseTime > 1000 ? 'SLOW' : responseTime > 500 ? 'FAIR' : 'GOOD',
    })

    // Alert on very slow requests
    if (responseTime > 5000) {
      logger.error('VERY SLOW REQUEST:', {
        method: req.method,
        url: req.originalUrl,
        responseTime: `${responseTime}ms`,
        statusCode: res.statusCode,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      })
    }
  })

  // Log errors
  res.on('error', error => {
    logger.error('Response Error:', {
      error: error.message,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      stack: error.stack,
    })
  })

  next()
}

/**
 * Content operation logging middleware
 * Logs content-related operations
 */
export const contentOperationLogging = (req: Request, res: Response, next: NextFunction): void => {
  const timestamp = new Date().toISOString()

  // Log movie operations
  if (req.originalUrl.includes('/movies')) {
    if (req.method === 'POST') {
      logContentEvent('MOVIE_CREATION_ATTEMPT', 'movie', 'new', {
        timestamp,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      })
    } else if (req.method === 'PUT') {
      logContentEvent('MOVIE_UPDATE_ATTEMPT', 'movie', req.params.id || 'unknown', {
        timestamp,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      })
    } else if (req.method === 'DELETE') {
      logContentEvent('MOVIE_DELETION_ATTEMPT', 'movie', req.params.id || 'unknown', {
        timestamp,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      })
    }
  }

  // Log series operations
  if (req.originalUrl.includes('/series')) {
    if (req.method === 'POST') {
      logContentEvent('SERIES_CREATION_ATTEMPT', 'series', 'new', {
        timestamp,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      })
    } else if (req.method === 'PUT') {
      logContentEvent('SERIES_UPDATE_ATTEMPT', 'series', req.params.id || 'unknown', {
        timestamp,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      })
    } else if (req.method === 'DELETE') {
      logContentEvent('SERIES_DELETION_ATTEMPT', 'series', req.params.id || 'unknown', {
        timestamp,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      })
    }
  }

  // Log category operations
  if (req.originalUrl.includes('/categories')) {
    if (req.method === 'POST') {
      logContentEvent('CATEGORY_CREATION_ATTEMPT', 'category', 'new', {
        timestamp,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      })
    } else if (req.method === 'PUT') {
      logContentEvent('CATEGORY_UPDATE_ATTEMPT', 'category', req.params.id || 'unknown', {
        timestamp,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      })
    } else if (req.method === 'DELETE') {
      logContentEvent('CATEGORY_DELETION_ATTEMPT', 'category', req.params.id || 'unknown', {
        timestamp,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      })
    }
  }

  next()
}

/**
 * Security event logging middleware
 * Logs security-related events and suspicious activities
 */
export const securityLogging = (req: Request, _res: Response, next: NextFunction): void => {
  const ip = req.ip || req.connection.remoteAddress
  const userAgent = req.get('User-Agent') || 'unknown'
  const timestamp = new Date().toISOString()

  // Log failed operations
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
    // This will be enhanced when we have proper error handling
    logger.info('CONTENT_OPERATION_ATTEMPT:', {
      timestamp,
      method: req.method,
      url: req.originalUrl,
      ip,
      userAgent,
    })
  }

  // Log suspicious patterns
  const suspiciousPatterns = [
    /\.\./, // Directory traversal
    /<script/i, // XSS attempts
    /union.*select/i, // SQL injection
    /javascript:/i, // JavaScript injection
    /eval\(/i, // Code injection
    /base64/i, // Potential encoded attacks
  ]

  const requestData = `${req.originalUrl} ${JSON.stringify(req.body)} ${JSON.stringify(req.query)}`

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(requestData)) {
      logger.warn('SUSPICIOUS_REQUEST_DETECTED:', {
        timestamp,
        ip,
        userAgent,
        method: req.method,
        url: req.originalUrl,
        pattern: pattern.toString(),
        severity: 'high',
      })
      break
    }
  }

  next()
}

/**
 * Performance monitoring middleware
 * Tracks response times and performance metrics
 */
export const performanceMonitoring = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = performance.now()
  const startMemory = process.memoryUsage()

  res.on('finish', () => {
    const endTime = performance.now()
    const endMemory = process.memoryUsage()

    const responseTime = endTime - startTime
    const memoryDelta = {
      rss: endMemory.rss - startMemory.rss,
      heapUsed: endMemory.heapUsed - startMemory.heapUsed,
      heapTotal: endMemory.heapTotal - startMemory.heapTotal,
      external: endMemory.external - startMemory.external,
    }

    // Log performance metrics for slow requests
    if (responseTime > 1000) {
      logger.warn('PERFORMANCE_METRICS:', {
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.originalUrl,
        responseTime: `${responseTime.toFixed(2)}ms`,
        statusCode: res.statusCode,
        memoryDelta,
        ip: req.ip,
        performance: responseTime > 5000 ? 'CRITICAL' : responseTime > 2000 ? 'POOR' : 'SLOW',
      })
    }

    // Add performance headers
    res.setHeader('X-Response-Time', `${responseTime.toFixed(2)}ms`)
    res.setHeader('X-Server-Time', new Date().toISOString())
    res.setHeader('X-Powered-By', 'Videa-Mozi-Content-Service')
  })

  next()
}
