import { Request, Response, NextFunction } from 'express'
import logger from '../config/logger.js'

/**
 * Global error handler middleware
 * Handles all errors that occur during request processing
 */
export const errorHandler = (err: any, req: Request, res: Response, _next: NextFunction): void => {
  // Log the error
  logger.error('Content Service Error:', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    timestamp: new Date().toISOString(),
  })

  // Handle different types of errors
  if (err.name === 'ValidationError') {
    // Request validation error
    res.status(400).json({
      error: 'Validation error',
      message: err.message,
      details: err.details || [],
    })
  } else if (err.name === 'PrismaClientKnownRequestError') {
    // Database constraint violation
    if (err.code === 'P2002') {
      res.status(409).json({
        error: 'Duplicate entry',
        message: 'A record with this information already exists.',
      })
    } else {
      res.status(400).json({
        error: 'Database error',
        message: 'A database operation failed.',
      })
    }
  } else if (err.name === 'PrismaClientValidationError') {
    // Database validation error
    res.status(400).json({
      error: 'Invalid data',
      message: 'The provided data does not meet validation requirements.',
    })
  } else if (
    err.name === 'PrismaClientInitializationError' ||
    err.name === 'PrismaClientRustPanicError'
  ) {
    // Database connection error
    res.status(503).json({
      error: 'Database unavailable',
      message: 'The database service is temporarily unavailable. Please try again later.',
    })
  } else if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    // External service error
    res.status(503).json({
      error: 'Service unavailable',
      message: 'An external service is temporarily unavailable. Please try again later.',
    })
  } else {
    // Generic server error
    const isDevelopment = process.env.NODE_ENV === 'development'
    res.status(500).json({
      error: 'Internal server error',
      message: isDevelopment ? err.message : 'Something went wrong. Please try again later.',
      ...(isDevelopment && { stack: err.stack }),
    })
  }
}

/**
 * 404 Not Found handler
 * Handles requests to non-existent endpoints
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  logger.warn('404 Not Found:', {
    url: req.originalUrl,
    method: req.method,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
  })

  res.status(404).json({
    error: 'Endpoint not found',
    message: `The requested path ${req.originalUrl} does not exist.`,
    availableEndpoints: {
      movies: '/api/v1/movies/*',
      series: '/api/v1/series/*',
      categories: '/api/v1/categories/*',
      health: '/health/*',
      docs: '/api-docs',
    },
  })
}

/**
 * Request timeout middleware
 * Sets a timeout for incoming requests
 */
export const requestTimeout = (timeoutMs: number = 30000) => {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        logger.warn('Request timeout:', {
          url: _req.originalUrl,
          method: _req.method,
          timeout: timeoutMs,
          userAgent: _req.get('User-Agent'),
          ip: _req.ip,
        })

        res.status(408).json({
          error: 'Request timeout',
          message: 'The request took too long to process.',
        })
      }
    }, timeoutMs)

    res.on('finish', () => {
      clearTimeout(timeout)
    })

    next()
  }
}

/**
 * Database error handler
 * Handles database-specific errors
 */
export const databaseErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (err.name === 'PrismaClientKnownRequestError') {
    if (err.code === 'P2025') {
      // Record not found
      res.status(404).json({
        error: 'Not found',
        message: 'The requested resource could not be found.',
      })
    } else if (err.code === 'P2003') {
      // Foreign key constraint failed
      res.status(400).json({
        error: 'Invalid reference',
        message: 'The referenced resource does not exist.',
      })
    } else {
      next(err)
    }
  } else {
    next(err)
  }
}
