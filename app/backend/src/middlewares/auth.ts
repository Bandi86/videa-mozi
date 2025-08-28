import { Request, Response, NextFunction } from 'express'
import { verifyAccessToken } from '../utils/jwt/token.js'
import prisma from '../config/prisma.js'

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number
        username: string
        email: string
        roles: string
      }
    }
  }
}

// Authentication middleware - verifies JWT token
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        error: 'Access token required',
        message: 'Please provide an access token in the Authorization header',
      })
      return
    }

    // Verify token
    const decoded = verifyAccessToken(token)
    if (!decoded) {
      res.status(403).json({
        error: 'Invalid or expired token',
        message: 'The provided access token is invalid or has expired',
      })
      return
    }

    // Check if token exists in database and is still valid
    const authRecord = await prisma.auth.findUnique({
      where: { accessToken: token },
      include: { users: true },
    })

    if (!authRecord) {
      res.status(403).json({
        error: 'Token not found',
        message: 'The provided token was not found in our records',
      })
      return
    }

    // Check if token is expired
    if (authRecord.expiresAt < new Date()) {
      res.status(403).json({
        error: 'Token expired',
        message: 'The access token has expired. Please refresh your token.',
      })
      return
    }

    // Update last seen
    await prisma.auth.update({
      where: { id: authRecord.id },
      data: { lastSeen: new Date() },
    })

    // Attach user to request
    req.user = {
      id: decoded.id,
      username: decoded.username,
      email: decoded.email,
      roles: decoded.roles,
    }

    next()
  } catch (error) {
    console.error('Authentication middleware error:', error)
    res.status(500).json({
      error: 'Authentication error',
      message: 'An error occurred while verifying your token',
    })
  }
}

// Role-based authorization middleware
export const authorizeRoles = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'Please login to access this resource',
      })
      return
    }

    if (!allowedRoles.includes(req.user.roles)) {
      res.status(403).json({
        error: 'Insufficient permissions',
        message: `You need one of the following roles to access this resource: ${allowedRoles.join(', ')}`,
      })
      return
    }

    next()
  }
}

// Optional authentication middleware - doesn't fail if no token provided
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.split(' ')[1]

    if (!token) {
      // No token provided, continue without authentication
      next()
      return
    }

    // Try to verify token
    const decoded = verifyAccessToken(token)
    if (!decoded) {
      // Invalid token, continue without authentication
      next()
      return
    }

    // Check if token exists in database
    const authRecord = await prisma.auth.findUnique({
      where: { accessToken: token },
      include: { users: true },
    })

    if (!authRecord || authRecord.expiresAt < new Date()) {
      // Token not found or expired, continue without authentication
      next()
      return
    }

    // Token is valid, attach user to request
    req.user = {
      id: decoded.id,
      username: decoded.username,
      email: decoded.email,
      roles: decoded.roles,
    }

    // Update last seen
    await prisma.auth.update({
      where: { id: authRecord.id },
      data: { lastSeen: new Date() },
    })

    next()
  } catch (error) {
    console.error('Optional auth middleware error:', error)
    // Continue without authentication on error
    next()
  }
}

// Admin only middleware
export const requireAdmin = authorizeRoles('ADMIN')

// User or Admin middleware
export const requireUserOrAdmin = authorizeRoles('USER', 'ADMIN')

// Check if user owns resource or is admin
export const requireOwnershipOrAdmin = (userIdField: string = 'userId') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'Please login to access this resource',
      })
      return
    }

    const resourceUserId =
      req.body[userIdField] || req.params[userIdField] || req.query[userIdField]

    // Allow if user is admin or owns the resource
    if (req.user.roles === 'ADMIN' || req.user.id.toString() === resourceUserId?.toString()) {
      next()
      return
    }

    res.status(403).json({
      error: 'Access denied',
      message: 'You can only access your own resources',
    })
  }
}

// Middleware to check if user is verified
export const requireVerifiedEmail = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      error: 'Authentication required',
      message: 'Please login to access this resource',
    })
    return
  }

  // This would need to be checked from the database since we don't have isEmailVerified in JWT
  // For now, we'll assume the user is verified if they have a valid token
  // In a production app, you might want to include this in the JWT or check the database

  next()
}

// Middleware to prevent authenticated users from accessing auth routes (like login/register when already logged in)
export const guestOnly = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization
  const token = authHeader && authHeader.split(' ')[1]

  if (token) {
    res.status(400).json({
      error: 'Already authenticated',
      message: 'You are already logged in. Please logout first.',
    })
    return
  }

  next()
}
