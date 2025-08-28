import express from 'express'
import { body, param, query, validationResult } from 'express-validator'
import { prisma } from '../index.js'
import { redis } from '../index.js'
import logger, { logFollowEvent } from '../config/logger.js'
import { FollowersService } from '../services/followersService.js'

const router = express.Router()

/**
 * @swagger
 * /api/v1/followers:
 *   get:
 *     summary: Get followers/following relationships
 *     tags: [Followers]
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [followers, following]
 *           default: followers
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, ACCEPTED, BLOCKED]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *     responses:
 *       200:
 *         description: Relationships retrieved successfully
 */
router.get(
  '/',
  [
    query('userId').optional().isString().withMessage('User ID must be a string'),
    query('type')
      .optional()
      .isIn(['followers', 'following'])
      .withMessage('Type must be followers or following'),
    query('status')
      .optional()
      .isIn(['PENDING', 'ACCEPTED', 'BLOCKED'])
      .withMessage('Invalid status'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation error',
          details: errors.array(),
        })
      }

      const filters = {
        userId: req.query.userId as string,
        type: (req.query.type as 'followers' | 'following') || 'followers',
        status: req.query.status as any,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
      }

      const result = await FollowersService.getRelationships(filters)

      res.json(result)
    } catch (error) {
      logger.error('Get relationships error:', error)
      res.status(500).json({
        error: 'Relationships retrieval failed',
        message: 'An error occurred while retrieving relationships.',
      })
    }
  },
)

/**
 * @swagger
 * /api/v1/followers/{userId}:
 *   post:
 *     summary: Follow a user
 *     tags: [Followers]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               requestMessage:
 *                 type: string
 *                 description: Message for follow request (for private accounts)
 *     responses:
 *       200:
 *         description: Follow request sent successfully
 */
router.post(
  '/:userId',
  [
    param('userId').isString().notEmpty().withMessage('User ID is required'),
    body('requestMessage')
      .optional()
      .isString()
      .isLength({ max: 500 })
      .withMessage('Request message must be less than 500 characters'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation error',
          details: errors.array(),
        })
      }

      const targetUserId = req.params.userId
      const followerId = req.user!.id
      const requestMessage = req.body.requestMessage

      // Check if user is trying to follow themselves
      if (followerId === targetUserId) {
        return res.status(400).json({
          error: 'Cannot follow yourself',
          message: 'Users cannot follow themselves.',
        })
      }

      const result = await FollowersService.followUser(followerId, targetUserId, requestMessage)

      logFollowEvent('USER_FOLLOWED', followerId, targetUserId, {
        status: result.status,
        hasMessage: !!requestMessage,
      })

      res.json(result)
    } catch (error) {
      logger.error('Follow user error:', error)
      res.status(500).json({
        error: 'Follow operation failed',
        message: 'An error occurred while processing the follow request.',
      })
    }
  },
)

/**
 * @swagger
 * /api/v1/followers/{userId}/accept:
 *   post:
 *     summary: Accept follow request
 *     tags: [Followers]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Follow request accepted successfully
 */
router.post(
  '/:userId/accept',
  [param('userId').isString().notEmpty().withMessage('User ID is required')],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation error',
          details: errors.array(),
        })
      }

      const followerId = req.params.userId
      const followingId = req.user!.id

      const result = await FollowersService.acceptFollowRequest(followerId, followingId)

      if (!result) {
        return res.status(404).json({
          error: 'Follow request not found',
          message: 'No pending follow request found from this user.',
        })
      }

      logFollowEvent('FOLLOW_REQUEST_ACCEPTED', followingId, followerId, {})

      res.json({
        message: 'Follow request accepted successfully',
        relationship: result,
      })
    } catch (error) {
      logger.error('Accept follow request error:', error)
      res.status(500).json({
        error: 'Accept follow request failed',
        message: 'An error occurred while accepting the follow request.',
      })
    }
  },
)

/**
 * @swagger
 * /api/v1/followers/{userId}/reject:
 *   post:
 *     summary: Reject follow request
 *     tags: [Followers]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Follow request rejected successfully
 */
router.post(
  '/:userId/reject',
  [param('userId').isString().notEmpty().withMessage('User ID is required')],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation error',
          details: errors.array(),
        })
      }

      const followerId = req.params.userId
      const followingId = req.user!.id

      const result = await FollowersService.rejectFollowRequest(followerId, followingId)

      if (!result) {
        return res.status(404).json({
          error: 'Follow request not found',
          message: 'No pending follow request found from this user.',
        })
      }

      logFollowEvent('FOLLOW_REQUEST_REJECTED', followingId, followerId, {})

      res.json({
        message: 'Follow request rejected successfully',
      })
    } catch (error) {
      logger.error('Reject follow request error:', error)
      res.status(500).json({
        error: 'Reject follow request failed',
        message: 'An error occurred while rejecting the follow request.',
      })
    }
  },
)

/**
 * @swagger
 * /api/v1/followers/{userId}:
 *   delete:
 *     summary: Unfollow a user
 *     tags: [Followers]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User unfollowed successfully
 */
router.delete(
  '/:userId',
  [param('userId').isString().notEmpty().withMessage('User ID is required')],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation error',
          details: errors.array(),
        })
      }

      const targetUserId = req.params.userId
      const followerId = req.user!.id

      const result = await FollowersService.unfollowUser(followerId, targetUserId)

      if (!result) {
        return res.status(404).json({
          error: 'Follow relationship not found',
          message: 'You are not following this user.',
        })
      }

      logFollowEvent('USER_UNFOLLOWED', followerId, targetUserId, {})

      res.json({
        message: 'User unfollowed successfully',
      })
    } catch (error) {
      logger.error('Unfollow user error:', error)
      res.status(500).json({
        error: 'Unfollow operation failed',
        message: 'An error occurred while unfollowing the user.',
      })
    }
  },
)

/**
 * @swagger
 * /api/v1/followers/{userId}/status:
 *   get:
 *     summary: Get follow status between users
 *     tags: [Followers]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Follow status retrieved successfully
 */
router.get(
  '/:userId/status',
  [param('userId').isString().notEmpty().withMessage('User ID is required')],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation error',
          details: errors.array(),
        })
      }

      const targetUserId = req.params.userId
      const currentUserId = req.user!.id

      const status = await FollowersService.getFollowStatus(currentUserId, targetUserId)

      res.json({ status })
    } catch (error) {
      logger.error('Get follow status error:', error)
      res.status(500).json({
        error: 'Follow status retrieval failed',
        message: 'An error occurred while retrieving follow status.',
      })
    }
  },
)

/**
 * @swagger
 * /api/v1/followers/requests:
 *   get:
 *     summary: Get follow requests
 *     tags: [Followers]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *     responses:
 *       200:
 *         description: Follow requests retrieved successfully
 */
router.get(
  '/requests',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation error',
          details: errors.array(),
        })
      }

      const filters = {
        userId: req.user!.id,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
      }

      const result = await FollowersService.getFollowRequests(filters)

      res.json(result)
    } catch (error) {
      logger.error('Get follow requests error:', error)
      res.status(500).json({
        error: 'Follow requests retrieval failed',
        message: 'An error occurred while retrieving follow requests.',
      })
    }
  },
)

export { router as followersRouter }
