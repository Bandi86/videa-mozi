import { Request, Response, NextFunction } from 'express'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'

// Enhanced security headers middleware using Helmet
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        'https://fonts.googleapis.com',
        'https://cdn.jsdelivr.net',
      ],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", 'data:', 'https:', 'http:'],
      connectSrc: ["'self'", 'https:', 'http:'],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  frameguard: { action: 'deny' },
  ieNoOpen: true,
})

// Rate limiting configurations for different endpoints
export const createRateLimiter = (windowMs: number, max: number, message: string) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: 'Too many requests from this IP, please try again later.',
      message,
      retryAfter: Math.ceil(windowMs / 1000),
    },
    standardHeaders: true,
    legacyHeaders: false,
  })
}

// Specific rate limiters for different endpoints
export const authRateLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  5, // 5 attempts
  'Too many authentication attempts, please try again in 15 minutes.',
)

export const apiRateLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  100, // 100 requests
  'API rate limit exceeded, please try again in 15 minutes.',
)

export const contentRateLimiter = createRateLimiter(
  60 * 1000, // 1 minute
  10, // 10 requests
  'Too many content operations, please try again in 1 minute.',
)

// Enhanced input sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  const sanitizeString = (str: string) => {
    if (typeof str !== 'string') return str

    // Remove potential XSS patterns
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .trim()
  }

  const sanitizeObject = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') {
      return typeof obj === 'string' ? sanitizeString(obj) : obj
    }

    if (Array.isArray(obj)) {
      return obj.map(item => sanitizeObject(item))
    }

    const sanitized: any = {}
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value)
    }
    return sanitized
  }

  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body)
  }

  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query)
  }

  next()
}

// CORS middleware with security considerations
export const corsOptions = {
  origin: function (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ) {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true)

    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3031',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3031',
      process.env.FRONTEND_URL,
    ].filter(Boolean)

    if (allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400, // 24 hours
}

// Request logging middleware for security events
export const securityLogger = (req: Request, res: Response, next: NextFunction): void => {
  const timestamp = new Date().toISOString()
  const ip = req.ip || req.connection.remoteAddress || 'unknown'
  const userAgent = req.get('User-Agent') || 'unknown'
  const method = req.method
  const url = req.url

  // Log authentication attempts
  if (url.includes('/auth/login') || url.includes('/auth/register')) {
    console.log(
      `[${timestamp}] AUTH_ATTEMPT - IP: ${ip} - Method: ${method} - URL: ${url} - UserAgent: ${userAgent}`,
    )
  }

  // Log suspicious activities
  if (
    req.headers.authorization &&
    method === 'POST' &&
    (url.includes('/auth/login') || url.includes('/auth/forgot-password'))
  ) {
    console.warn(
      `[${timestamp}] SUSPICIOUS_AUTH - IP: ${ip} - Already has token but attempting auth`,
    )
  }

  // Log password reset attempts
  if (url.includes('/auth/forgot-password') || url.includes('/auth/reset-password')) {
    console.log(
      `[${timestamp}] PASSWORD_RESET_ATTEMPT - IP: ${ip} - Method: ${method} - URL: ${url}`,
    )
  }

  next()
}

// Request size limiter
export const requestSizeLimiter = (maxSize: string = '10mb') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.headers['content-length'] || '0')

    if (contentLength > 10 * 1024 * 1024) {
      // 10MB limit
      res.status(413).json({
        error: 'Request too large',
        message: 'Request body exceeds maximum allowed size',
      })
      return
    }

    next()
  }
}

// SQL injection protection (basic)
export const sqlInjectionProtection = (req: Request, res: Response, next: NextFunction): void => {
  const suspiciousPatterns = [
    /(\bUNION\b|\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b|\bCREATE\b|\bALTER\b)/i,
    /('|(\\x27)|(\\x2D\\x2D)|(\\#)|(\%3B)|(\%27)|(\%22)|(\%2D\\x2D)|(\%23))/i,
    /(<script|javascript:|on\w+=)/i,
  ]

  const checkString = (str: string): boolean => {
    return suspiciousPatterns.some(pattern => pattern.test(str))
  }

  // Check request body
  if (req.body && typeof req.body === 'object') {
    const bodyString = JSON.stringify(req.body)
    if (checkString(bodyString)) {
      console.warn(`[SECURITY] Suspicious request body detected from IP: ${req.ip}`)
      res.status(400).json({
        error: 'Bad request',
        message: 'Request contains potentially malicious content',
      })
      return
    }
  }

  // Check query parameters
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value === 'string' && checkString(value)) {
      console.warn(
        `[SECURITY] Suspicious query parameter detected from IP: ${req.ip}: ${key}=${value}`,
      )
      res.status(400).json({
        error: 'Bad request',
        message: 'Request contains potentially malicious content',
      })
      return
    }
  }

  // Check URL parameters
  for (const [key, value] of Object.entries(req.params)) {
    if (typeof value === 'string' && checkString(value)) {
      console.warn(
        `[SECURITY] Suspicious URL parameter detected from IP: ${req.ip}: ${key}=${value}`,
      )
      res.status(400).json({
        error: 'Bad request',
        message: 'Request contains potentially malicious content',
      })
      return
    }
  }

  next()
}

// Extend global type for brute force store
declare global {
  var bruteForceStore: Map<string, { count: number; resetTime: number }> | undefined
}

// Prevent brute force on sensitive endpoints
export const bruteForceProtection = (req: Request, res: Response, next: NextFunction): void => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown'
  const now = Date.now()

  // Simple in-memory store for demonstration (use Redis in production)
  if (!global.bruteForceStore) {
    global.bruteForceStore = new Map()
  }

  const store = global.bruteForceStore

  if (!store.has(ip)) {
    store.set(ip, { count: 1, resetTime: now + 15 * 60 * 1000 }) // 15 minutes
  } else {
    const data = store.get(ip)!
    if (now > data.resetTime) {
      data.count = 1
      data.resetTime = now + 15 * 60 * 1000
    } else {
      data.count++
    }

    // Block after 10 failed attempts in 15 minutes
    if (data.count > 10) {
      console.warn(`[SECURITY] Brute force attempt blocked from IP: ${ip}`)
      res.status(429).json({
        error: 'Too many requests',
        message: 'Too many failed attempts. Please try again later.',
      })
      return
    }
  }

  next()
}

// API key validation (for future use)
export const validateApiKey = (req: Request, res: Response, next: NextFunction): void => {
  const apiKey = req.headers['x-api-key'] as string
  const validApiKey = process.env.API_KEY

  if (validApiKey && apiKey !== validApiKey) {
    res.status(401).json({
      error: 'Invalid API key',
      message: 'Please provide a valid API key',
    })
    return
  }

  next()
}

// Request timeout middleware
export const requestTimeout = (timeoutMs: number = 30000) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({
          error: 'Request timeout',
          message: 'Request took too long to process',
        })
      }
    }, timeoutMs)

    res.on('finish', () => {
      clearTimeout(timeout)
    })

    next()
  }
}

// Security headers for API responses
export const apiSecurityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY')

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff')

  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')

  // Permissions policy
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')

  // Remove server information
  res.removeHeader('X-Powered-By')

  next()
}
