import { Request, Response, NextFunction } from 'express'
import logger, { logBusinessEvent, logSecurityEvent } from '../config/logger.js'

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now()
  const timestamp = new Date().toISOString()

  // Log request
  logger.info('HTTP Request', {
    method: req.method,
    url: req.url,
    path: req.path,
    query: req.query,
    params: req.params,
    headers: {
      'user-agent': req.get('user-agent'),
      'content-type': req.get('content-type'),
      authorization: req.get('authorization') ? '[REDACTED]' : undefined,
    },
    ip: req.ip,
    userId: (req as any).user?.id,
    timestamp,
  })

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - start
    const statusCode = res.statusCode

    const logData = {
      method: req.method,
      url: req.url,
      statusCode,
      duration,
      size: (res as any).get('content-length') || 0,
      ip: req.ip,
      userId: (req as any).user?.id,
      timestamp: new Date().toISOString(),
    }

    if (statusCode >= 500) {
      logger.error('HTTP Response Error', logData)
    } else if (statusCode >= 400) {
      logger.warn('HTTP Response Client Error', logData)
    } else {
      logger.info('HTTP Response', logData)
    }

    // Log business events for important operations
    if (req.path.includes('/auth/register') && statusCode === 201) {
      logBusinessEvent('user_registration_success', {
        ip: req.ip,
        userAgent: req.get('user-agent'),
        duration,
      })
    }

    if (req.path.includes('/auth/login') && statusCode === 200) {
      logBusinessEvent('user_login_success', {
        userId: (req as any).user?.id,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        duration,
      })
    }
  })

  next()
}

export const securityLogger = (req: Request, res: Response, next: NextFunction): void => {
  // Log security-relevant requests
  const securityPaths = [
    '/auth/login',
    '/auth/register',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/change-password',
  ]

  if (securityPaths.some(path => req.path.includes(path))) {
    logSecurityEvent('security_request', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      headers: {
        'x-forwarded-for': req.get('x-forwarded-for'),
        'x-real-ip': req.get('x-real-ip'),
        'x-client-ip': req.get('x-client-ip'),
      },
      timestamp: new Date().toISOString(),
    })
  }

  // Log failed authentication attempts
  if (req.path.includes('/auth/') && res.statusCode === 401) {
    logSecurityEvent('authentication_failure', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      emailOrUsername: req.body?.emailOrUsername || req.body?.email,
      timestamp: new Date().toISOString(),
    })
  }

  next()
}

export const performanceLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = process.hrtime.bigint()

  res.on('finish', () => {
    const end = process.hrtime.bigint()
    const duration = Number(end - start) / 1000000 // Convert to milliseconds

    // Log slow requests (>1000ms)
    if (duration > 1000) {
      logger.warn('Slow Request', {
        method: req.method,
        url: req.url,
        duration: Math.round(duration),
        statusCode: res.statusCode,
        ip: req.ip,
        userId: (req as any).user?.id,
        timestamp: new Date().toISOString(),
      })
    }

    // Track API performance metrics
    if (req.path.startsWith('/api/')) {
      logger.info('API Performance', {
        method: req.method,
        path: req.path,
        duration: Math.round(duration),
        statusCode: res.statusCode,
        userId: (req as any).user?.id,
        timestamp: new Date().toISOString(),
      })
    }
  })

  next()
}

export const trafficAnalysisLogger = (req: Request, res: Response, next: NextFunction): void => {
  // Log traffic patterns for analysis
  const logData = {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    referer: req.get('referer'),
    timestamp: new Date().toISOString(),
    hour: new Date().getHours(),
    day: new Date().getDay(),
  }

  // Log API traffic
  if (req.path.startsWith('/api/')) {
    logger.info('API Traffic', logData)
  }

  // Log GraphQL traffic
  if (req.path === '/graphql') {
    logger.info('GraphQL Traffic', {
      ...logData,
      operation: req.body?.operationName || 'anonymous',
      variables: req.body?.variables ? JSON.stringify(req.body.variables) : undefined,
    })
  }

  next()
}

export const errorLogger = (err: Error, req: Request, res: Response, next: NextFunction): void => {
  // Log application errors with context
  logger.error('Application Error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    path: req.path,
    query: req.query,
    params: req.params,
    body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    headers: req.headers,
    ip: req.ip,
    userId: (req as any).user?.id,
    userAgent: req.get('user-agent'),
    timestamp: new Date().toISOString(),
  })

  next(err)
}

export const databaseLogger = (req: Request, res: Response, next: NextFunction): void => {
  // Add database query logging for this request
  const originalSend = res.send
  res.send = function (data) {
    // Log database operations if they were performed
    if ((req as any).dbQueries) {
      logger.info('Database Operations', {
        path: req.path,
        method: req.method,
        queryCount: (req as any).dbQueries.length,
        queries: (req as any).dbQueries,
        timestamp: new Date().toISOString(),
      })
    }

    return originalSend.call(this, data)
  }

  next()
}

export default requestLogger
