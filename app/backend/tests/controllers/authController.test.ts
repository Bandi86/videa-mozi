import request from 'supertest'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import authRoutes from '../../src/routes/auth.ts'
import { securityHeaders, corsOptions } from '../../src/middlewares/security.ts'
import { generateAccessToken, generateRefreshToken } from '../../src/utils/jwt/token.ts'

// Mock Prisma client
const mockPrisma = {
  users: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  auth: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
}

jest.mock('../../src/config/prisma.ts', () => ({
  default: mockPrisma,
}))

import prisma from '../../src/config/prisma.ts'

// Setup Express app for testing
const app = express()
app.use(securityHeaders)
app.use(express.json())
app.use(cors(corsOptions))
app.use('/api/v1/auth', authRoutes)

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' })
})

describe('Authentication Controller Integration Tests', () => {
  const testUser = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6fEtTT2/Dy', // 'TestPass123'
    roles: 'USER',
    isEmailVerified: true,
    created_at: new Date(),
    updated_at: new Date(),
  }

  const testAuth = {
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
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'TestPass123',
        confirmPassword: 'TestPass123',
      }

      mockPrisma.users.findFirst.mockResolvedValue(null)
      mockPrisma.users.create.mockResolvedValue({
        ...testUser,
        username: userData.username,
        email: userData.email,
        isEmailVerified: false,
      })
      mockPrisma.auth.updateMany.mockResolvedValue({ count: 1 })

      const response = await request(app).post('/api/v1/auth/register').send(userData)

      expect(response.status).toBe(201)
      expect(response.body).toHaveProperty('message')
      expect(response.body).toHaveProperty('user')
      expect(response.body.user.username).toBe(userData.username)
      expect(response.body.user.email).toBe(userData.email)
      expect(response.body.user.isEmailVerified).toBe(false)
    })

    it('should reject registration with existing email', async () => {
      const userData = {
        username: 'newuser',
        email: 'existing@example.com',
        password: 'TestPass123',
        confirmPassword: 'TestPass123',
      }

      mockPrisma.users.findFirst.mockResolvedValue(testUser)

      const response = await request(app).post('/api/v1/auth/register').send(userData)

      expect(response.status).toBe(409)
      expect(response.body.error).toBe('User already exists')
    })

    it('should reject invalid registration data', async () => {
      const invalidData = {
        username: 'us',
        email: 'invalid-email',
        password: 'weak',
        confirmPassword: 'weak',
      }

      const response = await request(app).post('/api/v1/auth/register').send(invalidData)

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Validation error')
    })
  })

  describe('POST /api/v1/auth/login', () => {
    it('should login user successfully', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'TestPass123',
      }

      mockPrisma.users.findUnique.mockResolvedValue(testUser)
      mockPrisma.auth.create.mockResolvedValue(testAuth)

      const response = await request(app).post('/api/v1/auth/login').send(loginData)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('message')
      expect(response.body).toHaveProperty('user')
      expect(response.body).toHaveProperty('tokens')
      expect(response.body.tokens).toHaveProperty('accessToken')
      expect(response.body.tokens).toHaveProperty('refreshToken')
    })

    it('should reject login with wrong password', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'WrongPassword',
      }

      mockPrisma.users.findUnique.mockResolvedValue(testUser)

      const response = await request(app).post('/api/v1/auth/login').send(loginData)

      expect(response.status).toBe(401)
      expect(response.body.error).toBe('Invalid credentials')
    })

    it('should reject login for unverified email', async () => {
      const unverifiedUser = { ...testUser, isEmailVerified: false }
      const loginData = {
        email: 'test@example.com',
        password: 'TestPass123',
      }

      mockPrisma.users.findUnique.mockResolvedValue(unverifiedUser)

      const response = await request(app).post('/api/v1/auth/login').send(loginData)

      expect(response.status).toBe(403)
      expect(response.body.error).toBe('Email not verified')
    })
  })

  describe('POST /api/v1/auth/logout', () => {
    it('should logout user successfully', async () => {
      // Mock authenticated user
      const token = generateAccessToken(testUser)
      mockPrisma.auth.findUnique.mockResolvedValue(testAuth)
      mockPrisma.auth.update.mockResolvedValue(testAuth)
      mockPrisma.auth.updateMany.mockResolvedValue({ count: 1 })

      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .send({ refreshToken: 'test-refresh-token' })

      expect(response.status).toBe(200)
      expect(response.body.message).toBe('Logout successful')
      expect(response.body.success).toBe(true)
    })

    it('should reject logout without refresh token', async () => {
      const token = generateAccessToken(testUser)
      mockPrisma.auth.findUnique.mockResolvedValue(testAuth)
      mockPrisma.auth.update.mockResolvedValue(testAuth)

      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .send({})

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Refresh token required')
    })

    it('should reject logout without authentication', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .send({ refreshToken: 'test-refresh-token' })

      expect(response.status).toBe(401)
      expect(response.body.error).toBe('Access token required')
    })
  })

  describe('POST /api/v1/auth/forgot-password', () => {
    it('should send password reset email', async () => {
      const forgotData = {
        email: 'test@example.com',
      }

      mockPrisma.users.findUnique.mockResolvedValue(testUser)
      mockPrisma.auth.updateMany.mockResolvedValue({ count: 1 })

      const response = await request(app).post('/api/v1/auth/forgot-password').send(forgotData)

      expect(response.status).toBe(200)
      expect(response.body.message).toContain('password reset link')
    })

    it('should not reveal if email exists', async () => {
      const forgotData = {
        email: 'nonexistent@example.com',
      }

      mockPrisma.users.findUnique.mockResolvedValue(null)

      const response = await request(app).post('/api/v1/auth/forgot-password').send(forgotData)

      expect(response.status).toBe(200)
      expect(response.body.message).toContain('password reset link')
    })
  })

  describe('POST /api/v1/auth/verify-email', () => {
    it('should verify email successfully', async () => {
      const verifyData = {
        token: 'valid-verification-token',
      }

      const authWithVerification = {
        ...testAuth,
        emailVerificationToken: verifyData.token,
        emailVerificationExpires: new Date(Date.now() + 60 * 1000),
      }

      mockPrisma.auth.findFirst.mockResolvedValue(authWithVerification)
      mockPrisma.users.update.mockResolvedValue(testUser)
      mockPrisma.auth.updateMany.mockResolvedValue({ count: 1 })

      const response = await request(app).post('/api/v1/auth/verify-email').send(verifyData)

      expect(response.status).toBe(200)
      expect(response.body.message).toBe('Email verified successfully')
    })

    it('should reject invalid verification token', async () => {
      const verifyData = {
        token: 'invalid-token',
      }

      mockPrisma.auth.findFirst.mockResolvedValue(null)

      const response = await request(app).post('/api/v1/auth/verify-email').send(verifyData)

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Invalid or expired verification token')
    })
  })

  describe('Protected routes', () => {
    it('should reject access without authentication', async () => {
      const response = await request(app).get('/api/v1/auth/profile')

      expect(response.status).toBe(401)
      expect(response.body.error).toBe('Access token required')
    })
  })

  describe('POST /api/v1/auth/refresh-token', () => {
    it('should refresh tokens successfully', async () => {
      const refreshToken = generateRefreshToken(testUser)
      const newAuth = {
        ...testAuth,
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        refreshExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }

      mockPrisma.auth.findUnique.mockResolvedValue(testAuth)
      mockPrisma.auth.update.mockResolvedValue(newAuth)

      const response = await request(app).post('/api/v1/auth/refresh-token').send({ refreshToken })

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('message')
      expect(response.body).toHaveProperty('tokens')
      expect(response.body.tokens).toHaveProperty('accessToken')
      expect(response.body.tokens).toHaveProperty('refreshToken')
    })

    it('should reject refresh with invalid token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh-token')
        .send({ refreshToken: 'invalid-token' })

      expect(response.status).toBe(401)
      expect(response.body.error).toBe('Invalid or expired refresh token')
    })

    it('should reject refresh without token', async () => {
      const response = await request(app).post('/api/v1/auth/refresh-token').send({})

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Refresh token required')
    })

    it('should reject refresh with expired token', async () => {
      const expiredAuth = {
        ...testAuth,
        refreshExpiresAt: new Date(Date.now() - 1000), // Expired
      }
      mockPrisma.auth.findUnique.mockResolvedValue(expiredAuth)

      const refreshToken = generateRefreshToken(testUser)
      const response = await request(app).post('/api/v1/auth/refresh-token').send({ refreshToken })

      expect(response.status).toBe(401)
      expect(response.body.error).toBe('Invalid or expired refresh token')
    })
  })

  describe('POST /api/v1/auth/reset-password', () => {
    it('should reset password successfully', async () => {
      const resetData = {
        token: 'valid-reset-token',
        password: 'NewPassword123',
        confirmPassword: 'NewPassword123',
      }

      const authWithReset = {
        ...testAuth,
        passwordResetToken: resetData.token,
        passwordResetExpires: new Date(Date.now() + 60 * 1000),
        users: testUser,
      }

      mockPrisma.auth.findFirst.mockResolvedValue(authWithReset)
      mockPrisma.users.update.mockResolvedValue(testUser)
      mockPrisma.auth.updateMany.mockResolvedValue({ count: 1 })

      const response = await request(app).post('/api/v1/auth/reset-password').send(resetData)

      expect(response.status).toBe(200)
      expect(response.body.message).toContain('Password reset successfully')
      expect(response.body.success).toBe(true)
    })

    it('should reject reset with invalid token', async () => {
      const resetData = {
        token: 'invalid-token',
        password: 'NewPassword123',
        confirmPassword: 'NewPassword123',
      }

      mockPrisma.auth.findFirst.mockResolvedValue(null)

      const response = await request(app).post('/api/v1/auth/reset-password').send(resetData)

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Invalid or expired reset token')
    })

    it('should reject reset with expired token', async () => {
      const resetData = {
        token: 'expired-token',
        password: 'NewPassword123',
        confirmPassword: 'NewPassword123',
      }

      const expiredAuth = {
        ...testAuth,
        passwordResetToken: resetData.token,
        passwordResetExpires: new Date(Date.now() - 1000), // Expired
        users: testUser,
      }

      mockPrisma.auth.findFirst.mockResolvedValue(expiredAuth)

      const response = await request(app).post('/api/v1/auth/reset-password').send(resetData)

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Invalid or expired reset token')
    })

    it('should reject reset with weak password', async () => {
      const resetData = {
        token: 'valid-reset-token',
        password: 'weak',
        confirmPassword: 'weak',
      }

      const response = await request(app).post('/api/v1/auth/reset-password').send(resetData)

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Validation error')
    })
  })

  describe('POST /api/v1/auth/change-password', () => {
    it('should change password successfully', async () => {
      const changeData = {
        currentPassword: 'TestPass123',
        newPassword: 'NewPassword123',
        confirmNewPassword: 'NewPassword123',
      }

      const token = generateAccessToken(testUser)
      mockPrisma.auth.findUnique.mockResolvedValue(testAuth)
      mockPrisma.auth.update.mockResolvedValue(testAuth)
      mockPrisma.users.findUnique.mockResolvedValue(testUser)
      mockPrisma.users.update.mockResolvedValue(testUser)
      mockPrisma.auth.updateMany.mockResolvedValue({ count: 1 })

      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send(changeData)

      expect(response.status).toBe(200)
      expect(response.body.message).toContain('Password changed successfully')
      expect(response.body.success).toBe(true)
    })

    it('should reject change without authentication', async () => {
      const changeData = {
        currentPassword: 'TestPass123',
        newPassword: 'NewPassword123',
        confirmNewPassword: 'NewPassword123',
      }

      const response = await request(app).post('/api/v1/auth/change-password').send(changeData)

      expect(response.status).toBe(401)
      expect(response.body.error).toBe('Authentication required')
    })

    it('should reject change with wrong current password', async () => {
      const changeData = {
        currentPassword: 'WrongPassword',
        newPassword: 'NewPassword123',
        confirmNewPassword: 'NewPassword123',
      }

      const token = generateAccessToken(testUser)
      mockPrisma.auth.findUnique.mockResolvedValue(testAuth)
      mockPrisma.auth.update.mockResolvedValue(testAuth)
      mockPrisma.users.findUnique.mockResolvedValue(testUser)

      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send(changeData)

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Invalid current password')
    })

    it('should reject change with weak new password', async () => {
      const changeData = {
        currentPassword: 'TestPass123',
        newPassword: 'weak',
        confirmNewPassword: 'weak',
      }

      const token = generateAccessToken(testUser)
      mockPrisma.auth.findUnique.mockResolvedValue(testAuth)
      mockPrisma.auth.update.mockResolvedValue(testAuth)

      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send(changeData)

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Validation error')
    })
  })

  describe('GET /api/v1/auth/profile', () => {
    it('should get user profile successfully', async () => {
      const token = generateAccessToken(testUser)
      const profileUser = {
        id: testUser.id,
        username: testUser.username,
        email: testUser.email,
        roles: testUser.roles,
        isEmailVerified: testUser.isEmailVerified,
        created_at: testUser.created_at,
        updated_at: testUser.updated_at,
      }

      mockPrisma.auth.findUnique.mockResolvedValue(testAuth)
      mockPrisma.auth.update.mockResolvedValue(testAuth)
      mockPrisma.users.findUnique.mockResolvedValue(profileUser)

      const response = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('user')
      expect(response.body.user.username).toBe(testUser.username)
      expect(response.body.user.email).toBe(testUser.email)
    })

    it('should reject profile access without authentication', async () => {
      const response = await request(app).get('/api/v1/auth/profile')

      expect(response.status).toBe(401)
      expect(response.body.error).toBe('Access token required')
    })

    it('should handle user not found', async () => {
      const token = generateAccessToken(testUser)
      mockPrisma.auth.findUnique.mockResolvedValue(testAuth)
      mockPrisma.auth.update.mockResolvedValue(testAuth)
      mockPrisma.users.findUnique.mockResolvedValue(null)

      const response = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(404)
      expect(response.body.error).toBe('User not found')
    })
  })

  describe('Invalid routes', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/api/v1/auth/nonexistent')

      expect(response.status).toBe(404)
      expect(response.body.error).toBe('Route not found')
    })
  })
})
