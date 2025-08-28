import { Request, Response, NextFunction } from 'express'
import logger from '../config/logger.js'

/**
 * Request logging middleware
 */
export const requestLogging = (req: Request, res: Response, next: NextFunction) => {
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
    return originalEnd.call(this, chunk, encoding || undefined)
  }

  next()
}

// Additional logging middleware for compatibility
export const securityLogging = (req: Request, res: Response, next: NextFunction) => {
  // Basic security logging
  next()
}

export const trafficAnalysis = (req: Request, res: Response, next: NextFunction) => {
  // Basic traffic analysis
  next()
}
