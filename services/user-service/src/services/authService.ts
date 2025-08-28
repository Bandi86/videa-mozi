import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import prisma from '../config/database.js'
import logger, { logAuthEvent, logSecurityEvent } from '../config/logger.js'
import { UserRole, UserStatus } from '@prisma/client'
import { publishEvent } from '../../../../shared/src/messaging/publishers.js'
import { UserCreatedEvent } from '../../../../shared/src/messaging/events.js'

export interface RegisterData {
  email: string
  username: string
  password: string
  firstName?: string
  lastName?: string
  displayName?: string
}

export interface LoginData {
  emailOrUsername: string
  password: string
  deviceInfo?: any
  ipAddress?: string
  userAgent?: string
}

export interface JWTPayload {
  id: string
  email: string
  username: string
  role: UserRole
  status: UserStatus
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresAt: Date
  refreshExpiresAt: Date
}

export class AuthService {
  private jwtAccessSecret: string
  private jwtRefreshSecret: string
  private jwtAccessExpiresIn: string
  private jwtRefreshExpiresIn: string

  constructor() {
    this.jwtAccessSecret = process.env.JWT_ACCESS_SECRET || 'default-access-secret-key'
    this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'default-refresh-secret-key'
    this.jwtAccessExpiresIn = process.env.JWT_ACCESS_EXPIRES_IN || '15m'
    this.jwtRefreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d'

    if (
      this.jwtAccessSecret === 'default-access-secret-key' ||
      this.jwtRefreshSecret === 'default-refresh-secret-key'
    ) {
      logger.warn(
        'Using default JWT secrets - please set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET environment variables',
      )
    }
  }

  /**
   * Register a new user
   */
  async register(data: RegisterData): Promise<any> {
    try {
      const { email, username, password, firstName, lastName, displayName } = data

      // Check if user already exists
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }],
        },
      })

      if (existingUser) {
        if (existingUser.email === email.toLowerCase()) {
          throw new Error('Email already registered')
        }
        if (existingUser.username === username.toLowerCase()) {
          throw new Error('Username already taken')
        }
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12)

      // Create user
      const user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          username: username.toLowerCase(),
          password: hashedPassword,
          firstName,
          lastName,
          displayName: displayName || `${firstName || ''} ${lastName || ''}`.trim() || username,
        },
        select: {
          id: true,
          email: true,
          username: true,
          displayName: true,
          firstName: true,
          lastName: true,
          role: true,
          status: true,
          isEmailVerified: true,
          createdAt: true,
        },
      })

      logAuthEvent('user_registered', {
        userId: user.id,
        email: user.email,
        username: user.username,
        ipAddress: data.ipAddress,
      })

      // Publish user created event
      const userCreatedEvent: UserCreatedEvent = {
        eventId: crypto.randomUUID(),
        eventType: 'user.created',
        timestamp: new Date().toISOString(),
        source: 'user-service',
        version: '1.0',
        data: {
          userId: user.id,
          email: user.email,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
          status: user.status,
          visibility: user.visibility,
          createdAt: user.createdAt.toISOString(),
        },
      }

      await publishEvent(userCreatedEvent)
      logger.info(`📤 Published user.created event for user ${user.id}`)

      return user
    } catch (error: any) {
      logger.error('Register user error:', error)
      throw error
    }
  }

  /**
   * Login user
   */
  async login(data: LoginData): Promise<{ user: any; tokens: AuthTokens }> {
    try {
      const { emailOrUsername, password, deviceInfo, ipAddress, userAgent } = data

      // Find user
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: emailOrUsername.toLowerCase() },
            { username: emailOrUsername.toLowerCase() },
          ],
        },
      })

      if (!user) {
        logSecurityEvent('login_failed_user_not_found', {
          emailOrUsername,
          ipAddress,
          userAgent,
        })
        throw new Error('Invalid credentials')
      }

      // Check if user is active
      if (user.status !== UserStatus.ACTIVE) {
        logSecurityEvent('login_failed_user_inactive', {
          userId: user.id,
          status: user.status,
          ipAddress,
        })
        throw new Error('Account is not active')
      }

      // Check password
      const isPasswordValid = await bcrypt.compare(password, user.password)
      if (!isPasswordValid) {
        logSecurityEvent('login_failed_wrong_password', {
          userId: user.id,
          ipAddress,
          userAgent,
        })
        throw new Error('Invalid credentials')
      }

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
          lastActiveAt: new Date(),
        },
      })

      // Generate tokens
      const tokens = await this.generateTokens(user)

      // Create auth session
      await prisma.authSession.create({
        data: {
          userId: user.id,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          deviceInfo,
          ipAddress,
          userAgent,
          expiresAt: tokens.expiresAt,
          refreshExpiresAt: tokens.refreshExpiresAt,
        },
      })

      logAuthEvent('user_logged_in', {
        userId: user.id,
        email: user.email,
        username: user.username,
        ipAddress,
        userAgent,
      })

      return {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
          status: user.status,
          avatarUrl: user.avatarUrl,
          isEmailVerified: user.isEmailVerified,
        },
        tokens,
      }
    } catch (error: any) {
      logger.error('Login user error:', error)
      throw error
    }
  }

  /**
   * Logout user (invalidate tokens)
   */
  async logout(userId: string, accessToken: string): Promise<void> {
    try {
      await prisma.authSession.updateMany({
        where: {
          userId,
          accessToken,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      })

      logAuthEvent('user_logged_out', {
        userId,
        accessToken: accessToken.substring(0, 10) + '...',
      })
    } catch (error: any) {
      logger.error('Logout user error:', error)
      throw new Error('Failed to logout')
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, this.jwtRefreshSecret) as JWTPayload

      // Check if session exists and is active
      const session = await prisma.authSession.findFirst({
        where: {
          refreshToken,
          userId: decoded.id,
          isActive: true,
        },
        include: {
          user: true,
        },
      })

      if (!session || !session.user) {
        throw new Error('Invalid refresh token')
      }

      // Check if user is still active
      if (session.user.status !== UserStatus.ACTIVE) {
        throw new Error('User account is not active')
      }

      // Generate new tokens
      const tokens = await this.generateTokens(session.user)

      // Update session
      await prisma.authSession.update({
        where: { id: session.id },
        data: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
          refreshExpiresAt: tokens.refreshExpiresAt,
          lastUsedAt: new Date(),
        },
      })

      logAuthEvent('token_refreshed', {
        userId: session.userId,
        sessionId: session.id,
      })

      return tokens
    } catch (error: any) {
      logger.error('Refresh token error:', error)
      throw new Error('Invalid refresh token')
    }
  }

  /**
   * Verify access token
   */
  async verifyToken(token: string): Promise<JWTPayload> {
    try {
      const decoded = jwt.verify(token, this.jwtAccessSecret) as JWTPayload

      // Check if session exists and is active
      const session = await prisma.authSession.findFirst({
        where: {
          accessToken: token,
          userId: decoded.id,
          isActive: true,
        },
      })

      if (!session) {
        throw new Error('Token not found or inactive')
      }

      // Update last used
      await prisma.authSession.update({
        where: { id: session.id },
        data: {
          lastUsedAt: new Date(),
        },
      })

      return decoded
    } catch (error: any) {
      logger.error('Verify token error:', error)
      throw new Error('Invalid access token')
    }
  }

  /**
   * Generate JWT tokens
   */
  private async generateTokens(user: any): Promise<AuthTokens> {
    const payload: JWTPayload = {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      status: user.status,
    }

    const accessToken = jwt.sign(payload, this.jwtAccessSecret, {
      expiresIn: this.jwtAccessExpiresIn,
    })

    const refreshToken = jwt.sign(payload, this.jwtRefreshSecret, {
      expiresIn: this.jwtRefreshExpiresIn,
    })

    // Calculate expiration dates
    const expiresAt = new Date(Date.now() + this.parseTime(this.jwtAccessExpiresIn))
    const refreshExpiresAt = new Date(Date.now() + this.parseTime(this.jwtRefreshExpiresIn))

    return {
      accessToken,
      refreshToken,
      expiresAt,
      refreshExpiresAt,
    }
  }

  /**
   * Parse time string to milliseconds
   */
  private parseTime(timeStr: string): number {
    const unit = timeStr.slice(-1)
    const value = parseInt(timeStr.slice(0, -1))

    switch (unit) {
      case 's':
        return value * 1000
      case 'm':
        return value * 60 * 1000
      case 'h':
        return value * 60 * 60 * 1000
      case 'd':
        return value * 24 * 60 * 60 * 1000
      default:
        return 15 * 60 * 1000 // Default 15 minutes
    }
  }

  /**
   * Generate email verification token
   */
  async generateEmailVerificationToken(userId: string): Promise<string> {
    try {
      const token = crypto.randomBytes(32).toString('hex')
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

      await prisma.user.update({
        where: { id: userId },
        data: {
          emailVerificationToken: token,
          emailVerificationExpires: expiresAt,
        },
      })

      return token
    } catch (error: any) {
      logger.error('Generate email verification token error:', error)
      throw new Error('Failed to generate verification token')
    }
  }

  /**
   * Verify email
   */
  async verifyEmail(token: string): Promise<any> {
    try {
      const user = await prisma.user.findFirst({
        where: {
          emailVerificationToken: token,
          emailVerificationExpires: {
            gt: new Date(),
          },
        },
      })

      if (!user) {
        throw new Error('Invalid or expired verification token')
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          isEmailVerified: true,
          emailVerificationToken: null,
          emailVerificationExpires: null,
        },
      })

      logAuthEvent('email_verified', {
        userId: user.id,
        email: user.email,
      })

      return {
        id: user.id,
        email: user.email,
        username: user.username,
        isEmailVerified: true,
      }
    } catch (error: any) {
      logger.error('Verify email error:', error)
      throw error
    }
  }

  /**
   * Generate password reset token
   */
  async generatePasswordResetToken(email: string): Promise<string> {
    try {
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      })

      if (!user) {
        throw new Error('User not found')
      }

      const token = crypto.randomBytes(32).toString('hex')
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: token,
          passwordResetExpires: expiresAt,
        },
      })

      logAuthEvent('password_reset_requested', {
        userId: user.id,
        email: user.email,
      })

      return token
    } catch (error: any) {
      logger.error('Generate password reset token error:', error)
      throw error
    }
  }

  /**
   * Reset password
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    try {
      const user = await prisma.user.findFirst({
        where: {
          passwordResetToken: token,
          passwordResetExpires: {
            gt: new Date(),
          },
        },
      })

      if (!user) {
        throw new Error('Invalid or expired reset token')
      }

      const hashedPassword = await bcrypt.hash(newPassword, 12)

      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          passwordResetToken: null,
          passwordResetExpires: null,
        },
      })

      // Invalidate all sessions
      await prisma.authSession.updateMany({
        where: { userId: user.id },
        data: { isActive: false },
      })

      logAuthEvent('password_reset', {
        userId: user.id,
        email: user.email,
      })
    } catch (error: any) {
      logger.error('Reset password error:', error)
      throw error
    }
  }

  /**
   * Change password
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      })

      if (!user) {
        throw new Error('User not found')
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password)
      if (!isCurrentPasswordValid) {
        throw new Error('Current password is incorrect')
      }

      const hashedPassword = await bcrypt.hash(newPassword, 12)

      await prisma.user.update({
        where: { id: userId },
        data: {
          password: hashedPassword,
        },
      })

      // Invalidate all sessions except current
      await prisma.authSession.updateMany({
        where: {
          userId,
          isActive: true,
        },
        data: { isActive: false },
      })

      logAuthEvent('password_changed', {
        userId,
        email: user.email,
      })
    } catch (error: any) {
      logger.error('Change password error:', error)
      throw error
    }
  }

  /**
   * Get user sessions
   */
  async getUserSessions(userId: string): Promise<any[]> {
    try {
      const sessions = await prisma.authSession.findMany({
        where: {
          userId,
          isActive: true,
        },
        select: {
          id: true,
          deviceInfo: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
          lastUsedAt: true,
          expiresAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      })

      return sessions
    } catch (error: any) {
      logger.error('Get user sessions error:', error)
      throw new Error('Failed to get user sessions')
    }
  }

  /**
   * Revoke session
   */
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    try {
      const session = await prisma.authSession.findFirst({
        where: {
          id: sessionId,
          userId,
        },
      })

      if (!session) {
        throw new Error('Session not found')
      }

      await prisma.authSession.update({
        where: { id: sessionId },
        data: { isActive: false },
      })

      logAuthEvent('session_revoked', {
        userId,
        sessionId,
      })
    } catch (error: any) {
      logger.error('Revoke session error:', error)
      throw new Error('Failed to revoke session')
    }
  }

  /**
   * Revoke all user sessions
   */
  async revokeAllSessions(userId: string): Promise<void> {
    try {
      await prisma.authSession.updateMany({
        where: { userId },
        data: { isActive: false },
      })

      logAuthEvent('all_sessions_revoked', {
        userId,
      })
    } catch (error: any) {
      logger.error('Revoke all sessions error:', error)
      throw new Error('Failed to revoke all sessions')
    }
  }
}

export const authService = new AuthService()
