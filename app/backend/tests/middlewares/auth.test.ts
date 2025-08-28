import { Request, Response, NextFunction } from 'express'
import {
  authenticateToken,
  authorizeRoles,
  optionalAuth,
  requireAdmin,
  requireOwnershipOrAdmin,
  guestOnly,
} from '../../src/middlewares/auth.ts'
import { generateAccessToken } from '../../src/utils/jwt/token.ts'

// Mock Prisma client
const mockPrisma = {
  auth: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
}

jest.mock('../../src/config/prisma.ts', () => ({
  default: mockPrisma,
}))

import prisma from '../../src/config/prisma.ts'

describe('Authentication Middleware', () => {
  let mockRequest: Partial<Request>
  let mockResponse: Partial<Response>
  let mockNext: NextFunction

  const mockUser = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    roles: 'USER',
  }

  beforeEach(() => {
    mockRequest = {
      headers: {},
      body: {},
      params: {},
      query: {},
    }
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }
    mockNext = jest.fn()
    jest.clearAllMocks()
  })

  describe('authenticateToken', () => {
    it('should authenticate valid token', async () => {
      const token = generateAccessToken(mockUser)
      mockRequest.headers!.authorization = `Bearer ${token}`

      const mockAuth = {
        id: 1,
        accessToken: token,
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        refreshExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        userId: 1,
        isOnline: true,
        lastSeen: new Date(),
        passwordResetToken: null,
        passwordResetExpires: null,
        emailVerificationToken: null,
        emailVerificationExpires: null,
        users: mockUser,
      }

      mockPrisma.auth.findUnique.mockResolvedValue(mockAuth)
      mockPrisma.auth.update.mockResolvedValue(mockAuth)

      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext)

      expect(mockRequest.user).toEqual(mockUser)
      expect(mockNext).toHaveBeenCalled()
      expect(mockPrisma.auth.update).toHaveBeenCalled()
    })

    it('should reject missing token', async () => {
      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext)

      expect(mockResponse.status).toHaveBeenCalledWith(401)
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Access token required',
        message: 'Please provide an access token in the Authorization header',
      })
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should reject invalid token', async () => {
      mockRequest.headers!.authorization = 'Bearer invalid-token'

      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext)

      expect(mockResponse.status).toHaveBeenCalledWith(403)
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid or expired token',
        message: 'The provided access token is invalid or has expired',
      })
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should reject expired token', async () => {
      const token = generateAccessToken(mockUser)
      mockRequest.headers!.authorization = `Bearer ${token}`

      mockPrisma.auth.findUnique.mockResolvedValue(null)

      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext)

      expect(mockResponse.status).toHaveBeenCalledWith(403)
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Token not found',
        message: 'The provided token was not found in our records',
      })
      expect(mockNext).not.toHaveBeenCalled()
    })
  })

  describe('authorizeRoles', () => {
    it('should authorize user with correct role', () => {
      mockRequest.user = mockUser

      const middleware = authorizeRoles('USER')
      middleware(mockRequest as Request, mockResponse as Response, mockNext)

      expect(mockNext).toHaveBeenCalled()
    })

    it('should reject user with insufficient permissions', () => {
      mockRequest.user = mockUser

      const middleware = authorizeRoles('ADMIN')
      middleware(mockRequest as Request, mockResponse as Response, mockNext)

      expect(mockResponse.status).toHaveBeenCalledWith(403)
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Insufficient permissions',
        message: 'You need one of the following roles to access this resource: ADMIN',
      })
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should reject unauthenticated user', () => {
      const middleware = authorizeRoles('USER')
      middleware(mockRequest as Request, mockResponse as Response, mockNext)

      expect(mockResponse.status).toHaveBeenCalledWith(401)
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Authentication required',
        message: 'Please login to access this resource',
      })
      expect(mockNext).not.toHaveBeenCalled()
    })
  })

  describe('optionalAuth', () => {
    it('should continue without authentication when no token provided', async () => {
      await optionalAuth(mockRequest as Request, mockResponse as Response, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(mockRequest.user).toBeUndefined()
    })

    it('should authenticate valid token', async () => {
      const token = generateAccessToken(mockUser)
      mockRequest.headers!.authorization = `Bearer ${token}`

      const mockAuth = {
        id: 1,
        accessToken: token,
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        refreshExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        userId: 1,
        isOnline: true,
        lastSeen: new Date(),
        passwordResetToken: null,
        passwordResetExpires: null,
        emailVerificationToken: null,
        emailVerificationExpires: null,
        users: mockUser,
      }

      mockPrisma.auth.findUnique.mockResolvedValue(mockAuth)
      mockPrisma.auth.update.mockResolvedValue(mockAuth)

      await optionalAuth(mockRequest as Request, mockResponse as Response, mockNext)

      expect(mockRequest.user).toEqual(mockUser)
      expect(mockNext).toHaveBeenCalled()
    })

    it('should continue without authentication for invalid token', async () => {
      mockRequest.headers!.authorization = 'Bearer invalid-token'

      await optionalAuth(mockRequest as Request, mockResponse as Response, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(mockRequest.user).toBeUndefined()
    })
  })

  describe('requireAdmin', () => {
    it('should allow admin user', () => {
      mockRequest.user = { ...mockUser, roles: 'ADMIN' }

      requireAdmin(mockRequest as Request, mockResponse as Response, mockNext)

      expect(mockNext).toHaveBeenCalled()
    })

    it('should reject non-admin user', () => {
      mockRequest.user = mockUser

      requireAdmin(mockRequest as Request, mockResponse as Response, mockNext)

      expect(mockResponse.status).toHaveBeenCalledWith(403)
      expect(mockNext).not.toHaveBeenCalled()
    })
  })

  describe('requireOwnershipOrAdmin', () => {
    it('should allow resource owner', () => {
      mockRequest.user = mockUser
      mockRequest.params!.userId = '1'

      const middleware = requireOwnershipOrAdmin('userId')
      middleware(mockRequest as Request, mockResponse as Response, mockNext)

      expect(mockNext).toHaveBeenCalled()
    })

    it('should allow admin user', () => {
      mockRequest.user = { ...mockUser, roles: 'ADMIN' }
      mockRequest.params!.userId = '999'

      const middleware = requireOwnershipOrAdmin('userId')
      middleware(mockRequest as Request, mockResponse as Response, mockNext)

      expect(mockNext).toHaveBeenCalled()
    })

    it('should reject non-owner non-admin user', () => {
      mockRequest.user = mockUser
      mockRequest.params!.userId = '999'

      const middleware = requireOwnershipOrAdmin('userId')
      middleware(mockRequest as Request, mockResponse as Response, mockNext)

      expect(mockResponse.status).toHaveBeenCalledWith(403)
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Access denied',
        message: 'You can only access your own resources',
      })
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should reject unauthenticated user', () => {
      const middleware = requireOwnershipOrAdmin('userId')
      middleware(mockRequest as Request, mockResponse as Response, mockNext)

      expect(mockResponse.status).toHaveBeenCalledWith(401)
      expect(mockNext).not.toHaveBeenCalled()
    })
  })

  describe('guestOnly', () => {
    it('should allow unauthenticated user', () => {
      guestOnly(mockRequest as Request, mockResponse as Response, mockNext)

      expect(mockNext).toHaveBeenCalled()
    })

    it('should reject authenticated user', () => {
      mockRequest.headers!.authorization = 'Bearer some-token'

      guestOnly(mockRequest as Request, mockResponse as Response, mockNext)

      expect(mockResponse.status).toHaveBeenCalledWith(400)
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Already authenticated',
        message: 'You are already logged in. Please logout first.',
      })
      expect(mockNext).not.toHaveBeenCalled()
    })
  })
})
