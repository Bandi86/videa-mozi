import express from 'express'
import {
  register,
  login,
  logout,
  refreshToken,
  verifyEmail,
  forgotPassword,
  resetPassword,
  changePassword,
  getProfile,
} from '../controllers/authController.js'
import { authenticateToken, guestOnly, requireVerifiedEmail } from '../middlewares/auth.js'
import {
  loginRateLimit,
  passwordResetRateLimit,
  emailVerificationRateLimit,
  generalRateLimit,
} from '../middlewares/rateLimit.js'
import {
  requestSizeLimiter,
  sqlInjectionProtection,
  bruteForceProtection,
  apiSecurityHeaders,
  sanitizeInput,
} from '../middlewares/security.js'

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication and authorization endpoints
 */

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Register a new user account
 *     description: Creates a new user account with email verification
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *               - confirmPassword
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 50
 *                 description: Unique username
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Valid email address
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 description: Strong password with uppercase, lowercase, number, and special character
 *               confirmPassword:
 *                 type: string
 *                 description: Password confirmation (must match password)
 *     responses:
 *       201:
 *         description: User registered successfully, email verification sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     username:
 *                       type: string
 *                     email:
 *                       type: string
 *                     roles:
 *                       type: string
 *                     isEmailVerified:
 *                       type: boolean
 *                 emailSent:
 *                   type: boolean
 *       409:
 *         description: User already exists
 *       400:
 *         description: Validation error
 */

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: User login
 *     description: Authenticate user and return JWT tokens
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User email address
 *               password:
 *                 type: string
 *                 description: User password
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     username:
 *                       type: string
 *                     email:
 *                       type: string
 *                     roles:
 *                       type: string
 *                     isEmailVerified:
 *                       type: boolean
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
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: Email not verified
 */

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: User logout
 *     description: Invalidate the user's refresh token
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: The refresh token to invalidate
 *     responses:
 *       200:
 *         description: Logout successful
 *       400:
 *         description: Invalid token
 *       401:
 *         description: Authentication required
 */

/**
 * @swagger
 * /api/v1/auth/refresh-token:
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
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Valid refresh token
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *       401:
 *         description: Invalid or expired refresh token
 */

/**
 * @swagger
 * /api/v1/auth/verify-email:
 *   post:
 *     summary: Verify email address
 *     description: Verify user email using verification token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 description: Email verification token from email
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Invalid or expired verification token
 */

/**
 * @swagger
 * /api/v1/auth/forgot-password:
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
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User email address
 *     responses:
 *       200:
 *         description: Password reset email sent (if account exists)
 */

/**
 * @swagger
 * /api/v1/auth/reset-password:
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
 *             required:
 *               - token
 *               - password
 *               - confirmPassword
 *             properties:
 *               token:
 *                 type: string
 *                 description: Password reset token from email
 *               password:
 *                 type: string
 *                 description: New password
 *               confirmPassword:
 *                 type: string
 *                 description: Password confirmation
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Invalid or expired reset token
 */

/**
 * @swagger
 * /api/v1/auth/change-password:
 *   post:
 *     summary: Change password
 *     description: Change authenticated user's password
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *               - confirmNewPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 description: Current password
 *               newPassword:
 *                 type: string
 *                 description: New password
 *               confirmNewPassword:
 *                 type: string
 *                 description: New password confirmation
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Invalid current password or validation error
 *       401:
 *         description: Authentication required
 */

/**
 * @swagger
 * /api/v1/auth/profile:
 *   get:
 *     summary: Get user profile
 *     description: Retrieve authenticated user's profile information
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: User not found
 */

const router = express.Router()

// Apply general security middleware to all routes
router.use(apiSecurityHeaders)
router.use(sanitizeInput)
router.use(sqlInjectionProtection)

// Public routes (no authentication required)
// These use guestOnly to prevent authenticated users from accessing
router.post(
  '/register',
  guestOnly,
  requestSizeLimiter('5mb'),
  emailVerificationRateLimit,
  bruteForceProtection,
  register,
)

router.post(
  '/login',
  guestOnly,
  requestSizeLimiter('1mb'),
  loginRateLimit,
  bruteForceProtection,
  login,
)

router.post('/forgot-password', requestSizeLimiter('1mb'), passwordResetRateLimit, forgotPassword)

router.post('/reset-password', requestSizeLimiter('1mb'), passwordResetRateLimit, resetPassword)

router.post('/verify-email', requestSizeLimiter('1mb'), emailVerificationRateLimit, verifyEmail)

router.post('/refresh-token', requestSizeLimiter('1mb'), generalRateLimit, refreshToken)

// Protected routes (authentication required)
router.use(authenticateToken) // All routes below require authentication

router.post('/logout', requestSizeLimiter('1mb'), logout)

router.post('/change-password', requestSizeLimiter('1mb'), requireVerifiedEmail, changePassword)

router.get('/profile', generalRateLimit, getProfile)

// Admin-only routes
// router.get('/users', requireAdmin, getAllUsers) // Uncomment when admin routes are needed

export default router
