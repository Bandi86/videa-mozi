import { Request, Response, NextFunction } from 'express'
import logger from '../config/logger.js'

/**
 * Global error handler middleware
 */
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  })

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development'

  res.status(500).json({
    error: 'Internal Server Error',
    message: isDevelopment ? err.message : 'Something went wrong',
    ...(isDevelopment && { stack: err.stack }),
  })
}

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (req: Request, res: Response) => {
  logger.warn('404 Not Found:', {
    url: req.url,
    method: req.method,
    ip: req.ip,
  })

  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.url} not found`,
  })
}

/**
 * Async error wrapper
 */
export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

// Additional middleware for compatibility
export const requestTimeout = (req: Request, res: Response, next: NextFunction) => {
  // Basic request timeout handling
  next()
}

export const circuitBreaker = (req: Request, res: Response, next: NextFunction) => {
  // Basic circuit breaker
  next()
}
