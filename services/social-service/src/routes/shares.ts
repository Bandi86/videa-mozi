import express from 'express'
import { body, param, query, validationResult } from 'express-validator'
import { prisma } from '../index.js'
import { redis } from '../index.js'
import logger, { logSocialEvent } from '../config/logger.js'
import { SharesService } from '../services/sharesService.js'

const router = express.Router()

/**
 * @swagger
 * /api/v1/shares:
 *   get:
 *     summary: Get shares
 *     tags: [Shares]
 *     parameters:
 *       - in: query
 *         name: postId
 *         schema:
 *           type: string
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [SHARE, REPOST, QUOTE]
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
 *         description: Shares retrieved successfully
 */
router.get(
  '/',
  [
    query('postId').optional().isString().withMessage('Post ID must be a string'),
    query('userId').optional().isString().withMessage('User ID must be a string'),
    query('type').optional().isIn(['SHARE', 'REPOST', 'QUOTE']).withMessage('Invalid share type'),
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
        userId: req.query.userId as string,
        type: req.query.type as any,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
      }

      const result = await SharesService.getShares(filters)

      res.json(result)
    } catch (error) {
      logger.error('Get shares error:', error)
      res.status(500).json({
        error: 'Shares retrieval failed',
        message: 'An error occurred while retrieving shares.',
      })
    }
  },
)

/**
 * @swagger
 * /api/v1/posts/{postId}/share:
 *   post:
 *     summary: Share a post
 *     tags: [Shares]
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - shareType
 *             properties:
 *               shareType:
 *                 type: string
 *                 enum: [SHARE, REPOST, QUOTE]
 *               quoteText:
 *                 type: string
 *                 description: Text for quote shares
 *               quoteMedia:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Media URLs for quote shares
 *     responses:
 *       201:
 *         description: Post shared successfully
 */
router.post(
  '/posts/:postId',
  [
    param('postId').isString().notEmpty().withMessage('Post ID is required'),
    body('shareType')
      .isIn(['SHARE', 'REPOST', 'QUOTE'])
      .withMessage('Share type must be SHARE, REPOST, or QUOTE'),
    body('quoteText')
      .optional()
      .isString()
      .isLength({ max: 500 })
      .withMessage('Quote text must be less than 500 characters'),
    body('quoteMedia').optional().isArray().withMessage('Quote media must be an array'),
    body('quoteMedia.*').optional().isURL().withMessage('Quote media URLs must be valid URLs'),
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
      const shareData = {
        userId: req.user!.id,
        postId,
        shareType: req.body.shareType,
        quoteText: req.body.quoteText,
        quoteMedia: req.body.quoteMedia || [],
      }

      const share = await SharesService.createShare(shareData)

      // Clear share cache for this post
      await redis.del(`post_shares:${postId}`)

      logSocialEvent('POST_SHARED', req.user!.id, postId, {
        shareType: share.shareType,
      })

      res.status(201).json({
        message: 'Post shared successfully',
        share,
      })
    } catch (error) {
      logger.error('Create share error:', error)
      res.status(500).json({
        error: 'Share creation failed',
        message: 'An error occurred while creating the share.',
      })
    }
  },
)

/**
 * @swagger
 * /api/v1/shares/{id}:
 *   delete:
 *     summary: Delete a share
 *     tags: [Shares]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Share deleted successfully
 *       404:
 *         description: Share not found
 */
router.delete(
  '/:id',
  [param('id').isString().notEmpty().withMessage('Share ID is required')],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation error',
          details: errors.array(),
        })
      }

      const shareId = req.params.id

      const success = await SharesService.deleteShare(shareId, req.user!.id)

      if (!success) {
        return res.status(404).json({
          error: 'Share not found',
          message: 'The requested share could not be found.',
        })
      }

      logSocialEvent('SHARE_DELETED', req.user!.id, shareId, {})

      res.json({
        message: 'Share deleted successfully',
      })
    } catch (error) {
      logger.error('Delete share error:', error)
      res.status(500).json({
        error: 'Share deletion failed',
        message: 'An error occurred while deleting the share.',
      })
    }
  },
)

/**
 * @swagger
 * /api/v1/posts/{postId}/shares:
 *   get:
 *     summary: Get shares for a post
 *     tags: [Shares]
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
 *         description: Post shares retrieved successfully
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

      const result = await SharesService.getPostShares(postId, page, limit)

      res.json(result)
    } catch (error) {
      logger.error('Get post shares error:', error)
      res.status(500).json({
        error: 'Post shares retrieval failed',
        message: 'An error occurred while retrieving post shares.',
      })
    }
  },
)

export { router as sharesRouter }
