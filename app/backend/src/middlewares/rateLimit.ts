import { Request, Response, NextFunction } from 'express'
import { RateLimiterMemory, RateLimiterRedis } from 'rate-limiter-flexible'
import Redis from 'ioredis'

// Redis client for rate limiting (if available)
let redisClient: any = null
if (process.env.REDIS_URL) {
  redisClient = new (Redis as any)(process.env.REDIS_URL!)
}

// Rate limiter factory - uses Redis if available, falls back to memory
const createRateLimiter = (config: any) => {
  if (redisClient) {
    return new RateLimiterRedis({
      ...config,
      storeClient: redisClient,
    })
  }
  return new RateLimiterMemory(config)
}

// Rate limiter configurations
const loginLimiter = createRateLimiter({
  keyPrefix: 'login_fail',
  points: 5, // Number of requests
  duration: 15 * 60, // Per 15 minutes
  blockDuration: 15 * 60, // Block for 15 minutes
})

const passwordResetLimiter = createRateLimiter({
  keyPrefix: 'password_reset',
  points: 3, // Number of requests
  duration: 60 * 60, // Per hour
  blockDuration: 60 * 60, // Block for 1 hour
})

const emailVerificationLimiter = createRateLimiter({
  keyPrefix: 'email_verification',
  points: 5, // Number of requests
  duration: 60 * 60, // Per hour
  blockDuration: 60 * 60, // Block for 1 hour
})

const generalLimiter = createRateLimiter({
  keyPrefix: 'general',
  points: 100, // Number of requests
  duration: 60, // Per minute
  blockDuration: 60, // Block for 1 minute
})

const strictLimiter = createRateLimiter({
  keyPrefix: 'strict',
  points: 10, // Number of requests
  duration: 60, // Per minute
  blockDuration: 5 * 60, // Block for 5 minutes
})

// Social features rate limiters
const createLimiter = createRateLimiter({
  keyPrefix: 'create',
  points: 20, // Number of create requests
  duration: 60, // Per minute
  blockDuration: 5 * 60, // Block for 5 minutes
})

const updateLimiter = createRateLimiter({
  keyPrefix: 'update',
  points: 30, // Number of update requests
  duration: 60, // Per minute
  blockDuration: 2 * 60, // Block for 2 minutes
})

const followLimiter = createRateLimiter({
  keyPrefix: 'follow',
  points: 50, // Number of follow/unfollow requests
  duration: 60, // Per minute
  blockDuration: 60, // Block for 1 minute
})

const adminLimiter = createRateLimiter({
  keyPrefix: 'admin',
  points: 100, // Number of admin requests
  duration: 60, // Per minute
  blockDuration: 60, // Block for 1 minute
})

// Get client identifier (IP address)
const getClientIdentifier = (req: Request): string => {
  return req.ip || req.connection.remoteAddress || 'unknown'
}

// Rate limiting middleware factory
const createRateLimitMiddleware = (
  limiter: RateLimiterMemory,
  message: string = 'Too many requests, please try again later.',
) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const key = getClientIdentifier(req)

      // Consume a point
      await limiter.consume(key)

      // Add rate limit headers
      const remaining = await limiter.get(key)
      if (remaining) {
        res.set({
          'X-RateLimit-Remaining': remaining.remainingPoints.toString(),
          'X-RateLimit-Reset': new Date(Date.now() + (remaining.msBeforeNext || 0)).toISOString(),
        })
      }

      next()
    } catch (rejRes: any) {
      const msBeforeNext = rejRes.msBeforeNext || 1000

      res.set({
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': new Date(Date.now() + msBeforeNext).toISOString(),
        'Retry-After': Math.round(msBeforeNext / 1000).toString(),
      })

      res.status(429).json({
        error: 'Rate limit exceeded',
        message,
        retryAfter: Math.round(msBeforeNext / 1000),
      })
    }
  }
}

// Specific rate limiters
export const loginRateLimit = createRateLimitMiddleware(
  loginLimiter,
  'Too many login attempts. Please try again in 15 minutes.',
)

export const passwordResetRateLimit = createRateLimitMiddleware(
  passwordResetLimiter,
  'Too many password reset requests. Please try again in 1 hour.',
)

export const emailVerificationRateLimit = createRateLimitMiddleware(
  emailVerificationLimiter,
  'Too many email verification requests. Please try again in 1 hour.',
)

export const generalRateLimit = createRateLimitMiddleware(
  generalLimiter,
  'Too many requests. Please slow down.',
)

export const strictRateLimit = createRateLimitMiddleware(
  strictLimiter,
  'Too many requests to this endpoint. Please try again later.',
)

// Social features rate limit exports
export const createRateLimit = createRateLimitMiddleware(
  createLimiter,
  'Too many create requests. Please slow down.',
)

export const updateRateLimit = createRateLimitMiddleware(
  updateLimiter,
  'Too many update requests. Please slow down.',
)

export const followRateLimit = createRateLimitMiddleware(
  followLimiter,
  'Too many follow/unfollow requests. Please slow down.',
)

export const adminRateLimit = createRateLimitMiddleware(
  adminLimiter,
  'Too many admin requests. Please slow down.',
)

// Dynamic rate limiter based on user authentication status
export const dynamicRateLimit = (
  authenticatedLimit: RateLimiterMemory = generalLimiter,
  unauthenticatedLimit: RateLimiterMemory = strictLimiter,
) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const limiter = req.user ? authenticatedLimit : unauthenticatedLimit
    const message = req.user
      ? 'Too many requests. Please slow down.'
      : 'Too many requests. Please login or try again later.'

    const middleware = createRateLimitMiddleware(limiter, message)
    await middleware(req, res, next)
  }
}

// Rate limiter for failed attempts (increases block duration)
export const createProgressiveRateLimiter = (baseLimiter: RateLimiterMemory) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const key = getClientIdentifier(req)

      // Get current consumption
      let consumption
      try {
        consumption = await baseLimiter.get(key)
      } catch {
        consumption = null
      }

      const failCount = consumption ? baseLimiter.points - consumption.remainingPoints : 0

      // Progressive blocking: increase block duration based on fail count
      const multiplier = Math.min(failCount + 1, 5) // Max 5x multiplier
      const blockDuration = (baseLimiter.blockDuration || 60) * multiplier

      // Create temporary limiter with adjusted block duration
      const tempLimiter = new RateLimiterMemory({
        keyPrefix: baseLimiter.keyPrefix,
        points: baseLimiter.points,
        duration: baseLimiter.duration,
        blockDuration: blockDuration,
      })

      const middleware = createRateLimitMiddleware(tempLimiter)
      await middleware(req, res, next)
    } catch (error) {
      next()
    }
  }
}

// Export progressive rate limiters
export const progressiveLoginRateLimit = createProgressiveRateLimiter(loginLimiter)

// Middleware to handle rate limit errors gracefully
export const handleRateLimitError = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (error.name === 'RateLimiterError') {
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please try again later.',
      retryAfter: error.msBeforeNext ? Math.round(error.msBeforeNext / 1000) : 60,
    })
    return
  }

  next(error)
}

// Cleanup function for rate limiters (can be called periodically)
export const cleanupRateLimiters = async (): Promise<void> => {
  try {
    // Rate limiter flexible handles cleanup automatically
    // This is just a placeholder for any custom cleanup logic
    console.log('Rate limiter cleanup completed')
  } catch (error) {
    console.error('Error during rate limiter cleanup:', error)
  }
}
