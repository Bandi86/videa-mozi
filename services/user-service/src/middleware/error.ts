import { Request, Response, NextFunction } from 'express'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'
import logger, { logSecurityEvent } from '../config/logger.js'

interface CustomError extends Error {
  status?: number
  code?: string
  details?: any
}

export const errorHandler = (
  err: CustomError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  let status = err.status || 500
  let message = err.message || 'Internal server error'
  let code = err.code || 'INTERNAL_ERROR'
  let details = err.details

  // Handle Prisma errors
  if (err instanceof PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        status = 409
        message = 'A record with this information already exists'
        code = 'DUPLICATE_RECORD'
        break
      case 'P2025':
        status = 404
        message = 'Record not found'
        code = 'NOT_FOUND'
        break
      case 'P2003':
        status = 400
        message = 'Invalid reference - related record does not exist'
        code = 'FOREIGN_KEY_ERROR'
        break
      default:
        status = 500
        message = 'Database operation failed'
        code = 'DATABASE_ERROR'
    }
  }

  // Handle validation errors
  if (err.name === 'ValidationError') {
    status = 400
    code = 'VALIDATION_ERROR'
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    status = 401
    message = 'Invalid token'
    code = 'INVALID_TOKEN'
  }

  if (err.name === 'TokenExpiredError') {
    status = 401
    message = 'Token expired'
    code = 'TOKEN_EXPIRED'
  }

  // Handle rate limit errors
  if (err.message?.includes('Too many requests')) {
    status = 429
    code = 'RATE_LIMIT_EXCEEDED'
  }

  // Log security events for authentication errors
  if (status === 401 || status === 403) {
    logSecurityEvent('authentication_failed', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method,
      error: message,
    })
  }

  // Log error with context
  const errorContext = {
    message: err.message,
    stack: err.stack,
    status,
    code,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: (req as any).user?.id,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
  }

  if (status >= 500) {
    logger.error('Server Error:', errorContext)
  } else if (status >= 400) {
    logger.warn('Client Error:', errorContext)
  }

  // Don't expose internal errors in production
  const isDevelopment = process.env.NODE_ENV === 'development'

  const response = {
    error: {
      message,
      code,
      status,
      ...(details && { details }),
      ...(isDevelopment && { stack: err.stack }),
    },
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
  }

  res.status(status).json(response)
}

export const handlePrismaError = (err: PrismaClientKnownRequestError): CustomError => {
  const error = new Error() as CustomError

  switch (err.code) {
    case 'P2002':
      error.message = 'Unique constraint violation'
      error.status = 409
      error.code = 'UNIQUE_CONSTRAINT'
      break
    case 'P2025':
      error.message = 'Record not found'
      error.status = 404
      error.code = 'NOT_FOUND'
      break
    case 'P2003':
      error.message = 'Foreign key constraint failed'
      error.status = 400
      error.code = 'FOREIGN_KEY_ERROR'
      break
    case 'P2014':
      error.message = 'Invalid data provided'
      error.status = 400
      error.code = 'INVALID_DATA'
      break
    default:
      error.message = 'Database operation failed'
      error.status = 500
      error.code = 'DATABASE_ERROR'
  }

  return error
}

export const circuitBreaker = async (
  operation: () => Promise<any>,
  options: {
    timeout?: number
    retries?: number
    failureThreshold?: number
    recoveryTimeout?: number
  } = {},
): Promise<any> => {
  const { timeout = 5000, retries = 3, failureThreshold = 5, recoveryTimeout = 60000 } = options

  let failures = 0
  let lastFailureTime = 0

  const executeOperation = async (attempt: number = 1): Promise<any> => {
    // Check if circuit breaker is open
    const now = Date.now()
    if (failures >= failureThreshold) {
      if (now - lastFailureTime < recoveryTimeout) {
        throw new Error('Circuit breaker is open')
      }
      // Half-open state - allow one request
      failures = Math.floor(failureThreshold / 2)
    }

    try {
      // Add timeout to the operation
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Operation timeout')), timeout)
      })

      const result = await Promise.race([operation(), timeoutPromise])

      // Success - reset failure count
      failures = 0
      return result
    } catch (error: any) {
      failures++
      lastFailureTime = now

      if (attempt < retries) {
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
        await new Promise(resolve => setTimeout(resolve, delay))
        return executeOperation(attempt + 1)
      }

      throw error
    }
  }

  return executeOperation()
}

export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

export const requestTimeout = (req: Request, res: Response, next: NextFunction) => {
  // Set timeout for request processing
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(408).json({
        error: 'Request timeout',
        message: 'The request took too long to process',
        timestamp: new Date().toISOString(),
      })
    }
  }, 30000) // 30 second timeout

  res.on('finish', () => {
    clearTimeout(timeout)
  })

  next()
}

export default errorHandler
