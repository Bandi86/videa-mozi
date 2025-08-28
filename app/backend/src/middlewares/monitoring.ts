import { Request, Response, NextFunction } from 'express'
import { v4 as uuidv4 } from 'uuid'
import MonitoringService from '../services/monitoringService.js'

// Extend Request interface to include monitoring data
declare global {
  namespace Express {
    interface Request {
      monitoringId?: string
      startTime?: number
    }
  }
}

/**
 * Request monitoring middleware
 * Tracks performance metrics, errors, and system health
 */
export const requestMonitoring = (req: Request, res: Response, next: NextFunction): void => {
  // Generate unique ID for this request
  const monitoringId = uuidv4()
  req.monitoringId = monitoringId
  req.startTime = Date.now()

  // Start monitoring this request
  MonitoringService.startRequest(monitoringId, req.originalUrl, req.method)

  // Track response
  const originalSend = res.send
  const originalJson = res.json
  const originalEnd = res.end

  // Override send method to capture response
  res.send = function (body: any) {
    if (!res.headersSent) {
      // End monitoring on first response
      MonitoringService.endRequest(
        monitoringId,
        res.statusCode,
        (req as any).user?.id,
        req.get('User-Agent'),
        req.ip,
      )
    }
    return originalSend.call(this, body)
  }

  // Override json method to capture response
  res.json = function (body: any) {
    if (!res.headersSent) {
      // End monitoring on first response
      MonitoringService.endRequest(
        monitoringId,
        res.statusCode,
        (req as any).user?.id,
        req.get('User-Agent'),
        req.ip,
      )
    }
    return originalJson.call(this, body)
  }

  // Override end method to capture response
  res.end = function (chunk?: any, encoding?: BufferEncoding | (() => void)) {
    if (!res.headersSent && req.monitoringId) {
      // End monitoring on response end
      MonitoringService.endRequest(
        monitoringId,
        res.statusCode,
        (req as any).user?.id,
        req.get('User-Agent'),
        req.ip,
      )
    }
    return originalEnd.call(this, chunk, encoding)
  }

  // Error handling
  res.on('finish', () => {
    // Ensure monitoring ends even if response methods weren't called
    if (req.monitoringId) {
      MonitoringService.endRequest(
        monitoringId,
        res.statusCode,
        (req as any).user?.id,
        req.get('User-Agent'),
        req.ip,
      )
    }
  })

  // Handle uncaught exceptions during request processing
  res.on('error', error => {
    if (req.monitoringId) {
      MonitoringService.recordError(
        error,
        req.originalUrl,
        req.method,
        (req as any).user?.id,
        req.get('User-Agent'),
        req.ip,
      )
    }
  })

  next()
}

/**
 * Database query monitoring middleware
 * Intercepts and monitors database queries
 */
export const databaseMonitoring = (req: Request, res: Response, next: NextFunction): void => {
  // Store original Prisma methods to monitor them
  const originalPrismaFindMany = (global as any).prismaClient?.$on
  const originalPrismaCreate = (global as any).prismaClient?.$on
  const originalPrismaUpdate = (global as any).prismaClient?.$on
  const originalPrismaDelete = (global as any).prismaClient?.$on

  // This is a simplified version - in production you'd want to use
  // Prisma middleware or database query logging
  next()
}

/**
 * Error monitoring middleware
 * Captures and reports application errors
 */
export const errorMonitoring = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // Record the error
  MonitoringService.recordError(
    err,
    req.originalUrl,
    req.method,
    (req as any).user?.id,
    req.get('User-Agent'),
    req.ip,
  )

  // Continue with error handling
  next(err)
}

/**
 * Performance profiling middleware
 * Adds performance headers to responses
 */
export const performanceProfiling = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = process.hrtime.bigint()

  res.on('finish', () => {
    const endTime = process.hrtime.bigint()
    const executionTime = Number(endTime - startTime) / 1000000 // Convert to milliseconds

    // Add performance headers
    res.setHeader('X-Response-Time', `${executionTime.toFixed(2)}ms`)
    res.setHeader('X-Server-Time', new Date().toISOString())
    res.setHeader('X-Powered-By', 'Videa-Mozi-API')
  })

  next()
}

/**
 * System health monitoring middleware
 * Periodically checks system health
 */
export const systemHealthMonitoring = (req: Request, res: Response, next: NextFunction): void => {
  // Only check system health on health endpoint or periodically
  if (req.originalUrl.includes('/health') || Math.random() < 0.01) {
    // 1% of requests
    const healthData = {
      timestamp: Date.now(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      platform: process.platform,
      version: process.version,
      pid: process.pid,
    }

    // Store health data for monitoring dashboard
    // In production, you might want to store this in Redis or a time-series database
    ;(global as any).systemHealth = healthData
  }

  next()
}

/**
 * Traffic monitoring middleware
 * Monitors traffic patterns and potential abuse
 */
export const trafficMonitoring = (req: Request, res: Response, next: NextFunction): void => {
  const ip = req.ip || req.connection.remoteAddress
  const userAgent = req.get('User-Agent') || 'unknown'
  const endpoint = req.originalUrl
  const method = req.method

  // Simple traffic analysis (in production, use Redis for distributed counting)
  const trafficKey = `${ip}:${endpoint}:${method}`

  // Store traffic data globally (in production, use Redis)
  if (!(global as any).trafficData) {
    ;(global as any).trafficData = new Map()
  }

  const trafficData = (global as any).trafficData
  const now = Date.now()
  const windowStart = now - 60 * 1000 // 1 minute window

  // Clean old entries
  for (const [key, data] of trafficData.entries()) {
    if (data.timestamp < windowStart) {
      trafficData.delete(key)
    }
  }

  // Update traffic count
  const currentData = trafficData.get(trafficKey) || { count: 0, timestamp: now }
  currentData.count++
  currentData.timestamp = now
  trafficData.set(trafficKey, currentData)

  // Check for suspicious traffic patterns
  if (currentData.count > 10) {
    // More than 10 requests per minute
    console.warn(
      `[TRAFFIC MONITOR] High traffic detected: ${trafficKey} - ${currentData.count} requests/minute`,
    )

    // In production, you might want to implement rate limiting or blocking here
    if (currentData.count > 30) {
      // Very high traffic - potential DoS
      console.error(
        `[TRAFFIC MONITOR] Potential DoS attack: ${trafficKey} - ${currentData.count} requests/minute`,
      )
      // You could implement automatic blocking here
    }
  }

  next()
}

/**
 * Memory monitoring middleware
 * Tracks memory usage and alerts on high usage
 */
export const memoryMonitoring = (req: Request, res: Response, next: NextFunction): void => {
  const memUsage = process.memoryUsage()

  // Check memory usage thresholds
  const memoryUsageRatio = memUsage.heapUsed / memUsage.heapTotal

  if (memoryUsageRatio > 0.9) {
    // 90% memory usage
    console.error(`[MEMORY MONITOR] Critical memory usage: ${(memoryUsageRatio * 100).toFixed(1)}%`)
    console.error(`[MEMORY MONITOR] Heap used: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`)
    console.error(
      `[MEMORY MONITOR] Heap total: ${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
    )

    // Force garbage collection if available (only in development)
    if (global.gc) {
      console.log('[MEMORY MONITOR] Running garbage collection...')
      global.gc()
    }
  } else if (memoryUsageRatio > 0.8) {
    // 80% memory usage
    console.warn(`[MEMORY MONITOR] High memory usage: ${(memoryUsageRatio * 100).toFixed(1)}%`)
  }

  next()
}

/**
 * Security monitoring middleware
 * Monitors for suspicious security patterns
 */
export const securityMonitoring = (req: Request, res: Response, next: NextFunction): void => {
  const ip = req.ip || req.connection.remoteAddress
  const userAgent = req.get('User-Agent') || 'unknown'
  const referer = req.get('Referer') || ''

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /\.\./, // Directory traversal attempts
    /<script/i, // XSS attempts
    /union.*select/i, // SQL injection attempts
    /javascript:/i, // JavaScript injection
    /eval\(/i, // Code injection
    /base64/i, // Potential encoded attacks
  ]

  const requestData = `${req.originalUrl} ${JSON.stringify(req.body)} ${JSON.stringify(req.query)}`

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(requestData)) {
      console.warn(
        `[SECURITY MONITOR] Suspicious pattern detected: ${pattern} - IP: ${ip} - URL: ${req.originalUrl} - UserAgent: ${userAgent}`,
      )

      // Record security event
      MonitoringService.recordError(
        new Error(`Suspicious pattern detected: ${pattern}`),
        req.originalUrl,
        req.method,
        (req as any).user?.id,
        userAgent,
        ip,
      )
      break
    }
  }

  // Check for rapid requests from same IP (potential brute force)
  const rapidRequestKey = `rapid:${ip}`
  const now = Date.now()

  if (!(global as any).rapidRequests) {
    ;(global as any).rapidRequests = new Map()
  }

  const rapidRequests = (global as any).rapidRequests
  const recentRequests = rapidRequests.get(rapidRequestKey) || []

  // Keep only requests from last minute
  const recentValidRequests = recentRequests.filter((time: number) => now - time < 60000)
  recentValidRequests.push(now)

  rapidRequests.set(rapidRequestKey, recentValidRequests)

  if (recentValidRequests.length > 20) {
    // More than 20 requests per minute
    console.warn(
      `[SECURITY MONITOR] Rapid requests detected from IP: ${ip} - ${recentValidRequests.length} requests/minute`,
    )
  }

  next()
}

export default {
  requestMonitoring,
  databaseMonitoring,
  errorMonitoring,
  performanceProfiling,
  systemHealthMonitoring,
  trafficMonitoring,
  memoryMonitoring,
  securityMonitoring,
}
