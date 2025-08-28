import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import axios from 'axios'

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'your-secret-key'

// Extend Request interface
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number
        email: string
        username: string
        roles: string
      }
    }
  }
}

/**
 * Authentication middleware
 * Verifies JWT token and validates user with User Service
 */
export const authenticateToken = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

    if (!token) {
      _res.status(401).json({
        error: 'Authentication required',
        message: 'Please provide a valid authentication token.',
      })
      return
    }

    // Verify JWT token
    const decoded = jwt.verify(token, JWT_ACCESS_SECRET) as any

    // Validate token with User Service
    try {
      const userServiceUrl = process.env.USER_SERVICE_URL || 'http://localhost:3002'
      const response = await axios.get(`${userServiceUrl}/api/v1/auth/validate`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        timeout: 5000, // 5 second timeout
      })

      if (response.data.valid) {
        req.user = {
          id: decoded.userId || decoded.id,
          email: decoded.email,
          username: decoded.username,
          roles: decoded.roles,
        }
        next()
      } else {
        _res.status(401).json({
          error: 'Invalid token',
          message: 'The provided authentication token is invalid or expired.',
        })
      }
    } catch (error) {
      console.error('User service validation error:', error)
      _res.status(503).json({
        error: 'Authentication service unavailable',
        message: 'Unable to validate authentication token. Please try again later.',
      })
    }
  } catch (error) {
    console.error('JWT verification error:', error)
    _res.status(401).json({
      error: 'Invalid token format',
      message: 'The provided authentication token has an invalid format.',
    })
  }
}

/**
 * Optional authentication middleware
 * Sets user info if token is provided, but doesn't require it
 */
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.split(' ')[1]

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_ACCESS_SECRET) as any
        req.user = {
          id: decoded.userId || decoded.id,
          email: decoded.email,
          username: decoded.username,
          roles: decoded.roles,
        }
      } catch (error) {
        // Ignore invalid tokens for optional auth
        console.warn('Invalid token in optional auth:', error)
      }
    }

    next()
  } catch (error) {
    // Continue without authentication for optional auth
    next()
  }
}

/**
 * Admin role middleware
 * Requires user to have admin role
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      error: 'Authentication required',
      message: 'Please provide authentication credentials.',
    })
    return
  }

  if (req.user.roles !== 'ADMIN') {
    res.status(403).json({
      error: 'Insufficient privileges',
      message: 'Admin privileges required for this operation.',
    })
    return
  }

  next()
}

/**
 * Moderator role middleware
 * Requires user to have admin or moderator role
 */
export const requireModerator = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      error: 'Authentication required',
      message: 'Please provide authentication credentials.',
    })
    return
  }

  if (req.user.roles !== 'ADMIN' && req.user.roles !== 'MODERATOR') {
    res.status(403).json({
      error: 'Insufficient privileges',
      message: 'Moderator privileges required for this operation.',
    })
    return
  }

  next()
}

/**
 * User ownership middleware
 * Checks if the authenticated user owns the resource
 */
export const requireOwnership = (userIdParam: string = 'userId') => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      _res.status(401).json({
        error: 'Authentication required',
        message: 'Please provide authentication credentials.',
      })
      return
    }

    const resourceUserId = parseInt(req.params[userIdParam])
    const authenticatedUserId = req.user.id

    if (resourceUserId !== authenticatedUserId && req.user.roles !== 'ADMIN') {
      _res.status(403).json({
        error: 'Access denied',
        message: 'You can only access your own resources.',
      })
      return
    }

    next()
  }
}
