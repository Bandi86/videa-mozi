import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'

// Content type validation
export const validateContentType = (allowedTypes: string[] = ['application/json']) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentType = req.headers['content-type']?.split(';')[0]

    if (!contentType || !allowedTypes.includes(contentType)) {
      res.status(415).json({
        error: 'Unsupported media type',
        message: `Content-Type must be one of: ${allowedTypes.join(', ')}`,
        received: contentType || 'none',
      })
      return
    }

    next()
  }
}

// Request body size validation
export const validateRequestSize = (maxSize: string = '10mb') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.headers['content-length'] || '0')
    const maxSizeBytes = parseSize(maxSize)

    if (contentLength > maxSizeBytes) {
      res.status(413).json({
        error: 'Request too large',
        message: `Request body exceeds maximum allowed size of ${maxSize}`,
        maxSize,
        received: formatBytes(contentLength),
      })
      return
    }

    next()
  }
}

// Parse size string to bytes
const parseSize = (size: string): number => {
  const units: { [key: string]: number } = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
  }

  const match = size.toLowerCase().match(/^(\d+)([a-z]+)$/)
  if (!match) return 10 * 1024 * 1024 // Default 10MB

  const value = parseInt(match[1])
  const unit = match[2]

  return value * (units[unit] || 1)
}

// Format bytes to human readable
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Schema validation middleware
export const validateSchema = (
  schema: z.ZodSchema,
  property: 'body' | 'query' | 'params' = 'body',
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = req[property]
      const validatedData = schema.parse(data)

      // Replace the original data with validated data
      ;(req as any)[property] = validatedData

      next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation error',
          message: 'Request data does not match expected schema',
          details: (error as any).errors.map((err: any) => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
          })),
        })
        return
      }

      next(error)
    }
  }
}

// Required fields validation
export const validateRequired = (
  fields: string[],
  property: 'body' | 'query' | 'params' = 'body',
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const data = req[property] as any
    const missingFields: string[] = []

    fields.forEach(field => {
      if (
        !data ||
        !(field in data) ||
        data[field] === undefined ||
        data[field] === null ||
        data[field] === ''
      ) {
        missingFields.push(field)
      }
    })

    if (missingFields.length > 0) {
      res.status(400).json({
        error: 'Missing required fields',
        message: `The following fields are required: ${missingFields.join(', ')}`,
        missingFields,
      })
      return
    }

    next()
  }
}

// Email validation
export const validateEmail = (
  field: string = 'email',
  property: 'body' | 'query' | 'params' = 'body',
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const data = req[property] as any
    const email = data?.[field]

    if (!email) {
      next()
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      res.status(400).json({
        error: 'Invalid email format',
        message: `Field '${field}' must be a valid email address`,
        field,
        received: email,
      })
      return
    }

    next()
  }
}

// Password strength validation
export const validatePassword = (
  field: string = 'password',
  property: 'body' | 'query' | 'params' = 'body',
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const data = req[property] as any
    const password = data?.[field]

    if (!password) {
      next()
      return
    }

    const errors: string[] = []

    if (password.length < 8) {
      errors.push('at least 8 characters long')
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('at least one uppercase letter')
    }

    if (!/[a-z]/.test(password)) {
      errors.push('at least one lowercase letter')
    }

    if (!/\d/.test(password)) {
      errors.push('at least one number')
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('at least one special character')
    }

    if (errors.length > 0) {
      res.status(400).json({
        error: 'Password too weak',
        message: `Password must contain: ${errors.join(', ')}`,
        field,
        requirements: [
          'At least 8 characters long',
          'At least one uppercase letter',
          'At least one lowercase letter',
          'At least one number',
          'At least one special character',
        ],
      })
      return
    }

    next()
  }
}

// URL validation
export const validateUrl = (field: string, property: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const data = req[property] as any
    const url = data?.[field]

    if (!url) {
      next()
      return
    }

    try {
      new URL(url)
      next()
    } catch {
      res.status(400).json({
        error: 'Invalid URL format',
        message: `Field '${field}' must be a valid URL`,
        field,
        received: url,
      })
    }
  }
}

// UUID validation
export const validateUUID = (field: string, property: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const data = req[property] as any
    const uuid = data?.[field]

    if (!uuid) {
      next()
      return
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

    if (!uuidRegex.test(uuid)) {
      res.status(400).json({
        error: 'Invalid UUID format',
        message: `Field '${field}' must be a valid UUID`,
        field,
        received: uuid,
      })
      return
    }

    next()
  }
}

// Date validation
export const validateDate = (field: string, property: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const data = req[property] as any
    const dateString = data?.[field]

    if (!dateString) {
      next()
      return
    }

    const date = new Date(dateString)
    if (isNaN(date.getTime())) {
      res.status(400).json({
        error: 'Invalid date format',
        message: `Field '${field}' must be a valid ISO date string`,
        field,
        received: dateString,
      })
      return
    }

    next()
  }
}

// Export alias for backward compatibility with social features routes
export const validationMiddleware = validateSchema
