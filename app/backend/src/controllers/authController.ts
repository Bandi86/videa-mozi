import { Request, Response } from 'express'
import * as bcrypt from 'bcrypt'
import prisma from '../config/prisma.js'
import {
  generateAccessToken,
  generateRefreshToken,
  generateEmailVerificationToken,
  generatePasswordResetToken,
  verifyAccessToken,
} from '../utils/jwt/token.js'
import {
  storeRefreshToken,
  verifyAndRotateToken,
  invalidateRefreshToken,
  invalidateAllUserTokens,
  storePasswordResetToken,
  verifyPasswordResetToken,
  clearPasswordResetToken,
  storeEmailVerificationToken,
  verifyEmailVerificationToken,
  clearEmailVerificationToken,
} from '../services/tokenService.js'
import {
  sendEmailVerification,
  sendPasswordReset,
  sendPasswordChangedNotification,
} from '../utils/email.js'
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from '../validators/authValidators.js'
import {
  logAuthEvent,
  logSecurityEvent,
  logEmailEvent,
  logBusinessEvent,
} from '../config/logger.js'

// Register user
const register = async (req: Request, res: Response) => {
  try {
    // Validate input
    const validatedData = registerSchema.parse(req.body)
    const { username, email, password } = validatedData

    // Check if user already exists
    const existingUser = await prisma.users.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    })

    if (existingUser) {
      return res.status(409).json({
        error: 'User already exists',
        message:
          existingUser.email === email ? 'Email already registered' : 'Username already taken',
      })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Create user
    const user = await prisma.users.create({
      data: {
        username,
        email,
        password: hashedPassword,
        isEmailVerified: false,
      },
    })

    // Log successful registration
    logBusinessEvent('user_registered', 'user', user.id, {
      username: user.username,
      email: user.email,
      ip: req.ip,
    })

    // Generate email verification token
    const verificationToken = generateEmailVerificationToken()
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Store verification token
    await storeEmailVerificationToken(user.id, verificationToken, verificationExpiry)

    // Send verification email
    const emailSent = await sendEmailVerification(email, username, verificationToken)

    if (!emailSent) {
      console.warn('Failed to send verification email, but user was created')
    }

    res.status(201).json({
      message: 'User registered successfully. Please check your email for verification.',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        roles: user.roles,
        isEmailVerified: user.isEmailVerified,
      },
      emailSent,
    })
  } catch (error) {
    console.error('Registration error:', error)

    if (error instanceof Error && error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation error',
        details: error.message,
      })
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'Registration failed. Please try again.',
    })
  }
}

// Login user
const login = async (req: Request, res: Response) => {
  try {
    // Validate input
    const validatedData = loginSchema.parse(req.body)
    const { email, password } = validatedData

    // Find user
    const user = await prisma.users.findUnique({
      where: { email },
    })

    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
      })
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
      })
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      logSecurityEvent('login_attempt_unverified_email', 'medium', {
        email: user.email,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      })
      return res.status(403).json({
        error: 'Email not verified',
        message: 'Please verify your email address before logging in',
      })
    }

    // Generate tokens
    const userPayload = {
      id: user.id,
      username: user.username,
      email: user.email,
      roles: user.roles,
    }

    const accessToken = generateAccessToken(userPayload)
    const refreshToken = generateRefreshToken(userPayload)
    const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    // Store refresh token
    await storeRefreshToken(user.id, refreshToken, refreshExpiry)

    // Log successful login
    logAuthEvent('user_login_success', user.id, user.email, req.ip, {
      userAgent: req.get('User-Agent'),
      roles: user.roles,
    })

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        roles: user.roles,
        isEmailVerified: user.isEmailVerified,
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
        refreshExpiresAt: refreshExpiry,
      },
    })
  } catch (error) {
    console.error('Login error:', error)

    if (error instanceof Error && error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation error',
        details: error.message,
      })
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'Login failed. Please try again.',
    })
  }
}

// Logout user
const logout = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Refresh token required',
        message: 'Please provide the refresh token to logout',
      })
    }

    // Invalidate the refresh token
    const success = await invalidateRefreshToken(refreshToken)

    if (success) {
      // Log successful logout
      const userId = (req as any).user?.id
      logAuthEvent('user_logout_success', userId, undefined, req.ip, {
        refreshToken: refreshToken.substring(0, 10) + '...',
      })

      res.json({
        message: 'Logout successful',
        success: true,
      })
    } else {
      logSecurityEvent('logout_invalid_token', 'low', {
        refreshToken: refreshToken.substring(0, 10) + '...',
        ip: req.ip,
      })

      res.status(400).json({
        error: 'Invalid token',
        message: 'The provided token was not found or already invalid',
      })
    }
  } catch (error) {
    console.error('Logout error:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: 'Logout failed. Please try again.',
    })
  }
}

// Refresh access token
const refreshToken = async (req: Request, res: Response) => {
  try {
    // Validate input
    const validatedData = refreshTokenSchema.parse(req.body)
    const { refreshToken: token } = validatedData

    // Verify and rotate token
    const newTokens = await verifyAndRotateToken(token)

    if (!newTokens) {
      return res.status(401).json({
        error: 'Invalid or expired refresh token',
        message: 'Please login again',
      })
    }

    res.json({
      message: 'Token refreshed successfully',
      tokens: newTokens,
    })
  } catch (error) {
    console.error('Token refresh error:', error)

    if (error instanceof Error && error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation error',
        details: error.message,
      })
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'Token refresh failed. Please try again.',
    })
  }
}

// Verify email
const verifyEmail = async (req: Request, res: Response) => {
  try {
    // Validate input
    const validatedData = verifyEmailSchema.parse(req.body)
    const { token } = validatedData

    // Verify token
    const authRecord = await verifyEmailVerificationToken(token)

    if (!authRecord) {
      return res.status(400).json({
        error: 'Invalid or expired verification token',
        message: 'The verification link is invalid or has expired',
      })
    }

    // Update user email verification status
    await prisma.users.update({
      where: { id: authRecord.userId },
      data: { isEmailVerified: true },
    })

    // Clear verification token
    await clearEmailVerificationToken(authRecord.userId)

    res.json({
      message: 'Email verified successfully',
      success: true,
    })
  } catch (error) {
    console.error('Email verification error:', error)

    if (error instanceof Error && error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation error',
        details: error.message,
      })
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'Email verification failed. Please try again.',
    })
  }
}

// Forgot password
const forgotPassword = async (req: Request, res: Response) => {
  try {
    // Validate input
    const validatedData = forgotPasswordSchema.parse(req.body)
    const { email } = validatedData

    // Find user
    const user = await prisma.users.findUnique({
      where: { email },
    })

    if (!user) {
      // Don't reveal if email exists or not
      return res.json({
        message: 'If an account with that email exists, a password reset link has been sent.',
        success: true,
      })
    }

    // Generate password reset token
    const resetToken = generatePasswordResetToken()
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    // Store reset token
    await storePasswordResetToken(user.id, resetToken, resetExpiry)

    // Send reset email
    const emailSent = await sendPasswordReset(email, user.username, resetToken)

    res.json({
      message: 'If an account with that email exists, a password reset link has been sent.',
      success: true,
      emailSent,
    })
  } catch (error) {
    console.error('Forgot password error:', error)

    if (error instanceof Error && error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation error',
        details: error.message,
      })
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'Password reset request failed. Please try again.',
    })
  }
}

// Reset password
const resetPassword = async (req: Request, res: Response) => {
  try {
    // Validate input
    const validatedData = resetPasswordSchema.parse(req.body)
    const { token, password } = validatedData

    // Verify reset token
    const authRecord = await verifyPasswordResetToken(token)

    if (!authRecord) {
      return res.status(400).json({
        error: 'Invalid or expired reset token',
        message: 'The password reset link is invalid or has expired',
      })
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Update password
    await prisma.users.update({
      where: { id: authRecord.userId },
      data: { password: hashedPassword },
    })

    // Clear reset token and invalidate all user sessions
    await clearPasswordResetToken(authRecord.userId)
    await invalidateAllUserTokens(authRecord.userId)

    // Send confirmation email
    await sendPasswordChangedNotification(authRecord.users.email, authRecord.users.username)

    res.json({
      message: 'Password reset successfully. Please login with your new password.',
      success: true,
    })
  } catch (error) {
    console.error('Reset password error:', error)

    if (error instanceof Error && error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation error',
        details: error.message,
      })
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'Password reset failed. Please try again.',
    })
  }
}

// Change password (authenticated)
const changePassword = async (req: Request, res: Response) => {
  try {
    // Validate input
    const validatedData = changePasswordSchema.parse(req.body)
    const { currentPassword, newPassword } = validatedData

    // Get user from token (middleware should have added this)
    const userId = (req as any).user?.id
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please login to change your password',
      })
    }

    // Find user
    const user = await prisma.users.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'Your account could not be found',
      })
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password)
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        error: 'Invalid current password',
        message: 'The current password you entered is incorrect',
      })
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12)

    // Update password
    await prisma.users.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    })

    // Invalidate all user sessions (force re-login)
    await invalidateAllUserTokens(userId)

    // Send confirmation email
    await sendPasswordChangedNotification(user.email, user.username)

    res.json({
      message: 'Password changed successfully. Please login again with your new password.',
      success: true,
    })
  } catch (error) {
    console.error('Change password error:', error)

    if (error instanceof Error && error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation error',
        details: error.message,
      })
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'Password change failed. Please try again.',
    })
  }
}

// Get user profile
const getProfile = async (req: Request, res: Response) => {
  try {
    // Get user from token (middleware should have added this)
    const userId = (req as any).user?.id
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please login to access your profile',
      })
    }

    // Find user
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        roles: true,
        isEmailVerified: true,
        created_at: true,
        updated_at: true,
      },
    })

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'Your account could not be found',
      })
    }

    res.json({
      user,
      success: true,
    })
  } catch (error) {
    console.error('Get profile error:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve profile. Please try again.',
    })
  }
}

export {
  register,
  login,
  logout,
  refreshToken,
  verifyEmail,
  forgotPassword,
  resetPassword,
  changePassword,
  getProfile,
}
