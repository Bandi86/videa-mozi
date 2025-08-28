import jwt from 'jsonwebtoken'
import { redis } from '../../index.js'
import logger from '../../config/logger.js'

// JWT secret (should match User Service)
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'your-access-secret-key'

// Extend Socket.IO socket type to include user data
declare module 'socket.io' {
  interface Socket {
    data: {
      user?: {
        id: string
        username: string
        email: string
        roles: string
      }
      authenticated: boolean
    }
  }
}

/**
 * WebSocket authentication middleware
 * Validates JWT tokens for WebSocket connections
 */
export const authenticateSocket = async (socket: any, next: (error?: Error) => void) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '')

    if (!token) {
      // Allow anonymous connections but mark as unauthenticated
      socket.data = {
        authenticated: false,
      }
      logger.info(`🔌 Anonymous connection from ${socket.handshake.address}`)
      return next()
    }

    // Verify JWT token
    const decoded = jwt.verify(token, JWT_ACCESS_SECRET) as any

    if (decoded.type !== 'access') {
      return next(new Error('Invalid token type'))
    }

    // Check if token is not revoked (optional - check Redis blacklist)
    const blacklisted = await redis.get(`blacklist:${token}`)
    if (blacklisted) {
      return next(new Error('Token has been revoked'))
    }

    // Attach user data to socket
    socket.data = {
      user: {
        id: decoded.userId,
        username: decoded.username,
        email: decoded.email,
        roles: decoded.roles,
      },
      authenticated: true,
    }

    logger.info(
      `🔐 Authenticated WebSocket connection: ${socket.data.user.username} (${socket.data.user.id})`,
    )
    next()
  } catch (error) {
    logger.warn(`🔒 WebSocket authentication failed: ${error}`)
    socket.data = {
      authenticated: false,
    }
    // Allow connection but mark as unauthenticated
    next()
  }
}

/**
 * Middleware to require authentication for certain events
 */
export const requireAuthentication = (socket: any, next: (error?: Error) => void) => {
  if (!socket.data.authenticated || !socket.data.user) {
    logger.warn(`🚫 Unauthenticated access attempt from ${socket.handshake.address}`)
    return next(new Error('Authentication required'))
  }
  next()
}

/**
 * Middleware to require specific role
 */
export const requireRole = (requiredRole: string) => {
  return (socket: any, next: (error?: Error) => void) => {
    if (!socket.data.authenticated || !socket.data.user) {
      return next(new Error('Authentication required'))
    }

    if (socket.data.user.roles !== requiredRole && socket.data.user.roles !== 'ADMIN') {
      logger.warn(
        `🚫 Insufficient permissions for ${socket.data.user.username}: requires ${requiredRole}`,
      )
      return next(new Error('Insufficient permissions'))
    }

    next()
  }
}

/**
 * Rate limiting middleware for WebSocket events
 */
const eventCounts = new Map<string, { count: number; resetTime: number }>()

export const rateLimitSocket = (maxEvents: number = 60, windowMs: number = 60000) => {
  return (socket: any, next: (error?: Error) => void) => {
    const now = Date.now()
    const key = socket.data.user?.id || socket.handshake.address
    const userLimit = eventCounts.get(key!)

    if (!userLimit || now > userLimit.resetTime) {
      eventCounts.set(key!, { count: 1, resetTime: now + windowMs })
      return next()
    }

    if (userLimit.count >= maxEvents) {
      logger.warn(`🚫 Rate limit exceeded for ${key}`)
      return next(new Error('Rate limit exceeded'))
    }

    userLimit.count++
    next()
  }
}
