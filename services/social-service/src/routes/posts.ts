import express from 'express'
import { body, param, query, validationResult } from 'express-validator'
import { prisma } from '../index.js'
import { redis } from '../index.js'
import logger, { logPostEvent } from '../config/logger.js'
import { PostsService } from '../services/postsService.js'

const router = express.Router()

/**
 * @swagger
 * /api/v1/posts:
 *   get:
 *     summary: Get posts feed
 *     tags: [Posts]
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
 *       - in: query
 *         name: authorId
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [TEXT, IMAGE, VIDEO, LINK, POLL]
 *       - in: query
 *         name: visibility
 *         schema:
 *           type: string
 *           enum: [PUBLIC, FRIENDS, PRIVATE]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, likesCount, commentsCount, sharesCount]
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Posts retrieved successfully
 */
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50'),
    query('authorId').optional().isString().withMessage('Author ID must be a string'),
    query('type')
      .optional()
      .isIn(['TEXT', 'IMAGE', 'VIDEO', 'LINK', 'POLL'])
      .withMessage('Invalid post type'),
    query('visibility')
      .optional()
      .isIn(['PUBLIC', 'FRIENDS', 'PRIVATE'])
      .withMessage('Invalid visibility'),
    query('search').optional().isString().withMessage('Search must be a string'),
    query('sortBy')
      .optional()
      .isIn(['createdAt', 'likesCount', 'commentsCount', 'sharesCount'])
      .withMessage('Invalid sort field'),
    query('sortOrder')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('Sort order must be asc or desc'),
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
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        authorId: req.query.authorId as string,
        type: req.query.type as any,
        visibility: req.query.visibility as any,
        search: req.query.search as string,
        sortBy: (req.query.sortBy as string) || 'createdAt',
        sortOrder: ((req.query.sortOrder as string) || 'desc') as 'asc' | 'desc',
      }

      const result = await PostsService.getPosts(filters)

      res.json(result)
    } catch (error) {
      logger.error('Get posts error:', error)
      res.status(500).json({
        error: 'Posts retrieval failed',
        message: 'An error occurred while retrieving posts.',
      })
    }
  },
)

/**
 * @swagger
 * /api/v1/posts/{id}:
 *   get:
 *     summary: Get post by ID
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Post retrieved successfully
 *       404:
 *         description: Post not found
 */
router.get(
  '/:id',
  [param('id').isString().notEmpty().withMessage('Post ID is required')],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation error',
          details: errors.array(),
        })
      }

      const postId = req.params.id

      // Try cache first
      const cachedPost = await redis.get(`post:${postId}`)
      if (cachedPost) {
        return res.json(JSON.parse(cachedPost))
      }

      const post = await PostsService.getPostById(postId)

      if (!post) {
        return res.status(404).json({
          error: 'Post not found',
          message: 'The requested post could not be found.',
        })
      }

      // Cache for 5 minutes
      await redis.setex(`post:${postId}`, 300, JSON.stringify(post))

      res.json(post)
    } catch (error) {
      logger.error('Get post error:', error)
      res.status(500).json({
        error: 'Post retrieval failed',
        message: 'An error occurred while retrieving the post.',
      })
    }
  },
)

/**
 * @swagger
 * /api/v1/posts:
 *   post:
 *     summary: Create a new post
 *     tags: [Posts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [TEXT, IMAGE, VIDEO, LINK, POLL]
 *                 default: TEXT
 *               visibility:
 *                 type: string
 *                 enum: [PUBLIC, FRIENDS, PRIVATE]
 *                 default: PUBLIC
 *               mediaUrls:
 *                 type: array
 *                 items:
 *                   type: string
 *               thumbnailUrl:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               mentions:
 *                 type: array
 *                 items:
 *                   type: string
 *               location:
 *                 type: string
 *               originalPostId:
 *                 type: string
 *               replyToId:
 *                 type: string
 *               threadId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Post created successfully
 *       400:
 *         description: Validation error
 */
router.post(
  '/',
  [
    body('content')
      .isString()
      .isLength({ min: 1, max: 5000 })
      .withMessage('Content is required and must be less than 5000 characters'),
    body('title')
      .optional()
      .isString()
      .isLength({ max: 200 })
      .withMessage('Title must be less than 200 characters'),
    body('type')
      .optional()
      .isIn(['TEXT', 'IMAGE', 'VIDEO', 'LINK', 'POLL'])
      .withMessage('Invalid post type'),
    body('visibility')
      .optional()
      .isIn(['PUBLIC', 'FRIENDS', 'PRIVATE'])
      .withMessage('Invalid visibility'),
    body('mediaUrls').optional().isArray().withMessage('Media URLs must be an array'),
    body('mediaUrls.*').optional().isURL().withMessage('Media URLs must be valid URLs'),
    body('thumbnailUrl').optional().isURL().withMessage('Thumbnail URL must be a valid URL'),
    body('tags').optional().isArray().withMessage('Tags must be an array'),
    body('tags.*').optional().isString().withMessage('Tags must be strings'),
    body('mentions').optional().isArray().withMessage('Mentions must be an array'),
    body('mentions.*').optional().isString().withMessage('Mentions must be strings'),
    body('location').optional().isString().withMessage('Location must be a string'),
    body('originalPostId').optional().isString().withMessage('Original post ID must be a string'),
    body('replyToId').optional().isString().withMessage('Reply to ID must be a string'),
    body('threadId').optional().isString().withMessage('Thread ID must be a string'),
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

      const postData = {
        ...req.body,
        authorId: req.user!.id,
      }

      const post = await PostsService.createPost(postData)

      // Clear feed cache
      await redis.del('posts:feed:*')

      logPostEvent('POST_CREATED', post.id, req.user!.id, {
        type: post.type,
        visibility: post.visibility,
      })

      res.status(201).json({
        message: 'Post created successfully',
        post,
      })
    } catch (error) {
      logger.error('Create post error:', error)
      res.status(500).json({
        error: 'Post creation failed',
        message: 'An error occurred while creating the post.',
      })
    }
  },
)

/**
 * @swagger
 * /api/v1/posts/{id}:
 *   put:
 *     summary: Update post
 *     tags: [Posts]
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
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               mediaUrls:
 *                 type: array
 *                 items:
 *                   type: string
 *               thumbnailUrl:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               mentions:
 *                 type: array
 *                 items:
 *                   type: string
 *               location:
 *                 type: string
 *     responses:
 *       200:
 *         description: Post updated successfully
 *       404:
 *         description: Post not found
 */
router.put(
  '/:id',
  [
    param('id').isString().notEmpty().withMessage('Post ID is required'),
    body('content')
      .optional()
      .isString()
      .isLength({ min: 1, max: 5000 })
      .withMessage('Content must be less than 5000 characters'),
    body('title')
      .optional()
      .isString()
      .isLength({ max: 200 })
      .withMessage('Title must be less than 200 characters'),
    body('mediaUrls').optional().isArray().withMessage('Media URLs must be an array'),
    body('mediaUrls.*').optional().isURL().withMessage('Media URLs must be valid URLs'),
    body('thumbnailUrl').optional().isURL().withMessage('Thumbnail URL must be a valid URL'),
    body('tags').optional().isArray().withMessage('Tags must be an array'),
    body('tags.*').optional().isString().withMessage('Tags must be strings'),
    body('mentions').optional().isArray().withMessage('Mentions must be an array'),
    body('mentions.*').optional().isString().withMessage('Mentions must be strings'),
    body('location').optional().isString().withMessage('Location must be a string'),
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

      const postId = req.params.id
      const updateData = req.body

      const post = await PostsService.updatePost(postId, req.user!.id, updateData)

      if (!post) {
        return res.status(404).json({
          error: 'Post not found',
          message: 'The requested post could not be found.',
        })
      }

      // Clear caches
      await redis.del(`post:${postId}`)
      await redis.del('posts:feed:*')

      logPostEvent('POST_UPDATED', post.id, req.user!.id, {
        isEdited: true,
      })

      res.json({
        message: 'Post updated successfully',
        post,
      })
    } catch (error) {
      logger.error('Update post error:', error)
      res.status(500).json({
        error: 'Post update failed',
        message: 'An error occurred while updating the post.',
      })
    }
  },
)

/**
 * @swagger
 * /api/v1/posts/{id}:
 *   delete:
 *     summary: Delete post
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Post deleted successfully
 *       404:
 *         description: Post not found
 */
router.delete(
  '/:id',
  [param('id').isString().notEmpty().withMessage('Post ID is required')],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation error',
          details: errors.array(),
        })
      }

      const postId = req.params.id

      const success = await PostsService.deletePost(postId, req.user!.id)

      if (!success) {
        return res.status(404).json({
          error: 'Post not found',
          message: 'The requested post could not be found.',
        })
      }

      // Clear caches
      await redis.del(`post:${postId}`)
      await redis.del('posts:feed:*')

      logPostEvent('POST_DELETED', postId, req.user!.id, {})

      res.json({
        message: 'Post deleted successfully',
      })
    } catch (error) {
      logger.error('Delete post error:', error)
      res.status(500).json({
        error: 'Post deletion failed',
        message: 'An error occurred while deleting the post.',
      })
    }
  },
)

/**
 * @swagger
 * /api/v1/posts/{id}/pin:
 *   post:
 *     summary: Pin or unpin post
 *     tags: [Posts]
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
 *             required:
 *               - pinned
 *             properties:
 *               pinned:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Post pin status updated successfully
 */
router.post(
  '/:id/pin',
  [
    param('id').isString().notEmpty().withMessage('Post ID is required'),
    body('pinned').isBoolean().withMessage('Pinned must be a boolean'),
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

      const postId = req.params.id
      const { pinned } = req.body

      const post = await PostsService.pinPost(postId, req.user!.id, pinned)

      if (!post) {
        return res.status(404).json({
          error: 'Post not found',
          message: 'The requested post could not be found.',
        })
      }

      // Clear caches
      await redis.del(`post:${postId}`)
      await redis.del('posts:feed:*')

      logPostEvent('POST_PINNED', post.id, req.user!.id, {
        pinned,
      })

      res.json({
        message: `Post ${pinned ? 'pinned' : 'unpinned'} successfully`,
        post,
      })
    } catch (error) {
      logger.error('Pin post error:', error)
      res.status(500).json({
        error: 'Post pin update failed',
        message: 'An error occurred while updating the post pin status.',
      })
    }
  },
)

export { router as postsRouter }
