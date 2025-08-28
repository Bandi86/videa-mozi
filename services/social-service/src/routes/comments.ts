import express from 'express'
import { body, param, query, validationResult } from 'express-validator'
import { prisma } from '../index.js'
import { redis } from '../index.js'
import logger, { logCommentEvent } from '../config/logger.js'
import { CommentsService } from '../services/commentsService.js'

const router = express.Router()

/**
 * @swagger
 * /api/v1/comments:
 *   get:
 *     summary: Get comments
 *     tags: [Comments]
 *     parameters:
 *       - in: query
 *         name: postId
 *         schema:
 *           type: string
 *       - in: query
 *         name: authorId
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
 *         description: Comments retrieved successfully
 */
router.get(
  '/',
  [
    query('postId').optional().isString().withMessage('Post ID must be a string'),
    query('authorId').optional().isString().withMessage('Author ID must be a string'),
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
        authorId: req.query.authorId as string,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
      }

      const result = await CommentsService.getComments(filters)

      res.json(result)
    } catch (error) {
      logger.error('Get comments error:', error)
      res.status(500).json({
        error: 'Comments retrieval failed',
        message: 'An error occurred while retrieving comments.',
      })
    }
  },
)

/**
 * @swagger
 * /api/v1/comments/{id}:
 *   get:
 *     summary: Get comment by ID
 *     tags: [Comments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Comment retrieved successfully
 *       404:
 *         description: Comment not found
 */
router.get(
  '/:id',
  [param('id').isString().notEmpty().withMessage('Comment ID is required')],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation error',
          details: errors.array(),
        })
      }

      const commentId = req.params.id

      const comment = await CommentsService.getCommentById(commentId)

      if (!comment) {
        return res.status(404).json({
          error: 'Comment not found',
          message: 'The requested comment could not be found.',
        })
      }

      res.json(comment)
    } catch (error) {
      logger.error('Get comment error:', error)
      res.status(500).json({
        error: 'Comment retrieval failed',
        message: 'An error occurred while retrieving the comment.',
      })
    }
  },
)

/**
 * @swagger
 * /api/v1/posts/{postId}/comments:
 *   post:
 *     summary: Create a comment on a post
 *     tags: [Comments]
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
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [TEXT, IMAGE, GIF]
 *                 default: TEXT
 *               mediaUrls:
 *                 type: array
 *                 items:
 *                   type: string
 *               parentId:
 *                 type: string
 *                 description: Parent comment ID for replies
 *     responses:
 *       201:
 *         description: Comment created successfully
 *       400:
 *         description: Validation error
 */
router.post(
  '/posts/:postId',
  [
    param('postId').isString().notEmpty().withMessage('Post ID is required'),
    body('content')
      .isString()
      .isLength({ min: 1, max: 1000 })
      .withMessage('Content is required and must be less than 1000 characters'),
    body('type').optional().isIn(['TEXT', 'IMAGE', 'GIF']).withMessage('Invalid comment type'),
    body('mediaUrls').optional().isArray().withMessage('Media URLs must be an array'),
    body('mediaUrls.*').optional().isURL().withMessage('Media URLs must be valid URLs'),
    body('parentId').optional().isString().withMessage('Parent ID must be a string'),
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
      const commentData = {
        ...req.body,
        postId,
        authorId: req.user!.id,
      }

      const comment = await CommentsService.createComment(commentData)

      // Clear comment cache for this post
      await redis.del(`post_comments:${postId}`)

      logCommentEvent('COMMENT_CREATED', comment.id, req.user!.id, {
        postId,
        type: comment.type,
      })

      res.status(201).json({
        message: 'Comment created successfully',
        comment,
      })
    } catch (error) {
      logger.error('Create comment error:', error)
      res.status(500).json({
        error: 'Comment creation failed',
        message: 'An error occurred while creating the comment.',
      })
    }
  },
)

/**
 * @swagger
 * /api/v1/comments/{id}:
 *   put:
 *     summary: Update comment
 *     tags: [Comments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *               mediaUrls:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Comment updated successfully
 *       404:
 *         description: Comment not found
 */
router.put(
  '/:id',
  [
    param('id').isString().notEmpty().withMessage('Comment ID is required'),
    body('content')
      .optional()
      .isString()
      .isLength({ min: 1, max: 1000 })
      .withMessage('Content must be less than 1000 characters'),
    body('mediaUrls').optional().isArray().withMessage('Media URLs must be an array'),
    body('mediaUrls.*').optional().isURL().withMessage('Media URLs must be valid URLs'),
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

      const commentId = req.params.id
      const updateData = req.body

      const comment = await CommentsService.updateComment(commentId, req.user!.id, updateData)

      if (!comment) {
        return res.status(404).json({
          error: 'Comment not found',
          message: 'The requested comment could not be found.',
        })
      }

      logCommentEvent('COMMENT_UPDATED', comment.id, req.user!.id, {
        isEdited: true,
      })

      res.json({
        message: 'Comment updated successfully',
        comment,
      })
    } catch (error) {
      logger.error('Update comment error:', error)
      res.status(500).json({
        error: 'Comment update failed',
        message: 'An error occurred while updating the comment.',
      })
    }
  },
)

/**
 * @swagger
 * /api/v1/comments/{id}:
 *   delete:
 *     summary: Delete comment
 *     tags: [Comments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Comment deleted successfully
 *       404:
 *         description: Comment not found
 */
router.delete(
  '/:id',
  [param('id').isString().notEmpty().withMessage('Comment ID is required')],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation error',
          details: errors.array(),
        })
      }

      const commentId = req.params.id

      const success = await CommentsService.deleteComment(commentId, req.user!.id)

      if (!success) {
        return res.status(404).json({
          error: 'Comment not found',
          message: 'The requested comment could not be found.',
        })
      }

      logCommentEvent('COMMENT_DELETED', commentId, req.user!.id, {})

      res.json({
        message: 'Comment deleted successfully',
      })
    } catch (error) {
      logger.error('Delete comment error:', error)
      res.status(500).json({
        error: 'Comment deletion failed',
        message: 'An error occurred while deleting the comment.',
      })
    }
  },
)

export { router as commentsRouter }
