import { Request, Response, NextFunction } from 'express'
import logger from '../config/logger.js'

/**
 * Request logging middleware
 * Logs all incoming requests with performance metrics
 */
export const requestLogging = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now()
  const timestamp = new Date().toISOString()

  // Log request
  logger.info('API Gateway Request:', {
    timestamp,
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: req.user?.id,
    headers: {
      'content-type': req.get('Content-Type'),
      authorization: req.get('Authorization') ? '[PRESENT]' : '[NOT PRESENT]',
      'x-api-key': req.get('X-API-Key') ? '[PRESENT]' : '[NOT PRESENT]',
    },
    query: req.query,
    params: req.params,
    bodySize: req.get('Content-Length'),
  })

  // Log response
  res.on('finish', () => {
    const endTime = Date.now()
    const responseTime = endTime - startTime
    const timestamp = new Date().toISOString()

    logger.info('API Gateway Response:', {
      timestamp,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      userId: req.user?.id,
      ip: req.ip,
      contentLength: res.get('Content-Length'),
      // Flag slow requests
      performance: responseTime > 1000 ? 'SLOW' : responseTime > 500 ? 'FAIR' : 'GOOD',
    })

    // Alert on very slow requests
    if (responseTime > 5000) {
      logger.error('VERY SLOW REQUEST:', {
        method: req.method,
        url: req.originalUrl,
        responseTime: `${responseTime}ms`,
        statusCode: res.statusCode,
        userId: req.user?.id,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      })
    }
  })

  // Log errors
  res.on('error', error => {
    logger.error('Response Error:', {
      error: error.message,
      method: req.method,
      url: req.originalUrl,
      userId: req.user?.id,
      ip: req.ip,
      stack: error.stack,
    })
  })

  next()
}

/**
 * Service call logging middleware
 * Logs calls to downstream services
 */
export const serviceCallLogging = (serviceName: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now()
    const serviceUrl = req.originalUrl

    logger.debug(`Calling ${serviceName}:`, {
      method: req.method,
      url: serviceUrl,
      userId: req.user?.id,
      timestamp: new Date().toISOString(),
    })

    // Log service response
    res.on('finish', () => {
      const endTime = Date.now()
      const responseTime = endTime - startTime

      logger.debug(`${serviceName} Response:`, {
        method: req.method,
        url: serviceUrl,
        statusCode: res.statusCode,
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString(),
      })
    })

    next()
  }
}

/**
 * Security event logging middleware
 * Logs security-related events and suspicious activities
 */
export const securityLogging = (req: Request, _res: Response, next: NextFunction): void => {
  const ip = req.ip || req.connection.remoteAddress
  const userAgent = req.get('User-Agent') || 'unknown'
  const timestamp = new Date().toISOString()

  // Log authentication attempts
  if (req.originalUrl.includes('/auth/login') || req.originalUrl.includes('/auth/register')) {
    logger.info('AUTHENTICATION_ATTEMPT:', {
      timestamp,
      ip,
      userAgent,
      method: req.method,
      url: req.originalUrl,
      headers: {
        authorization: req.get('Authorization') ? '[PRESENT]' : '[NOT PRESENT]',
        'x-api-key': req.get('X-API-Key') ? '[PRESENT]' : '[NOT PRESENT]',
      },
    })
  }

  // Log suspicious patterns
  const suspiciousPatterns = [
    /\.\./, // Directory traversal
    /<script/i, // XSS attempts
    /union.*select/i, // SQL injection
    /javascript:/i, // JavaScript injection
    /eval\(/i, // Code injection
    /base64/i, // Potential encoded attacks
  ]

  const requestData = `${req.originalUrl} ${JSON.stringify(req.body)} ${JSON.stringify(req.query)}`

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(requestData)) {
      logger.warn('SUSPICIOUS_REQUEST_DETECTED:', {
        timestamp,
        ip,
        userAgent,
        method: req.method,
        url: req.originalUrl,
        pattern: pattern.toString(),
        userId: req.user?.id,
        severity: 'HIGH',
      })
      break
    }
  }

  // Log rapid requests (potential DoS)
  const rapidRequestKey = `rapid:${ip}`
  const now = Date.now()

  if (!(global as any).rapidRequests) {
    ;(global as any).rapidRequests = new Map()
  }

  const rapidRequests = (global as any).rapidRequests
  const recentRequests = rapidRequests.get(rapidRequestKey) || []

  const recentValidRequests = recentRequests.filter((time: number) => now - time < 60000)
  recentValidRequests.push(now)

  rapidRequests.set(rapidRequestKey, recentValidRequests)

  if (recentValidRequests.length > 20) {
    logger.warn('RAPID_REQUESTS_DETECTED:', {
      timestamp,
      ip,
      userAgent,
      requestCount: recentValidRequests.length,
      timeWindow: '60 seconds',
      severity: recentValidRequests.length > 50 ? 'CRITICAL' : 'HIGH',
    })
  }

  // Log admin operations
  if (
    req.user?.roles === 'ADMIN' &&
    (req.method !== 'GET' ||
      req.originalUrl.includes('/reports') ||
      req.originalUrl.includes('/users'))
  ) {
    logger.info('ADMIN_OPERATION:', {
      timestamp,
      userId: req.user.id,
      username: req.user.username,
      method: req.method,
      url: req.originalUrl,
      ip,
      userAgent,
    })
  }

  next()
}

/**
 * Performance monitoring middleware
 * Tracks response times and performance metrics
 */
export const performanceMonitoring = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = performance.now()
  const startMemory = process.memoryUsage()

  res.on('finish', () => {
    const endTime = performance.now()
    const endMemory = process.memoryUsage()

    const responseTime = endTime - startTime
    const memoryDelta = {
      rss: endMemory.rss - startMemory.rss,
      heapUsed: endMemory.heapUsed - startMemory.heapUsed,
      heapTotal: endMemory.heapTotal - startMemory.heapTotal,
      external: endMemory.external - startMemory.external,
    }

    // Log performance metrics for slow requests
    if (responseTime > 1000) {
      logger.warn('PERFORMANCE_METRICS:', {
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.originalUrl,
        responseTime: `${responseTime.toFixed(2)}ms`,
        statusCode: res.statusCode,
        memoryDelta,
        userId: req.user?.id,
        ip: req.ip,
        performance: responseTime > 5000 ? 'CRITICAL' : responseTime > 2000 ? 'POOR' : 'SLOW',
      })
    }

    // Add performance headers
    res.setHeader('X-Response-Time', `${responseTime.toFixed(2)}ms`)
    res.setHeader('X-Server-Time', new Date().toISOString())
    res.setHeader('X-Powered-By', 'Videa-Mozi-API-Gateway')
  })

  next()
}

/**
 * Traffic analysis middleware
 * Analyzes traffic patterns and logs anomalies
 */
export const trafficAnalysis = (req: Request, _res: Response, next: NextFunction): void => {
  const ip = req.ip || req.connection.remoteAddress
  const endpoint = req.originalUrl
  const method = req.method
  const userAgent = req.get('User-Agent') || 'unknown'

  // Simple traffic analysis
  const trafficKey = `${ip}:${endpoint}:${method}`
  const now = Date.now()

  if (!(global as any).trafficData) {
    ;(global as any).trafficData = new Map()
  }

  const trafficData = (global as any).trafficData
  const currentData = trafficData.get(trafficKey) || {
    count: 0,
    firstSeen: now,
    lastSeen: now,
    userAgents: new Set(),
    totalRequests: 0,
  }

  currentData.count++
  currentData.lastSeen = now
  currentData.userAgents.add(userAgent)
  currentData.totalRequests++

  trafficData.set(trafficKey, currentData)

  // Log unusual traffic patterns
  if (currentData.count > 10 && now - currentData.firstSeen < 60000) {
    logger.info('TRAFFIC_ANALYSIS:', {
      timestamp: new Date().toISOString(),
      ip,
      endpoint,
      method,
      requestCount: currentData.count,
      timeWindow: `${Math.round((now - currentData.firstSeen) / 1000)}s`,
      uniqueUserAgents: currentData.userAgents.size,
      totalRequests: currentData.totalRequests,
      pattern: 'HIGH_FREQUENCY',
    })
  }

  // Clean old traffic data periodically
  if (Math.random() < 0.01) {
    // 1% chance
    for (const [key, data] of trafficData.entries()) {
      if (now - data.lastSeen > 3600000) {
        // 1 hour
        trafficData.delete(key)
      }
    }
  }

  next()
}

/**
 * Audit logging middleware
 * Logs all important operations for compliance
 */
export const auditLogging = (req: Request, res: Response, next: NextFunction): void => {
  // Only log important operations
  const importantOperations = [
    '/auth/login',
    '/auth/register',
    '/auth/logout',
    '/users',
    '/reports',
    '/content',
    '/posts',
    '/comments',
    '/likes',
    '/shares',
    '/followers',
  ]

  const isImportantOperation = importantOperations.some(op => req.originalUrl.includes(op))
  const isWriteOperation = ['POST', 'PUT', 'DELETE'].includes(req.method)

  if (isImportantOperation || isWriteOperation) {
    logger.info('AUDIT_LOG:', {
      timestamp: new Date().toISOString(),
      userId: req.user?.id,
      username: req.user?.username,
      roles: req.user?.roles,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      operation: isWriteOperation ? 'WRITE' : 'READ',
      importance: isImportantOperation ? 'HIGH' : 'NORMAL',
    })
  }

  next()
}

/**
 * Error logging middleware
 * Enhanced error logging with context
 */
export const errorLogging = (err: any, req: Request, res: Response, next: NextFunction): void => {
  logger.error('API_GATEWAY_ERROR:', {
    timestamp: new Date().toISOString(),
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    statusCode: res.statusCode,
    userId: req.user?.id,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    headers: {
      'content-type': req.get('Content-Type'),
      authorization: req.get('Authorization') ? '[PRESENT]' : '[NOT PRESENT]',
      'x-api-key': req.get('X-API-Key') ? '[PRESENT]' : '[NOT PRESENT]',
    },
    query: req.query,
    params: req.params,
    body: req.method !== 'GET' ? JSON.stringify(req.body).substring(0, 500) : undefined,
  })

  next(err)
}
