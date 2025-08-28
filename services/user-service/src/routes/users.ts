import express from 'express'
import { body, param, query, validationResult } from 'express-validator'
import { userService } from '../services/userService.js'
import logger from '../config/logger.js'

const router = express.Router()

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get users
 *     description: Get list of users with filtering and pagination
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of items per page
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [USER, ADMIN, MODERATOR]
 *         description: Filter by user role
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, SUSPENDED, BANNED, PENDING_VERIFICATION, DELETED]
 *         description: Filter by user status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by username or display name
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *               required: [data, pagination]
 *       500:
 *         description: Internal server error
 */
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('role').optional().isIn(['USER', 'ADMIN', 'MODERATOR']),
    query('status')
      .optional()
      .isIn(['ACTIVE', 'SUSPENDED', 'BANNED', 'PENDING_VERIFICATION', 'DELETED']),
    query('search').optional().isLength({ min: 1 }),
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

      const filters = {
        role: req.query.role as any,
        status: req.query.status as any,
        search: req.query.search as string,
      }

      const pagination = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
      }

      const result = await userService.getUsers(filters, pagination)

      res.json(result)
    } catch (error: any) {
      logger.error('Get users error:', error)
      res.status(500).json({
        error: 'Failed to get users',
        message: error.message,
      })
    }
  },
)

/**
 * @swagger
 * /api/users/search:
 *   get:
 *     summary: Search users
 *     description: Search users by username or display name
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Users found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *               required: [data, pagination]
 *       400:
 *         description: Missing search query
 *       500:
 *         description: Internal server error
 */
router.get(
  '/search',
  [
    query('q').isLength({ min: 1 }),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
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

      const pagination = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
      }

      const result = await userService.searchUsers(req.query.q as string, pagination)

      res.json(result)
    } catch (error: any) {
      logger.error('Search users error:', error)
      res.status(500).json({
        error: 'Failed to search users',
        message: error.message,
      })
    }
  },
)

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     description: Get user information by ID
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.get('/:id', [param('id').isString().notEmpty()], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      })
    }

    const user = await userService.getUserById(req.params.id)

    res.json(user)
  } catch (error: any) {
    logger.error('Get user by ID error:', error)

    if (error.message === 'User not found') {
      return res.status(404).json({
        error: 'User not found',
      })
    }

    res.status(500).json({
      error: 'Failed to get user',
      message: error.message,
    })
  }
})

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Update user
 *     description: Update user information
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 description: User's first name
 *               lastName:
 *                 type: string
 *                 description: User's last name
 *               displayName:
 *                 type: string
 *                 description: Display name
 *               bio:
 *                 type: string
 *                 description: User biography
 *               website:
 *                 type: string
 *                 description: User's website
 *               location:
 *                 type: string
 *                 description: User's location
 *               avatarUrl:
 *                 type: string
 *                 description: Avatar image URL
 *               coverImageUrl:
 *                 type: string
 *                 description: Cover image URL
 *               visibility:
 *                 type: string
 *                 enum: [PUBLIC, FRIENDS_ONLY, PRIVATE]
 *                 description: Profile visibility
 *               isPrivate:
 *                 type: boolean
 *                 description: Whether profile is private
 *               allowMessages:
 *                 type: boolean
 *                 description: Whether to allow messages
 *               allowTagging:
 *                 type: boolean
 *                 description: Whether to allow tagging
 *               showOnlineStatus:
 *                 type: boolean
 *                 description: Whether to show online status
 *             example:
 *               firstName: "John"
 *               lastName: "Doe"
 *               displayName: "John Doe"
 *               bio: "Software developer"
 *               website: "https://johndoe.com"
 *               location: "San Francisco, CA"
 *     responses:
 *       200:
 *         description: User updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       403:
 *         description: Not authorized to update this user
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.put(
  '/:id',
  [
    param('id').isString().notEmpty(),
    body('firstName').optional().isLength({ min: 1, max: 50 }),
    body('lastName').optional().isLength({ min: 1, max: 50 }),
    body('displayName').optional().isLength({ min: 1, max: 100 }),
    body('bio').optional().isLength({ min: 0, max: 500 }),
    body('website').optional().isURL(),
    body('location').optional().isLength({ min: 0, max: 100 }),
    body('avatarUrl').optional().isURL(),
    body('coverImageUrl').optional().isURL(),
    body('visibility').optional().isIn(['PUBLIC', 'FRIENDS_ONLY', 'PRIVATE']),
    body('isPrivate').optional().isBoolean(),
    body('allowMessages').optional().isBoolean(),
    body('allowTagging').optional().isBoolean(),
    body('showOnlineStatus').optional().isBoolean(),
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

      // Check if user is authorized to update this profile
      const currentUserId = req.user?.id
      const targetUserId = req.params.id

      if (currentUserId !== targetUserId && req.user?.role !== 'ADMIN') {
        return res.status(403).json({
          error: 'Not authorized to update this user',
        })
      }

      const updateData = req.body
      const user = await userService.updateUser(targetUserId, updateData)

      res.json(user)
    } catch (error: any) {
      logger.error('Update user error:', error)

      if (error.message === 'User not found') {
        return res.status(404).json({
          error: 'User not found',
        })
      }

      res.status(500).json({
        error: 'Failed to update user',
        message: error.message,
      })
    }
  },
)

/**
 * @swagger
 * /api/users/{id}/follow:
 *   post:
 *     summary: Follow user
 *     description: Follow another user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to follow
 *     responses:
 *       200:
 *         description: User followed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Follow'
 *       400:
 *         description: Cannot follow yourself or already following
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.post('/:id/follow', [param('id').isString().notEmpty()], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      })
    }

    const followerId = req.user?.id
    const followingId = req.params.id

    if (!followerId) {
      return res.status(401).json({
        error: 'Authentication required',
      })
    }

    const follow = await userService.followUser(followerId, followingId)

    res.json({
      message: 'User followed successfully',
      follow,
    })
  } catch (error: any) {
    logger.error('Follow user error:', error)

    if (
      error.message === 'Users cannot follow themselves' ||
      error.message === 'Already following this user' ||
      error.message === 'User not found'
    ) {
      return res.status(400).json({
        error: error.message,
      })
    }

    res.status(500).json({
      error: 'Failed to follow user',
      message: error.message,
    })
  }
})

/**
 * @swagger
 * /api/users/{id}/unfollow:
 *   post:
 *     summary: Unfollow user
 *     description: Unfollow another user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to unfollow
 *     responses:
 *       200:
 *         description: User unfollowed successfully
 *       400:
 *         description: Not following this user
 *       500:
 *         description: Internal server error
 */
router.post('/:id/unfollow', [param('id').isString().notEmpty()], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      })
    }

    const followerId = req.user?.id
    const followingId = req.params.id

    if (!followerId) {
      return res.status(401).json({
        error: 'Authentication required',
      })
    }

    await userService.unfollowUser(followerId, followingId)

    res.json({
      message: 'User unfollowed successfully',
    })
  } catch (error: any) {
    logger.error('Unfollow user error:', error)

    if (error.message === 'Not following this user') {
      return res.status(400).json({
        error: error.message,
      })
    }

    res.status(500).json({
      error: 'Failed to unfollow user',
      message: error.message,
    })
  }
})

/**
 * @swagger
 * /api/users/{id}/followers:
 *   get:
 *     summary: Get user followers
 *     description: Get list of users following this user
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Followers retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *               required: [data, pagination]
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:id/followers',
  [
    param('id').isString().notEmpty(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
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

      const pagination = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
      }

      const result = await userService.getFollowers(req.params.id, pagination)

      res.json(result)
    } catch (error: any) {
      logger.error('Get followers error:', error)
      res.status(500).json({
        error: 'Failed to get followers',
        message: error.message,
      })
    }
  },
)

/**
 * @swagger
 * /api/users/{id}/following:
 *   get:
 *     summary: Get users followed by user
 *     description: Get list of users this user is following
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Following retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *               required: [data, pagination]
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:id/following',
  [
    param('id').isString().notEmpty(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
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

      const pagination = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
      }

      const result = await userService.getFollowing(req.params.id, pagination)

      res.json(result)
    } catch (error: any) {
      logger.error('Get following error:', error)
      res.status(500).json({
        error: 'Failed to get following',
        message: error.message,
      })
    }
  },
)

/**
 * @swagger
 * /api/users/{id}/follow-status:
 *   get:
 *     summary: Get follow status
 *     description: Check if authenticated user is following another user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to check follow status for
 *     responses:
 *       200:
 *         description: Follow status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isFollowing:
 *                   type: boolean
 *                 status:
 *                   type: string
 *                   nullable: true
 *                 followType:
 *                   type: string
 *                   nullable: true
 *               required: [isFollowing]
 *       500:
 *         description: Internal server error
 */
router.get('/:id/follow-status', [param('id').isString().notEmpty()], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      })
    }

    const followerId = req.user?.id
    const followingId = req.params.id

    if (!followerId) {
      return res.status(401).json({
        error: 'Authentication required',
      })
    }

    const status = await userService.getFollowStatus(followerId, followingId)

    res.json(status)
  } catch (error: any) {
    logger.error('Get follow status error:', error)
    res.status(500).json({
      error: 'Failed to get follow status',
      message: error.message,
    })
  }
})

/**
 * @swagger
 * /api/users/preferences:
 *   get:
 *     summary: Get user preferences
 *     description: Get authenticated user's preferences
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Preferences retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserPreference'
 *       500:
 *         description: Internal server error
 */
router.get('/preferences', async (req, res) => {
  try {
    const userId = req.user?.id

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
      })
    }

    const preferences = await userService.getUserPreferences(userId)

    res.json(preferences)
  } catch (error: any) {
    logger.error('Get user preferences error:', error)
    res.status(500).json({
      error: 'Failed to get user preferences',
      message: error.message,
    })
  }
})

/**
 * @swagger
 * /api/users/preferences:
 *   put:
 *     summary: Update user preferences
 *     description: Update authenticated user's preferences
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               theme:
 *                 type: string
 *                 enum: [light, dark, auto]
 *                 description: UI theme preference
 *               language:
 *                 type: string
 *                 description: Preferred language
 *               timezone:
 *                 type: string
 *                 description: User's timezone
 *               dateFormat:
 *                 type: string
 *                 description: Date format preference
 *               timeFormat:
 *                 type: string
 *                 enum: [12h, 24h]
 *                 description: Time format preference
 *               emailNotifications:
 *                 type: boolean
 *                 description: Enable email notifications
 *               pushNotifications:
 *                 type: boolean
 *                 description: Enable push notifications
 *               smsNotifications:
 *                 type: boolean
 *                 description: Enable SMS notifications
 *               marketingEmails:
 *                 type: boolean
 *                 description: Receive marketing emails
 *               profileVisibility:
 *                 type: string
 *                 enum: [PUBLIC, FRIENDS_ONLY, PRIVATE]
 *                 description: Profile visibility setting
 *               activityVisibility:
 *                 type: string
 *                 enum: [PUBLIC, FRIENDS_ONLY, PRIVATE]
 *                 description: Activity visibility setting
 *               showEmail:
 *                 type: boolean
 *                 description: Show email on profile
 *               showLocation:
 *                 type: boolean
 *                 description: Show location on profile
 *               allowDataCollection:
 *                 type: boolean
 *                 description: Allow data collection for analytics
 *             example:
 *               theme: "dark"
 *               language: "en"
 *               timezone: "America/New_York"
 *               emailNotifications: true
 *               pushNotifications: true
 *               profileVisibility: "PUBLIC"
 *     responses:
 *       200:
 *         description: Preferences updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserPreference'
 *       500:
 *         description: Internal server error
 */
router.put(
  '/preferences',
  [
    body('theme').optional().isIn(['light', 'dark', 'auto']),
    body('language').optional().isLength({ min: 2, max: 10 }),
    body('timezone').optional().isLength({ min: 1, max: 50 }),
    body('dateFormat').optional().isLength({ min: 1, max: 20 }),
    body('timeFormat').optional().isIn(['12h', '24h']),
    body('emailNotifications').optional().isBoolean(),
    body('pushNotifications').optional().isBoolean(),
    body('smsNotifications').optional().isBoolean(),
    body('marketingEmails').optional().isBoolean(),
    body('profileVisibility').optional().isIn(['PUBLIC', 'FRIENDS_ONLY', 'PRIVATE']),
    body('activityVisibility').optional().isIn(['PUBLIC', 'FRIENDS_ONLY', 'PRIVATE']),
    body('showEmail').optional().isBoolean(),
    body('showLocation').optional().isBoolean(),
    body('allowDataCollection').optional().isBoolean(),
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

      const userId = req.user?.id

      if (!userId) {
        return res.status(401).json({
          error: 'Authentication required',
        })
      }

      const preferences = await userService.updateUserPreferences(userId, req.body)

      res.json(preferences)
    } catch (error: any) {
      logger.error('Update user preferences error:', error)
      res.status(500).json({
        error: 'Failed to update user preferences',
        message: error.message,
      })
    }
  },
)

export { router as usersRouter }
