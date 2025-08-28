import { Socket } from 'socket.io'
import jwt from 'jsonwebtoken'
import logger from '../../config/logger.js'

// Extend Socket interface to include user data
declare module 'socket.io' {
  interface Socket {
    user?: {
      id: string
      email: string
      role: string
      username?: string
    }
  }
}

/**
 * Authenticate WebSocket connection using JWT token
 */
export const authenticateSocket = (socket: Socket, next: (err?: Error) => void): void => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '')

    if (!token) {
      // Allow anonymous connections for public features
      logger.info(`Anonymous WebSocket connection: ${socket.id}`)
      return next()
    }

    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      logger.error('JWT_SECRET not configured')
      return next(new Error('Authentication configuration error'))
    }

    const decoded = jwt.verify(token, jwtSecret) as any

    socket.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role || 'user',
      username: decoded.username,
    }

    logger.info(`Authenticated WebSocket connection: ${socket.id} (User: ${socket.user.id})`)
    next()
  } catch (error) {
    logger.error('WebSocket authentication error:', error)
    next(new Error('Authentication failed'))
  }
}

/**
 * Require specific role for WebSocket event
 */
export const requireRole = (requiredRole: string) => {
  return (socket: Socket, next: (err?: Error) => void): void => {
    if (!socket.user) {
      return next(new Error('Authentication required'))
    }

    const userRole = socket.user.role
    const roleHierarchy = {
      admin: 3,
      moderator: 2,
      user: 1,
    }

    const userLevel = roleHierarchy[userRole as keyof typeof roleHierarchy] || 0
    const requiredLevel = roleHierarchy[requiredRole as keyof typeof roleHierarchy] || 999

    if (userLevel < requiredLevel) {
      return next(
        new Error(`Insufficient permissions. Required: ${requiredRole}, Got: ${userRole}`),
      )
    }

    next()
  }
}

/**
 * Require ownership or admin role
 */
export const requireOwnership = (resourceUserId: string) => {
  return (socket: Socket, next: (err?: Error) => void): void => {
    if (!socket.user) {
      return next(new Error('Authentication required'))
    }

    const isOwner = socket.user.id === resourceUserId
    const isAdmin = socket.user.role === 'admin'
    const isModerator = socket.user.role === 'moderator'

    if (!isOwner && !isAdmin && !isModerator) {
      return next(new Error('Ownership or moderator/admin privileges required'))
    }

    next()
  }
}

/**
 * Optional authentication - allows both authenticated and anonymous users
 */
export const optionalAuth = (socket: Socket, next: (err?: Error) => void): void => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '')

    if (token) {
      const jwtSecret = process.env.JWT_SECRET
      if (!jwtSecret) {
        logger.error('JWT_SECRET not configured')
        return next()
      }

      try {
        const decoded = jwt.verify(token, jwtSecret) as any
        socket.user = {
          id: decoded.id,
          email: decoded.email,
          role: decoded.role || 'user',
          username: decoded.username,
        }
        logger.info(
          `Optional auth successful for WebSocket: ${socket.id} (User: ${socket.user.id})`,
        )
      } catch (jwtError) {
        logger.warn(`Invalid JWT token for WebSocket: ${socket.id}`)
      }
    }

    next()
  } catch (error) {
    logger.error('Optional WebSocket authentication error:', error)
    next()
  }
}

/**
 * Rate limiting for WebSocket events
 */
const eventCounts = new Map<string, { count: number; resetTime: number }>()

export const rateLimit = (maxEvents: number = 10, windowMs: number = 60000) => {
  return (socket: Socket, next: (err?: Error) => void): void => {
    const userId = socket.user?.id || socket.id
    const now = Date.now()
    const windowKey = userId

    const current = eventCounts.get(windowKey)

    if (!current || now > current.resetTime) {
      eventCounts.set(windowKey, { count: 1, resetTime: now + windowMs })
      return next()
    }

    if (current.count >= maxEvents) {
      return next(new Error('Rate limit exceeded'))
    }

    current.count++
    next()
  }
}

/**
 * Validate event data structure
 */
export const validateEventData = (requiredFields: string[]) => {
  return (socket: Socket, data: any, next: (err?: Error) => void): void => {
    const missingFields = requiredFields.filter(field => !data[field])

    if (missingFields.length > 0) {
      return next(new Error(`Missing required fields: ${missingFields.join(', ')}`))
    }

    next()
  }
}

/**
 * Log WebSocket events for security monitoring
 */
export const logWebSocketEvent = (eventName: string) => {
  return (socket: Socket, data: any): void => {
    const userId = socket.user?.id || 'anonymous'
    const ip = socket.handshake.address
    const userAgent = socket.handshake.headers['user-agent']

    logger.info(`🔌 WebSocket Event: ${eventName}`, {
      socketId: socket.id,
      userId,
      ip,
      userAgent,
      eventData: data,
      timestamp: new Date().toISOString(),
    })

    // Store security events in Redis for monitoring
    if (global.redisClient) {
      try {
        const securityEvent = {
          event: eventName,
          socketId: socket.id,
          userId,
          ip,
          userAgent,
          data,
          timestamp: new Date().toISOString(),
        }

        global.redisClient.lpush('websocket:security:events', JSON.stringify(securityEvent))
        global.redisClient.ltrim('websocket:security:events', 0, 999) // Keep last 1000 events
        global.redisClient.expire('websocket:security:events', 86400) // 24 hours
      } catch (redisError) {
        logger.error('Redis security event logging error:', redisError)
      }
    }
  }
}

/**
 * Check if user is banned or suspended
 */
export const checkUserStatus = (socket: Socket, next: (err?: Error) => void): void => {
  if (!socket.user) {
    return next()
  }

  // This would typically check a database or Redis cache for user status
  // For now, we'll just pass through
  // In a real implementation, you might check:
  // - If user is banned
  // - If user account is suspended
  // - If user has exceeded rate limits

  next()
}
