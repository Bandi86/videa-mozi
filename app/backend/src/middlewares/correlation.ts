import { Request, Response, NextFunction } from 'express'
import { v4 as uuidv4 } from 'uuid'

// Extend Express Request interface to include correlation ID
declare global {
  namespace Express {
    interface Request {
      correlationId: string
    }
  }
}

// Generate correlation ID middleware
export const correlationId = (req: Request, res: Response, next: NextFunction): void => {
  // Check if correlation ID is already provided in headers
  const existingId = req.headers['x-correlation-id'] as string

  if (existingId && existingId.length > 0) {
    req.correlationId = existingId
  } else {
    // Generate new correlation ID
    req.correlationId = uuidv4()
  }

  // Add correlation ID to response headers
  res.setHeader('x-correlation-id', req.correlationId)

  next()
}

// Get correlation ID helper function
export const getCorrelationId = (req: Request): string => {
  return req.correlationId || 'unknown'
}
