import jwt from 'jsonwebtoken'
import { Socket } from 'socket.io'
import prisma from '../../config/database.js'
import logger, { logSecurityEvent } from '../../config/logger.js'
import { UserRole, UserStatus } from '@prisma/client'

declare module 'socket.io' {
  interface Socket {
    userId?: string
    username?: string
    userRole?: UserRole
    userStatus?: UserStatus
  }
}

export const authenticateSocket = async (
  socket: Socket,
  next: (err?: Error) => void,
): Promise<void> => {
  try {
    const token =
      socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '')

    if (!token) {
      // Allow anonymous connections for some features
      logger.debug('Anonymous socket connection')
      return next()
    }

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
            username: true,
            email: true,
            role: true,
            status: true,
            isEmailVerified: true,
            avatarUrl: true,
            isPrivate: true,
          },
        },
      },
    })

    if (!session || !session.user) {
      logSecurityEvent('websocket_auth_failed', {
        socketId: socket.id,
        ip: socket.handshake.address,
        userAgent: socket.handshake.headers['user-agent'],
        reason: 'invalid_token',
      })

      return next(new Error('Authentication failed: Invalid token'))
    }

    // Check if user is active
    if (session.user.status !== UserStatus.ACTIVE) {
      logSecurityEvent('websocket_auth_failed', {
        socketId: socket.id,
        userId: session.user.id,
        status: session.user.status,
        reason: 'user_inactive',
      })

      return next(new Error('Authentication failed: Account not active'))
    }

    // Attach user information to socket
    socket.userId = session.user.id
    socket.username = session.user.username
    socket.userRole = session.user.role
    socket.userStatus = session.user.status

    // Update session last used
    await prisma.authSession.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() },
    })

    // Update user last active
    await prisma.user.update({
      where: { id: session.user.id },
      data: { lastActiveAt: new Date() },
    })

    logger.info(`✅ Authenticated socket connection: ${session.user.username} (${session.user.id})`)

    next()
  } catch (error: any) {
    logger.error('Socket authentication error:', error)

    logSecurityEvent('websocket_auth_error', {
      socketId: socket.id,
      ip: socket.handshake.address,
      error: error.message,
    })

    if (error.name === 'JsonWebTokenError') {
      return next(new Error('Authentication failed: Invalid token'))
    }

    if (error.name === 'TokenExpiredError') {
      return next(new Error('Authentication failed: Token expired'))
    }

    return next(new Error('Authentication failed: Unknown error'))
  }
}

export const requireSocketAuth = (socket: Socket, next: (err?: Error) => void): void => {
  if (!socket.userId) {
    return next(new Error('Authentication required'))
  }
  next()
}

export const requireSocketRole = (allowedRoles: UserRole[]) => {
  return (socket: Socket, next: (err?: Error) => void): void => {
    if (!socket.userId) {
      return next(new Error('Authentication required'))
    }

    if (!socket.userRole || !allowedRoles.includes(socket.userRole)) {
      logSecurityEvent('websocket_insufficient_permissions', {
        socketId: socket.id,
        userId: socket.userId,
        requiredRoles: allowedRoles,
        userRole: socket.userRole,
      })

      return next(new Error('Insufficient permissions'))
    }

    next()
  }
}

export const requireSocketOwnership = (userId: string) => {
  return (socket: Socket, next: (err?: Error) => void): void => {
    if (!socket.userId) {
      return next(new Error('Authentication required'))
    }

    // Allow admins to access any resource
    if (socket.userRole === UserRole.ADMIN) {
      return next()
    }

    // Check if user owns the resource
    if (socket.userId !== userId) {
      logSecurityEvent('websocket_ownership_violation', {
        socketId: socket.id,
        userId: socket.userId,
        resourceUserId: userId,
      })

      return next(new Error('Access denied'))
    }

    next()
  }
}
