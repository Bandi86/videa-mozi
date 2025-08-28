import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { body } from 'express-validator'
import logger, { logSecurityEvent } from '../config/logger.js'
import prisma from '../config/database.js'
import { UserRole, UserStatus } from '@prisma/client'

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

export const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['X-Total-Count', 'X-Rate-Limit-Remaining'],
}

export const securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // Remove X-Powered-By header
  res.removeHeader('X-Powered-By')

  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')

  // HSTS (HTTP Strict Transport Security) - only in production
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }

  next()
}

export const rateLimit = (
  options: {
    windowMs?: number
    max?: number
    skipSuccessfulRequests?: boolean
    skipFailedRequests?: boolean
  } = {},
) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
  } = options

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip
    const now = Date.now()

    // Get or create rate limit data
    let rateLimitData = rateLimitStore.get(key)
    if (!rateLimitData || now > rateLimitData.resetTime) {
      rateLimitData = {
        count: 0,
        resetTime: now + windowMs,
      }
    }

    // Increment count
    rateLimitData.count++
    rateLimitStore.set(key, rateLimitData)

    // Check if limit exceeded
    const remaining = Math.max(0, max - rateLimitData.count)

    // Set headers
    res.setHeader('X-Rate-Limit-Limit', max.toString())
    res.setHeader('X-Rate-Limit-Remaining', remaining.toString())
    res.setHeader('X-Rate-Limit-Reset', new Date(rateLimitData.resetTime).toISOString())

    if (rateLimitData.count > max) {
      logSecurityEvent('rate_limit_exceeded', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        userAgent: req.get('user-agent'),
        count: rateLimitData.count,
        limit: max,
      })

      res.status(429).json({
        error: 'Too many requests',
        message: `Rate limit exceeded. Try again after ${Math.ceil((rateLimitData.resetTime - now) / 1000)} seconds.`,
        retryAfter: Math.ceil((rateLimitData.resetTime - now) / 1000),
        timestamp: new Date().toISOString(),
      })
      return
    }

    // Reset count for successful requests if enabled
    if (skipSuccessfulRequests) {
      res.on('finish', () => {
        if (res.statusCode < 400) {
          rateLimitData!.count--
          rateLimitStore.set(key, rateLimitData!)
        }
      })
    }

    next()
  }
}

// Auth-specific rate limiter (more restrictive)
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes
})

// API rate limiter (less restrictive)
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
})

// Content rate limiter (for content creation)
export const contentRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 content creations per hour
})

export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  // Basic input sanitization
  const sanitize = (obj: any): any => {
    if (typeof obj === 'string') {
      // Remove potential script tags and other dangerous content
      return obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .trim()
    } else if (Array.isArray(obj)) {
      return obj.map(sanitize)
    } else if (obj && typeof obj === 'object') {
      const sanitized: any = {}
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitize(value)
      }
      return sanitized
    }
    return obj
  }

  if (req.body) {
    req.body = sanitize(req.body)
  }
  if (req.query) {
    req.query = sanitize(req.query)
  }
  if (req.params) {
    req.params = sanitize(req.params)
  }

  next()
}

export const validateAuthToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'No token provided',
      })
      return
    }

    const token = authHeader.substring(7)

    // Verify JWT token
    const jwtSecret = process.env.JWT_ACCESS_SECRET || 'default-secret-key'
    const decoded = jwt.verify(token, jwtSecret) as any

    // Check if session exists and is active
    const session = await prisma.authSession.findFirst({
      where: {
        accessToken: token,
        userId: decoded.id,
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            role: true,
            status: true,
            isEmailVerified: true,
          },
        },
      },
    })

    if (!session || !session.user) {
      res.status(401).json({
        error: 'Invalid token',
        message: 'Token not found or inactive',
      })
      return
    }

    // Check if user is active
    if (session.user.status !== UserStatus.ACTIVE) {
      res.status(403).json({
        error: 'Account suspended',
        message: 'Your account is not active',
      })
      return
    }

    // Attach user and session to request
    ;(req as any).user = session.user
    ;(req as any).session = session

    // Update session last used
    await prisma.authSession.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() },
    })

    next()
  } catch (error: any) {
    logger.error('Token validation error:', error)

    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({
        error: 'Invalid token',
        message: 'Token is malformed or invalid',
      })
      return
    }

    if (error.name === 'TokenExpiredError') {
      res.status(401).json({
        error: 'Token expired',
        message: 'Access token has expired',
      })
      return
    }

    res.status(500).json({
      error: 'Authentication error',
      message: 'Failed to authenticate request',
    })
  }
}

export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No token provided, continue without authentication
    next()
    return
  }

  // If token is provided, validate it but don't fail if invalid
  try {
    const token = authHeader.substring(7)
    const jwtSecret = process.env.JWT_ACCESS_SECRET || 'default-secret-key'
    const decoded = jwt.verify(token, jwtSecret) as any

    const session = await prisma.authSession.findFirst({
      where: {
        accessToken: token,
        userId: decoded.id,
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            role: true,
            status: true,
            isEmailVerified: true,
          },
        },
      },
    })

    if (session?.user && session.user.status === UserStatus.ACTIVE) {
      ;(req as any).user = session.user
      ;(req as any).session = session
    }
  } catch (error) {
    // Ignore authentication errors for optional auth
    logger.debug('Optional auth failed:', error)
  }

  next()
}

export const requireRole = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user

    if (!user) {
      res.status(401).json({
        error: 'Authentication required',
      })
      return
    }

    if (!allowedRoles.includes(user.role)) {
      logSecurityEvent('insufficient_permissions', {
        userId: user.id,
        requiredRoles: allowedRoles,
        userRole: user.role,
        path: req.path,
        method: req.method,
      })

      res.status(403).json({
        error: 'Insufficient permissions',
        message: `Required roles: ${allowedRoles.join(', ')}`,
      })
      return
    }

    next()
  }
}

export const requireOwnership = (resourceUserIdParam: string = 'id') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user
    const resourceUserId = req.params[resourceUserIdParam]

    if (!user) {
      res.status(401).json({
        error: 'Authentication required',
      })
      return
    }

    // Allow admins to access any resource
    if (user.role === UserRole.ADMIN) {
      next()
      return
    }

    // Check if user owns the resource
    if (user.id !== resourceUserId) {
      logSecurityEvent('ownership_violation', {
        userId: user.id,
        resourceUserId,
        path: req.path,
        method: req.method,
      })

      res.status(403).json({
        error: 'Access denied',
        message: 'You do not have permission to access this resource',
      })
      return
    }

    next()
  }
}

export const validateRequest = (validations: any[]) => {
  return [
    ...validations,
    (req: Request, res: Response, next: NextFunction): void => {
      const errors = (req as any).validationErrors || []
      if (errors.length > 0) {
        res.status(400).json({
          error: 'Validation failed',
          details: errors,
        })
        return
      }
      next()
    },
  ]
}

export const csrfProtection = (req: Request, res: Response, next: NextFunction): void => {
  // Basic CSRF protection for state-changing operations
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const csrfToken = req.headers['x-csrf-token'] || req.body._csrf
    const sessionToken = (req as any).session?.csrfToken

    if (!csrfToken || !sessionToken || csrfToken !== sessionToken) {
      logSecurityEvent('csrf_violation', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        userAgent: req.get('user-agent'),
      })

      res.status(403).json({
        error: 'CSRF validation failed',
        message: 'Invalid CSRF token',
      })
      return
    }
  }

  next()
}

export const sqlInjectionProtection = (req: Request, res: Response, next: NextFunction): void => {
  // Basic SQL injection detection
  const checkForSqlInjection = (value: any): boolean => {
    if (typeof value === 'string') {
      const sqlPatterns = [
        /(\bUNION\b|\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b|\bCREATE\b|\bALTER\b)/i,
        /('|(\\x27)|(\\x2D\\x2D)|(\\\\)|(\\%27)|(\\%2D\\%2D))/i,
        /(<script|javascript:|on\w+=)/i,
      ]

      return sqlPatterns.some(pattern => pattern.test(value))
    }
    return false
  }

  const hasSuspiciousContent = (obj: any): boolean => {
    if (typeof obj === 'string') {
      return checkForSqlInjection(obj)
    } else if (Array.isArray(obj)) {
      return obj.some(hasSuspiciousContent)
    } else if (obj && typeof obj === 'object') {
      return Object.values(obj).some(hasSuspiciousContent)
    }
    return false
  }

  if (
    hasSuspiciousContent(req.body) ||
    hasSuspiciousContent(req.query) ||
    hasSuspiciousContent(req.params)
  ) {
    logSecurityEvent('potential_sql_injection', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userAgent: req.get('user-agent'),
      body: JSON.stringify(req.body),
      query: JSON.stringify(req.query),
      params: JSON.stringify(req.params),
    })

    res.status(400).json({
      error: 'Bad request',
      message: 'Invalid input detected',
    })
    return
  }

  next()
}

export default securityHeaders
