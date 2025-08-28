import {
  storeRefreshToken,
  findRefreshToken,
  verifyAndRotateToken,
  invalidateRefreshToken,
  invalidateAllUserTokens,
} from '../../src/services/tokenService.ts'
import { generateAccessToken, generateRefreshToken } from '../../src/utils/jwt/token.ts'

// Mock Prisma client
const mockPrisma = {
  auth: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    findUnique: jest.fn(),
    deleteMany: jest.fn(),
  },
  users: {
    findUnique: jest.fn(),
  },
}

jest.mock('../../src/config/prisma.ts', () => ({
  default: mockPrisma,
}))

import prisma from '../../src/config/prisma.ts'

describe('Token Service', () => {
  const mockUser = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    roles: 'USER',
  }

  const mockAuth = {
    id: 1,
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
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

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('storeRefreshToken', () => {
    it('should create new auth record for new user', async () => {
      mockPrisma.auth.findFirst.mockResolvedValue(null)
      mockPrisma.auth.create.mockResolvedValue(mockAuth)

      const refreshToken = 'test-refresh-token'
      const expiryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

      const result = await storeRefreshToken(1, refreshToken, expiryDate)

      expect(mockPrisma.auth.findFirst).toHaveBeenCalledWith({
        where: { userId: 1 },
        include: { users: true },
      })
      expect(mockPrisma.auth.create).toHaveBeenCalled()
      expect(result).toHaveProperty('accessToken')
      expect(result).toHaveProperty('refreshToken')
      expect(result).toHaveProperty('expiresAt')
      expect(result).toHaveProperty('refreshExpiresAt')
    })

    it('should update existing auth record', async () => {
      mockPrisma.auth.findFirst.mockResolvedValue(mockAuth)
      mockPrisma.auth.update.mockResolvedValue(mockAuth)

      const refreshToken = 'test-refresh-token'
      const expiryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

      const result = await storeRefreshToken(1, refreshToken, expiryDate)

      expect(mockPrisma.auth.findFirst).toHaveBeenCalledWith({
        where: { userId: 1 },
        include: { users: true },
      })
      expect(mockPrisma.auth.update).toHaveBeenCalled()
      expect(result).toHaveProperty('accessToken')
      expect(result).toHaveProperty('refreshToken')
    })

    it('should throw error if user not found', async () => {
      mockPrisma.auth.findFirst.mockResolvedValue(null)
      mockPrisma.users.findUnique.mockResolvedValue(null)

      const refreshToken = 'test-refresh-token'
      const expiryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

      await expect(storeRefreshToken(999, refreshToken, expiryDate)).rejects.toThrow(
        'User not found',
      )
    })
  })

  describe('findRefreshToken', () => {
    it('should find refresh token', async () => {
      mockPrisma.auth.findUnique.mockResolvedValue(mockAuth)

      const result = await findRefreshToken('test-refresh-token')

      expect(mockPrisma.auth.findUnique).toHaveBeenCalledWith({
        where: { refreshToken: 'test-refresh-token' },
        include: { users: true },
      })
      expect(result).toEqual(mockAuth)
    })

    it('should return null if token not found', async () => {
      mockPrisma.auth.findUnique.mockResolvedValue(null)

      const result = await findRefreshToken('nonexistent-token')

      expect(result).toBeNull()
    })
  })

  describe('verifyAndRotateToken', () => {
    it('should verify and rotate valid token', async () => {
      const validRefreshToken = generateRefreshToken(mockUser)
      mockPrisma.auth.findUnique.mockResolvedValue(mockAuth)
      mockPrisma.auth.update.mockResolvedValue(mockAuth)

      const result = await verifyAndRotateToken(validRefreshToken)

      expect(result).toHaveProperty('accessToken')
      expect(result).toHaveProperty('refreshToken')
      expect(result).toHaveProperty('expiresAt')
      expect(result).toHaveProperty('refreshExpiresAt')
      expect(mockPrisma.auth.update).toHaveBeenCalled()
    })

    it('should return null for invalid token', async () => {
      const result = await verifyAndRotateToken('invalid-token')
      expect(result).toBeNull()
    })

    it('should return null for expired token', async () => {
      const expiredAuth = {
        ...mockAuth,
        refreshExpiresAt: new Date(Date.now() - 1000), // Expired
      }
      mockPrisma.auth.findUnique.mockResolvedValue(expiredAuth)

      const validRefreshToken = generateRefreshToken(mockUser)
      const result = await verifyAndRotateToken(validRefreshToken)

      expect(result).toBeNull()
    })

    it('should return null if token not found in database', async () => {
      mockPrisma.auth.findUnique.mockResolvedValue(null)

      const validRefreshToken = generateRefreshToken(mockUser)
      const result = await verifyAndRotateToken(validRefreshToken)

      expect(result).toBeNull()
    })
  })

  describe('invalidateRefreshToken', () => {
    it('should invalidate refresh token', async () => {
      mockPrisma.auth.updateMany.mockResolvedValue({ count: 1 })

      const result = await invalidateRefreshToken('test-refresh-token')

      expect(mockPrisma.auth.updateMany).toHaveBeenCalledWith({
        where: { refreshToken: 'test-refresh-token' },
        data: {
          refreshToken: 'INVALIDATED',
          isOnline: false,
        },
      })
      expect(result).toBe(true)
    })

    it('should return false if token not found', async () => {
      mockPrisma.auth.updateMany.mockResolvedValue({ count: 0 })

      const result = await invalidateRefreshToken('nonexistent-token')

      expect(result).toBe(false)
    })
  })

  describe('invalidateAllUserTokens', () => {
    it('should invalidate all user tokens', async () => {
      mockPrisma.auth.updateMany.mockResolvedValue({ count: 2 })

      const result = await invalidateAllUserTokens(1)

      expect(mockPrisma.auth.updateMany).toHaveBeenCalledWith({
        where: { userId: 1 },
        data: {
          refreshToken: 'INVALIDATED',
          accessToken: 'INVALIDATED',
          isOnline: false,
        },
      })
      expect(result).toBe(true)
    })

    it('should return false if no tokens found', async () => {
      mockPrisma.auth.updateMany.mockResolvedValue({ count: 0 })

      const result = await invalidateAllUserTokens(999)

      expect(result).toBe(false)
    })
  })
})
