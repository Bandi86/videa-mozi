import { Request, Response, NextFunction } from 'express'
import logger, { logRequest } from '../config/logger.js'

// HTTP request logging middleware
export const httpLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now()

  // Log the incoming request
  logger.http('Request received', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: (req as any).user?.id || 'anonymous',
    headers: {
      'content-type': req.get('Content-Type'),
      authorization: req.get('Authorization') ? '[PRESENT]' : '[NOT PRESENT]',
    },
  })

  // Override res.end to log response details
  const originalEnd = res.end
  res.end = function (chunk?: any, encoding?: BufferEncoding | (() => void)) {
    const duration = Date.now() - start

    // Log the response
    logRequest(req, res, duration)

    // Call original end method
    if (typeof encoding === 'function') {
      return originalEnd.call(this, chunk, encoding as any)
    } else {
      return originalEnd.call(this, chunk, encoding as BufferEncoding)
    }
  }

  next()
}

// Request body logging middleware (for debugging - use carefully in production)
export const requestBodyLogger = (req: Request, res: Response, next: NextFunction): void => {
  if (process.env.LOG_REQUEST_BODY === 'true' && req.body) {
    logger.debug('Request body', {
      method: req.method,
      url: req.url,
      body:
        JSON.stringify(req.body).substring(0, 500) +
        (JSON.stringify(req.body).length > 500 ? '...' : ''),
    })
  }
  next()
}

// Response body logging middleware (for debugging - use carefully in production)
export const responseBodyLogger = (req: Request, res: Response, next: NextFunction): void => {
  if (process.env.LOG_RESPONSE_BODY === 'true') {
    const originalJson = res.json
    res.json = function (body: any) {
      logger.debug('Response body', {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        body:
          JSON.stringify(body).substring(0, 500) + (JSON.stringify(body).length > 500 ? '...' : ''),
      })
      return originalJson.call(this, body)
    }
  }
  next()
}

// Error logging middleware
export const errorLogger = (err: Error, req: Request, res: Response, next: NextFunction): void => {
  logger.error('Unhandled error occurred', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userId: (req as any).user?.id || 'anonymous',
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
  })
  next(err)
}

// Performance monitoring middleware
export const performanceLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = process.hrtime.bigint()

  res.on('finish', () => {
    const end = process.hrtime.bigint()
    const duration = Number(end - start) / 1_000_000 // Convert to milliseconds

    if (duration > 1000) {
      // Log slow requests (> 1 second)
      logger.warn('Slow request detected', {
        method: req.method,
        url: req.url,
        duration: `${duration.toFixed(2)}ms`,
        statusCode: res.statusCode,
        ip: req.ip,
        userId: (req as any).user?.id || 'anonymous',
      })
    }
  })

  next()
}
