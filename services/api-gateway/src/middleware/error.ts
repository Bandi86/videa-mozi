import { Request, Response, NextFunction } from 'express'
import logger from '../config/logger.js'

/**
 * Global error handler middleware
 * Handles all errors that occur during request processing
 */
export const errorHandler = (err: any, req: Request, res: Response, _next: NextFunction): void => {
  // Log the error
  logger.error('API Gateway Error:', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    userId: req.user?.id,
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
  } else if (err.name === 'UnauthorizedError') {
    // Authentication error
    res.status(401).json({
      error: 'Authentication failed',
      message: err.message || 'Invalid credentials provided.',
    })
  } else if (err.name === 'ForbiddenError') {
    // Authorization error
    res.status(403).json({
      error: 'Access denied',
      message: err.message || 'Insufficient privileges for this operation.',
    })
  } else if (err.name === 'NotFoundError') {
    // Resource not found error
    res.status(404).json({
      error: 'Resource not found',
      message: err.message || 'The requested resource does not exist.',
    })
  } else if (err.name === 'RateLimitError') {
    // Rate limiting error
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: err.message || 'Too many requests. Please try again later.',
      retryAfter: err.resetTime ? Math.ceil((err.resetTime - Date.now()) / 1000) : 60,
    })
  } else if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    // Service unavailable error
    res.status(503).json({
      error: 'Service unavailable',
      message: 'The requested service is temporarily unavailable. Please try again later.',
      service: err.service || 'unknown',
    })
  } else if (err.code === 'ETIMEDOUT') {
    // Timeout error
    res.status(504).json({
      error: 'Gateway timeout',
      message: 'The request timed out. Please try again later.',
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
      health: '/health',
      api: '/api/v1/*',
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
          url: (_req as any).originalUrl,
          method: (_req as any).method,
          timeout: timeoutMs,
          userId: (_req as any).user?.id,
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
 * Circuit breaker middleware
 * Prevents cascading failures by temporarily stopping requests to failing services
 */
interface CircuitBreakerState {
  failures: number
  lastFailureTime: number
  state: 'closed' | 'open' | 'half-open'
}

const circuitBreakers = new Map<string, CircuitBreakerState>()

export const circuitBreaker = (
  serviceName: string,
  failureThreshold: number = 5,
  recoveryTimeout: number = 60000,
) => {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const breaker = circuitBreakers.get(serviceName) || {
      failures: 0,
      lastFailureTime: 0,
      state: 'closed' as const,
    }

    // Check if circuit is open
    if (breaker.state === 'open') {
      const now = Date.now()
      if (now - breaker.lastFailureTime > recoveryTimeout) {
        // Move to half-open state
        breaker.state = 'half-open'
        circuitBreakers.set(serviceName, breaker)
        logger.info(`Circuit breaker for ${serviceName} moved to half-open state`)
      } else {
        // Circuit is still open
        res.status(503).json({
          error: 'Service temporarily unavailable',
          message: `${serviceName} is experiencing issues. Please try again later.`,
          retryAfter: Math.ceil((recoveryTimeout - (now - breaker.lastFailureTime)) / 1000),
        })
        return
      }
    }

    // Store original response methods
    const originalSend = res.send
    const originalJson = res.json

    res.send = function (body: any) {
      if (res.statusCode >= 500) {
        // Service failure
        breaker.failures++
        breaker.lastFailureTime = Date.now()

        if (breaker.failures >= failureThreshold) {
          breaker.state = 'open'
          logger.error(
            `Circuit breaker for ${serviceName} opened after ${breaker.failures} failures`,
          )
        }

        circuitBreakers.set(serviceName, breaker)
      } else if (breaker.state === 'half-open') {
        // Success in half-open state - close circuit
        breaker.state = 'closed'
        breaker.failures = 0
        circuitBreakers.set(serviceName, breaker)
        logger.info(`Circuit breaker for ${serviceName} closed - service recovered`)
      }

      return originalSend.call(this, body)
    }

    res.json = function (body: any) {
      if (res.statusCode >= 500) {
        breaker.failures++
        breaker.lastFailureTime = Date.now()

        if (breaker.failures >= failureThreshold) {
          breaker.state = 'open'
          logger.error(
            `Circuit breaker for ${serviceName} opened after ${breaker.failures} failures`,
          )
        }

        circuitBreakers.set(serviceName, breaker)
      } else if (breaker.state === 'half-open') {
        breaker.state = 'closed'
        breaker.failures = 0
        circuitBreakers.set(serviceName, breaker)
        logger.info(`Circuit breaker for ${serviceName} closed - service recovered`)
      }

      return originalJson.call(this, body)
    }

    next()
  }
}

/**
 * Service health checker
 * Periodically checks the health of all services
 */
export class ServiceHealthChecker {
  private static healthChecks = new Map<
    string,
    { url: string; lastCheck: number; isHealthy: boolean }
  >()
  private static checkInterval: NodeJS.Timeout | null = null

  static addService(name: string, healthUrl: string): void {
    this.healthChecks.set(name, {
      url: healthUrl,
      lastCheck: 0,
      isHealthy: true,
    })
  }

  static startHealthChecks(intervalMs: number = 30000): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
    }

    this.checkInterval = setInterval(async () => {
      for (const [name, service] of this.healthChecks.entries()) {
        try {
          const response = await fetch(service.url, {
            signal: AbortSignal.timeout(5000),
          })

          const isHealthy = response.ok
          service.isHealthy = isHealthy
          service.lastCheck = Date.now()

          if (!isHealthy) {
            logger.warn(`Service ${name} is unhealthy:`, {
              url: service.url,
              status: response.status,
            })
          }
        } catch (error) {
          service.isHealthy = false
          service.lastCheck = Date.now()

          logger.error(`Health check failed for ${name}:`, {
            url: service.url,
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      }
    }, intervalMs)
  }

  static getHealthStatus(): { [serviceName: string]: boolean } {
    const status: { [serviceName: string]: boolean } = {}
    for (const [name, service] of this.healthChecks.entries()) {
      status[name] = service.isHealthy
    }
    return status
  }

  static stopHealthChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
  }
}

// Initialize service health checking
ServiceHealthChecker.addService(
  'user-service',
  `${process.env.USER_SERVICE_URL || 'http://localhost:3002'}/health`,
)
ServiceHealthChecker.addService(
  'content-service',
  `${process.env.CONTENT_SERVICE_URL || 'http://localhost:3003'}/health`,
)
ServiceHealthChecker.addService(
  'social-service',
  `${process.env.SOCIAL_SERVICE_URL || 'http://localhost:3004'}/health`,
)
ServiceHealthChecker.addService(
  'moderation-service',
  `${process.env.MODERATION_SERVICE_URL || 'http://localhost:3005'}/health`,
)
ServiceHealthChecker.addService(
  'media-service',
  `${process.env.MEDIA_SERVICE_URL || 'http://localhost:3006'}/health`,
)
ServiceHealthChecker.addService(
  'monitoring-service',
  `${process.env.MONITORING_SERVICE_URL || 'http://localhost:3007'}/health`,
)

if (process.env.NODE_ENV === 'production') {
  ServiceHealthChecker.startHealthChecks()
}
