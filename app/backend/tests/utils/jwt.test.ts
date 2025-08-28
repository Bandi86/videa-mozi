import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateEmailVerificationToken,
  generatePasswordResetToken,
} from '../../src/utils/jwt/token.ts'

describe('JWT Token Utilities', () => {
  const mockUser = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    roles: 'USER',
  }

  describe('generateAccessToken', () => {
    it('should generate a valid access token', () => {
      const token = generateAccessToken(mockUser)

      expect(typeof token).toBe('string')
      expect(token.length).toBeGreaterThan(0)
    })

    it('should generate tokens with correct payload', () => {
      const token = generateAccessToken(mockUser)
      const decoded = verifyAccessToken(token)

      expect(decoded).toBeTruthy()
      expect(decoded!.id).toBe(mockUser.id)
      expect(decoded!.username).toBe(mockUser.username)
      expect(decoded!.email).toBe(mockUser.email)
      expect(decoded!.roles).toBe(mockUser.roles)
      expect(decoded!.type).toBe('access')
    })
  })

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token', () => {
      const token = generateRefreshToken(mockUser)

      expect(typeof token).toBe('string')
      expect(token.length).toBeGreaterThan(0)
    })

    it('should generate tokens with correct payload', () => {
      const token = generateRefreshToken(mockUser)
      const decoded = verifyRefreshToken(token)

      expect(decoded).toBeTruthy()
      expect(decoded!.id).toBe(mockUser.id)
      expect(decoded!.username).toBe(mockUser.username)
      expect(decoded!.email).toBe(mockUser.email)
      expect(decoded!.roles).toBe(mockUser.roles)
      expect(decoded!.type).toBe('refresh')
    })
  })

  describe('verifyAccessToken', () => {
    it('should verify a valid access token', () => {
      const token = generateAccessToken(mockUser)
      const decoded = verifyAccessToken(token)

      expect(decoded).toBeTruthy()
      expect(decoded!.type).toBe('access')
    })

    it('should return null for invalid token', () => {
      const decoded = verifyAccessToken('invalid-token')
      expect(decoded).toBeNull()
    })

    it('should return null for refresh token when expecting access token', () => {
      const refreshToken = generateRefreshToken(mockUser)
      const decoded = verifyAccessToken(refreshToken)
      expect(decoded).toBeNull()
    })

    it('should return null for expired token', () => {
      // Create an expired token by manually setting exp to past time
      const jwt = require('jsonwebtoken')
      const expiredToken = jwt.sign(
        {
          id: mockUser.id,
          username: mockUser.username,
          email: mockUser.email,
          roles: mockUser.roles,
          type: 'access',
          exp: Math.floor(Date.now() / 1000) - 60, // Expired 1 minute ago
          iat: Math.floor(Date.now() / 1000) - 120,
        },
        process.env.JWT_ACCESS_SECRET,
      )

      const decoded = verifyAccessToken(expiredToken)
      expect(decoded).toBeNull()
    })
  })

  describe('verifyRefreshToken', () => {
    it('should verify a valid refresh token', () => {
      const token = generateRefreshToken(mockUser)
      const decoded = verifyRefreshToken(token)

      expect(decoded).toBeTruthy()
      expect(decoded!.type).toBe('refresh')
    })

    it('should return null for invalid token', () => {
      const decoded = verifyRefreshToken('invalid-token')
      expect(decoded).toBeNull()
    })

    it('should return null for access token when expecting refresh token', () => {
      const accessToken = generateAccessToken(mockUser)
      const decoded = verifyRefreshToken(accessToken)
      expect(decoded).toBeNull()
    })
  })

  describe('generateEmailVerificationToken', () => {
    it('should generate a random token', () => {
      const token1 = generateEmailVerificationToken()
      const token2 = generateEmailVerificationToken()

      expect(typeof token1).toBe('string')
      expect(token1.length).toBeGreaterThan(0)
      expect(token1).not.toBe(token2) // Should be different
    })

    it('should generate hex string', () => {
      const token = generateEmailVerificationToken()
      expect(/^[a-f0-9]+$/i.test(token)).toBe(true)
    })
  })

  describe('generatePasswordResetToken', () => {
    it('should generate a random token', () => {
      const token1 = generatePasswordResetToken()
      const token2 = generatePasswordResetToken()

      expect(typeof token1).toBe('string')
      expect(token1.length).toBeGreaterThan(0)
      expect(token1).not.toBe(token2) // Should be different
    })

    it('should generate hex string', () => {
      const token = generatePasswordResetToken()
      expect(/^[a-f0-9]+$/i.test(token)).toBe(true)
    })
  })

  describe('Token Types', () => {
    it('should distinguish between access and refresh tokens', () => {
      const accessToken = generateAccessToken(mockUser)
      const refreshToken = generateRefreshToken(mockUser)

      const accessDecoded = verifyAccessToken(accessToken)
      const refreshDecoded = verifyRefreshToken(refreshToken)

      expect(accessDecoded!.type).toBe('access')
      expect(refreshDecoded!.type).toBe('refresh')

      // Cross-verification should fail
      expect(verifyRefreshToken(accessToken)).toBeNull()
      expect(verifyAccessToken(refreshToken)).toBeNull()
    })
  })
})
