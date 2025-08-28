import express from 'express'
import { body, param, query, validationResult } from 'express-validator'
import { prisma } from '../index.js'
import { redis } from '../index.js'
import logger from '../config/logger.js'
import { LikesService } from '../services/likesService.js'

const router = express.Router()

/**
 * @swagger
 * /api/v1/likes:
 *   get:
 *     summary: Get likes
 *     tags: [Likes]
 *     parameters:
 *       - in: query
 *         name: postId
 *         schema:
 *           type: string
 *       - in: query
 *         name: commentId
 *         schema:
 *           type: string
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
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
 *         description: Likes retrieved successfully
 */
router.get(
  '/',
  [
    query('postId').optional().isString().withMessage('Post ID must be a string'),
    query('commentId').optional().isString().withMessage('Comment ID must be a string'),
    query('userId').optional().isString().withMessage('User ID must be a string'),
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
        postId: req.query.postId as string,
        commentId: req.query.commentId as string,
        userId: req.query.userId as string,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
      }

      const result = await LikesService.getLikes(filters)

      res.json(result)
    } catch (error) {
      logger.error('Get likes error:', error)
      res.status(500).json({
        error: 'Likes retrieval failed',
        message: 'An error occurred while retrieving likes.',
      })
    }
  },
)

/**
 * @swagger
 * /api/v1/posts/{postId}/like:
 *   post:
 *     summary: Like or unlike a post
 *     tags: [Likes]
 *     parameters:
 *       - in: path
 *         name: postId
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
 *               type:
 *                 type: string
 *                 enum: [LIKE, LOVE, LAUGH, ANGRY, SAD, WOW]
 *                 default: LIKE
 *     responses:
 *       200:
 *         description: Post liked/unliked successfully
 */
router.post(
  '/posts/:postId',
  [
    param('postId').isString().notEmpty().withMessage('Post ID is required'),
    body('type')
      .optional()
      .isIn(['LIKE', 'LOVE', 'LAUGH', 'ANGRY', 'SAD', 'WOW'])
      .withMessage('Invalid like type'),
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

      const postId = req.params.postId
      const likeType = (req.body.type as string) || 'LIKE'

      const result = await LikesService.togglePostLike(req.user!.id, postId, likeType as any)

      res.json(result)
    } catch (error) {
      logger.error('Toggle post like error:', error)
      res.status(500).json({
        error: 'Like operation failed',
        message: 'An error occurred while processing the like.',
      })
    }
  },
)

/**
 * @swagger
 * /api/v1/comments/{commentId}/like:
 *   post:
 *     summary: Like or unlike a comment
 *     tags: [Likes]
 *     parameters:
 *       - in: path
 *         name: commentId
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
 *               type:
 *                 type: string
 *                 enum: [LIKE, LOVE, LAUGH, ANGRY, SAD, WOW]
 *                 default: LIKE
 *     responses:
 *       200:
 *         description: Comment liked/unliked successfully
 */
router.post(
  '/comments/:commentId',
  [
    param('commentId').isString().notEmpty().withMessage('Comment ID is required'),
    body('type')
      .optional()
      .isIn(['LIKE', 'LOVE', 'LAUGH', 'ANGRY', 'SAD', 'WOW'])
      .withMessage('Invalid like type'),
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

      const commentId = req.params.commentId
      const likeType = (req.body.type as string) || 'LIKE'

      const result = await LikesService.toggleCommentLike(req.user!.id, commentId, likeType as any)

      res.json(result)
    } catch (error) {
      logger.error('Toggle comment like error:', error)
      res.status(500).json({
        error: 'Like operation failed',
        message: 'An error occurred while processing the like.',
      })
    }
  },
)

/**
 * @swagger
 * /api/v1/posts/{postId}/likes:
 *   get:
 *     summary: Get likes for a post
 *     tags: [Likes]
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
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
 *         description: Post likes retrieved successfully
 */
router.get(
  '/posts/:postId',
  [
    param('postId').isString().notEmpty().withMessage('Post ID is required'),
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

      const postId = req.params.postId
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 20

      const result = await LikesService.getPostLikes(postId, page, limit)

      res.json(result)
    } catch (error) {
      logger.error('Get post likes error:', error)
      res.status(500).json({
        error: 'Post likes retrieval failed',
        message: 'An error occurred while retrieving post likes.',
      })
    }
  },
)

export { router as likesRouter }
