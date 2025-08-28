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
      isModerator?: boolean
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
      isModerator: ['moderator', 'admin'].includes(decoded.role),
    }

    logger.info(
      `Authenticated WebSocket connection: ${socket.id} (User: ${socket.user.id}, Role: ${socket.user.role})`,
    )
    next()
  } catch (error) {
    logger.error('WebSocket authentication error:', error)
    next(new Error('Authentication failed'))
  }
}

/**
 * Require moderator or admin role
 */
export const requireModerator = (socket: Socket, next: (err?: Error) => void): void => {
  if (!socket.user) {
    return next(new Error('Authentication required'))
  }

  if (!socket.user.isModerator) {
    return next(new Error('Moderator or admin privileges required'))
  }

  next()
}

/**
 * Require admin role only
 */
export const requireAdmin = (socket: Socket, next: (err?: Error) => void): void => {
  if (!socket.user) {
    return next(new Error('Authentication required'))
  }

  if (socket.user.role !== 'admin') {
    return next(new Error('Admin privileges required'))
  }

  next()
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
 * Require ownership or moderator role
 */
export const requireOwnershipOrModerator = (resourceUserId: string) => {
  return (socket: Socket, next: (err?: Error) => void): void => {
    if (!socket.user) {
      return next(new Error('Authentication required'))
    }

    const isOwner = socket.user.id === resourceUserId
    const isModerator = socket.user.isModerator

    if (!isOwner && !isModerator) {
      return next(new Error('Ownership or moderator privileges required'))
    }

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
 * Log WebSocket events for moderation monitoring
 */
export const logModerationEvent = (eventName: string) => {
  return (socket: Socket, data: any): void => {
    const userId = socket.user?.id || 'anonymous'
    const userRole = socket.user?.role || 'unknown'
    const ip = socket.handshake.address
    const userAgent = socket.handshake.headers['user-agent']

    logger.info(`🛡️ Moderation WebSocket Event: ${eventName}`, {
      socketId: socket.id,
      userId,
      userRole,
      ip,
      userAgent,
      eventData: data,
      timestamp: new Date().toISOString(),
    })

    // Store moderation events in Redis for monitoring
    if (global.redisClient) {
      try {
        const moderationEvent = {
          event: eventName,
          socketId: socket.id,
          userId,
          userRole,
          ip,
          userAgent,
          data,
          timestamp: new Date().toISOString(),
        }

        global.redisClient.lpush('websocket:moderation:events', JSON.stringify(moderationEvent))
        global.redisClient.ltrim('websocket:moderation:events', 0, 999) // Keep last 1000 events
        global.redisClient.expire('websocket:moderation:events', 86400) // 24 hours
      } catch (redisError) {
        logger.error('Redis moderation event logging error:', redisError)
      }
    }
  }
}

/**
 * Check if user is moderator or admin
 */
export const checkModeratorStatus = (socket: Socket, next: (err?: Error) => void): void => {
  if (!socket.user) {
    return next()
  }

  // This would typically check a database or Redis cache for moderator status
  // For now, we'll use the JWT role
  socket.user.isModerator = ['moderator', 'admin'].includes(socket.user.role)

  next()
}

/**
 * Join moderator room if user is moderator
 */
export const joinModeratorRoom = (socket: Socket): void => {
  if (socket.user?.isModerator && socket.user.id) {
    socket.join(`moderator:${socket.user.id}`)
    logger.info(`👥 Moderator ${socket.user.id} joined moderator room`)
  }
}

/**
 * Join report room for specific report
 */
export const joinReportRoom = (socket: Socket, reportId: string): void => {
  socket.join(`report:${reportId}`)
  logger.info(`👥 User joined report room: report:${reportId}`)
}

/**
 * Join appeal room for specific appeal
 */
export const joinAppealRoom = (socket: Socket, appealId: string): void => {
  socket.join(`appeal:${appealId}`)
  logger.info(`👥 User joined appeal room: appeal:${appealId}`)
}

/**
 * Heartbeat for presence
 */
export const updatePresence = (socket: Socket): void => {
  if (socket.user?.id && global.redisClient) {
    try {
      global.redisClient.set(
        `moderator:presence:${socket.user.id}`,
        JSON.stringify({
          status: 'online',
          socketId: socket.id,
          lastSeen: new Date().toISOString(),
          role: socket.user.role,
        }),
        'EX',
        300,
      ) // 5 minutes expiry
    } catch (redisError) {
      logger.error('Redis presence update error:', redisError)
    }
  }
}
