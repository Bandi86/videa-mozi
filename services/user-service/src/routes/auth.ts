import express from 'express'
import { body, param, query, validationResult } from 'express-validator'
import { authService } from '../services/authService.js'
import logger from '../config/logger.js'

const router = express.Router()

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     description: Create a new user account
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, username, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User email address
 *               username:
 *                 type: string
 *                 description: Unique username
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 description: User password
 *               firstName:
 *                 type: string
 *                 description: User's first name (optional)
 *               lastName:
 *                 type: string
 *                 description: User's last name (optional)
 *               displayName:
 *                 type: string
 *                 description: Display name (optional, defaults to firstName + lastName)
 *             example:
 *               email: "user@example.com"
 *               username: "johndoe"
 *               password: "securepassword123"
 *               firstName: "John"
 *               lastName: "Doe"
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Validation error or user already exists
 *       500:
 *         description: Internal server error
 */
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('username')
      .isLength({ min: 3, max: 30 })
      .matches(/^[a-zA-Z0-9_]+$/),
    body('password').isLength({ min: 8 }),
    body('firstName').optional().isLength({ min: 1, max: 50 }),
    body('lastName').optional().isLength({ min: 1, max: 50 }),
    body('displayName').optional().isLength({ min: 1, max: 100 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        })
      }

      const user = await authService.register({
        ...req.body,
        ipAddress: req.ip,
      })

      res.status(201).json({
        message: 'User registered successfully',
        user,
      })
    } catch (error: any) {
      logger.error('Register user error:', error)

      if (
        error.message === 'Email already registered' ||
        error.message === 'Username already taken'
      ) {
        return res.status(400).json({
          error: error.message,
        })
      }

      res.status(500).json({
        error: 'Failed to register user',
        message: error.message,
      })
    }
  },
)

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     description: Authenticate user and return access tokens
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [emailOrUsername, password]
 *             properties:
 *               emailOrUsername:
 *                 type: string
 *                 description: User email or username
 *               password:
 *                 type: string
 *                 description: User password
 *             example:
 *               emailOrUsername: "user@example.com"
 *               password: "securepassword123"
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 tokens:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *                     refreshExpiresAt:
 *                       type: string
 *                       format: date-time
 *                   required: [accessToken, refreshToken, expiresAt, refreshExpiresAt]
 *               required: [user, tokens]
 *       400:
 *         description: Invalid credentials
 *       500:
 *         description: Internal server error
 */
router.post(
  '/login',
  [body('emailOrUsername').isLength({ min: 1 }), body('password').isLength({ min: 1 })],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        })
      }

      const result = await authService.login({
        emailOrUsername: req.body.emailOrUsername,
        password: req.body.password,
        deviceInfo: req.useragent,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      })

      res.json({
        message: 'Login successful',
        user: result.user,
        tokens: result.tokens,
      })
    } catch (error: any) {
      logger.error('Login user error:', error)

      if (error.message === 'Invalid credentials' || error.message === 'Account is not active') {
        return res.status(400).json({
          error: error.message,
        })
      }

      res.status(500).json({
        error: 'Failed to login',
        message: error.message,
      })
    }
  },
)

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user
 *     description: Invalidate user's access token
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *       500:
 *         description: Internal server error
 */
router.post('/logout', async (req, res) => {
  try {
    // Get user ID from auth middleware (would be set by auth middleware)
    const userId = req.user?.id
    const accessToken = req.headers.authorization?.replace('Bearer ', '')

    if (userId && accessToken) {
      await authService.logout(userId, accessToken)
    }

    res.json({
      message: 'Logout successful',
    })
  } catch (error: any) {
    logger.error('Logout user error:', error)
    res.status(500).json({
      error: 'Failed to logout',
      message: error.message,
    })
  }
})

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     description: Generate new access token using refresh token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Refresh token
 *             example:
 *               refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthTokens'
 *       400:
 *         description: Invalid refresh token
 *       500:
 *         description: Internal server error
 */
router.post('/refresh', [body('refreshToken').isLength({ min: 1 })], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      })
    }

    const tokens = await authService.refreshToken(req.body.refreshToken)

    res.json({
      message: 'Token refreshed successfully',
      tokens,
    })
  } catch (error: any) {
    logger.error('Refresh token error:', error)

    if (error.message === 'Invalid refresh token') {
      return res.status(400).json({
        error: 'Invalid refresh token',
      })
    }

    res.status(500).json({
      error: 'Failed to refresh token',
      message: error.message,
    })
  }
})

/**
 * @swagger
 * /api/auth/verify:
 *   post:
 *     summary: Verify access token
 *     description: Verify if access token is valid and return user info
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token is valid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                     username:
 *                       type: string
 *                     role:
 *                       type: string
 *                     status:
 *                       type: string
 *                   required: [id, email, username, role, status]
 *               required: [user]
 *       401:
 *         description: Invalid token
 *       500:
 *         description: Internal server error
 */
router.post('/verify', async (req, res) => {
  try {
    // Get token from auth middleware (would be set by auth middleware)
    const token = req.headers.authorization?.replace('Bearer ', '')

    if (!token) {
      return res.status(401).json({
        error: 'No token provided',
      })
    }

    const payload = await authService.verifyToken(token)

    res.json({
      message: 'Token is valid',
      user: {
        id: payload.id,
        email: payload.email,
        username: payload.username,
        role: payload.role,
        status: payload.status,
      },
    })
  } catch (error: any) {
    logger.error('Verify token error:', error)

    if (error.message === 'Invalid access token') {
      return res.status(401).json({
        error: 'Invalid token',
      })
    }

    res.status(500).json({
      error: 'Failed to verify token',
      message: error.message,
    })
  }
})

/**
 * @swagger
 * /api/auth/verify-email/{token}:
 *   post:
 *     summary: Verify email address
 *     description: Verify user's email address using verification token
 *     tags: [Authentication]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Email verification token
 *     responses:
 *       200:
 *         description: Email verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid or expired token
 *       500:
 *         description: Internal server error
 */
router.post('/verify-email/:token', [param('token').isLength({ min: 1 })], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      })
    }

    const user = await authService.verifyEmail(req.params.token)

    res.json({
      message: 'Email verified successfully',
      user,
    })
  } catch (error: any) {
    logger.error('Verify email error:', error)

    if (error.message === 'Invalid or expired verification token') {
      return res.status(400).json({
        error: 'Invalid or expired verification token',
      })
    }

    res.status(500).json({
      error: 'Failed to verify email',
      message: error.message,
    })
  }
})

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     description: Send password reset email to user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User email address
 *             example:
 *               email: "user@example.com"
 *     responses:
 *       200:
 *         description: Password reset email sent
 *       400:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.post('/forgot-password', [body('email').isEmail().normalizeEmail()], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      })
    }

    await authService.generatePasswordResetToken(req.body.email)

    res.json({
      message: 'Password reset email sent',
    })
  } catch (error: any) {
    logger.error('Forgot password error:', error)

    if (error.message === 'User not found') {
      return res.status(400).json({
        error: 'User not found',
      })
    }

    res.status(500).json({
      error: 'Failed to send password reset email',
      message: error.message,
    })
  }
})

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Reset password
 *     description: Reset user password using reset token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token:
 *                 type: string
 *                 description: Password reset token
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 description: New password
 *             example:
 *               token: "reset-token-here"
 *               password: "newsecurepassword123"
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Invalid or expired token
 *       500:
 *         description: Internal server error
 */
router.post(
  '/reset-password',
  [body('token').isLength({ min: 1 }), body('password').isLength({ min: 8 })],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        })
      }

      await authService.resetPassword(req.body.token, req.body.password)

      res.json({
        message: 'Password reset successfully',
      })
    } catch (error: any) {
      logger.error('Reset password error:', error)

      if (error.message === 'Invalid or expired reset token') {
        return res.status(400).json({
          error: 'Invalid or expired reset token',
        })
      }

      res.status(500).json({
        error: 'Failed to reset password',
        message: error.message,
      })
    }
  },
)

/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     summary: Change password
 *     description: Change user's password (requires current password)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 description: Current password
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *                 description: New password
 *             example:
 *               currentPassword: "oldpassword123"
 *               newPassword: "newpassword123"
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Invalid current password
 *       500:
 *         description: Internal server error
 */
router.post(
  '/change-password',
  [body('currentPassword').isLength({ min: 1 }), body('newPassword').isLength({ min: 8 })],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        })
      }

      const userId = req.user?.id

      if (!userId) {
        return res.status(401).json({
          error: 'Authentication required',
        })
      }

      await authService.changePassword(userId, req.body.currentPassword, req.body.newPassword)

      res.json({
        message: 'Password changed successfully',
      })
    } catch (error: any) {
      logger.error('Change password error:', error)

      if (error.message === 'Current password is incorrect') {
        return res.status(400).json({
          error: 'Invalid current password',
        })
      }

      res.status(500).json({
        error: 'Failed to change password',
        message: error.message,
      })
    }
  },
)

/**
 * @swagger
 * /api/auth/sessions:
 *   get:
 *     summary: Get user sessions
 *     description: Get all active sessions for the authenticated user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sessions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/AuthSession'
 *       500:
 *         description: Internal server error
 */
router.get('/sessions', async (req, res) => {
  try {
    const userId = req.user?.id

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
      })
    }

    const sessions = await authService.getUserSessions(userId)

    res.json(sessions)
  } catch (error: any) {
    logger.error('Get user sessions error:', error)
    res.status(500).json({
      error: 'Failed to get user sessions',
      message: error.message,
    })
  }
})

/**
 * @swagger
 * /api/auth/sessions/{sessionId}:
 *   delete:
 *     summary: Revoke session
 *     description: Revoke a specific user session
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session ID to revoke
 *     responses:
 *       200:
 *         description: Session revoked successfully
 *       404:
 *         description: Session not found
 *       500:
 *         description: Internal server error
 */
router.delete(
  '/sessions/:sessionId',
  [param('sessionId').isString().notEmpty()],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        })
      }

      const userId = req.user?.id

      if (!userId) {
        return res.status(401).json({
          error: 'Authentication required',
        })
      }

      await authService.revokeSession(userId, req.params.sessionId)

      res.json({
        message: 'Session revoked successfully',
      })
    } catch (error: any) {
      logger.error('Revoke session error:', error)

      if (error.message === 'Session not found') {
        return res.status(404).json({
          error: 'Session not found',
        })
      }

      res.status(500).json({
        error: 'Failed to revoke session',
        message: error.message,
      })
    }
  },
)

/**
 * @swagger
 * /api/auth/sessions:
 *   delete:
 *     summary: Revoke all sessions
 *     description: Revoke all sessions for the authenticated user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All sessions revoked successfully
 *       500:
 *         description: Internal server error
 */
router.delete('/sessions', async (req, res) => {
  try {
    const userId = req.user?.id

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
      })
    }

    await authService.revokeAllSessions(userId)

    res.json({
      message: 'All sessions revoked successfully',
    })
  } catch (error: any) {
    logger.error('Revoke all sessions error:', error)
    res.status(500).json({
      error: 'Failed to revoke all sessions',
      message: error.message,
    })
  }
})

export { router as authRouter }
