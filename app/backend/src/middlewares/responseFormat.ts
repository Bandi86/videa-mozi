import { Request, Response, NextFunction } from 'express'

// Standard response format interface
interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: any
  }
  meta?: {
    timestamp: string
    requestId?: string
    pagination?: {
      page: number
      limit: number
      total: number
      pages: number
    }
  }
}

// Extend Express Response interface
declare global {
  namespace Express {
    interface Response {
      success<T>(data: T, meta?: ApiResponse['meta']): Response
      error(code: string, message: string, statusCode?: number, details?: any): Response
      paginate<T>(data: T, page: number, limit: number, total: number): Response
    }
  }
}

// Success response helper
export const successResponse = <T>(
  res: Response,
  data: T,
  meta?: ApiResponse['meta'],
): Response => {
  const response: ApiResponse<T> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  }

  return res.json(response)
}

// Error response helper
export const errorResponse = (
  res: Response,
  code: string,
  message: string,
  statusCode: number = 400,
  details?: any,
): Response => {
  const response: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      details,
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  }

  return res.status(statusCode).json(response)
}

// Pagination response helper
export const paginationResponse = <T>(
  res: Response,
  data: T,
  page: number,
  limit: number,
  total: number,
): Response => {
  const pages = Math.ceil(total / limit)

  return successResponse(res, data, {
    timestamp: new Date().toISOString(),
    pagination: {
      page,
      limit,
      total,
      pages,
    },
  })
}

// Extend Express Response prototype
export const extendResponse = (req: Request, res: Response, next: NextFunction): void => {
  // Add success method
  res.success = function <T>(data: T, meta?: ApiResponse['meta']) {
    return successResponse(this, data, meta)
  }

  // Add error method
  res.error = function (code: string, message: string, statusCode: number = 400, details?: any) {
    return errorResponse(this, code, message, statusCode, details)
  }

  // Add paginate method
  res.paginate = function <T>(data: T, page: number, limit: number, total: number) {
    return paginationResponse(this, data, page, limit, total)
  }

  next()
}

// Response formatting middleware
export const responseFormat = (req: Request, res: Response, next: NextFunction): void => {
  // Set common response headers
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('X-API-Version', '1.0.0')

  // Add request ID if available (from correlation middleware)
  if ((req as any).correlationId) {
    res.setHeader('X-Request-ID', (req as any).correlationId)
  }

  next()
}

// Legacy compatibility - wrap existing JSON responses
export const wrapLegacyResponses = (req: Request, res: Response, next: NextFunction): void => {
  const originalJson = res.json

  res.json = function (body: any) {
    // If the response is already in our standard format, return as is
    if (body && typeof body === 'object' && ('success' in body || 'error' in body)) {
      return originalJson.call(this, body)
    }

    // If response has an error structure, convert to our format
    if (body && typeof body === 'object' && ('error' in body || 'message' in body)) {
      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: body.error || 'UNKNOWN_ERROR',
          message: body.message || 'An error occurred',
          details: body.details,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req as any).correlationId,
        },
      }
      return originalJson.call(this, errorResponse)
    }

    // For successful responses, wrap in success format
    if (res.statusCode < 400) {
      const successResponse: ApiResponse = {
        success: true,
        data: body,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req as any).correlationId,
        },
      }
      return originalJson.call(this, successResponse)
    }

    // For error responses, return as is (already handled by error middleware)
    return originalJson.call(this, body)
  }

  next()
}
