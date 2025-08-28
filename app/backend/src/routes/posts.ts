import express from 'express'
import {
  createPost,
  updatePost,
  deletePost,
  getPosts,
  getPostById,
  getPostsByUser,
} from '../controllers/postsController.js'
import { authenticateToken } from '../middlewares/auth.js'
import { generalRateLimit, createRateLimit, updateRateLimit } from '../middlewares/rateLimit.js'
import { requestSizeLimiter, sanitizeInput } from '../middlewares/security.js'
import { validationMiddleware } from '../middlewares/validation.js'

/**
 * @swagger
 * tags:
 *   name: Posts
 *   description: Post management endpoints
 */

/**
 * @swagger
 * /api/v1/posts:
 *   post:
 *     summary: Create a new post
 *     description: Creates a new post with optional category and tags
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - content
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 255
 *               content:
 *                 type: string
 *                 maxLength: 10000
 *               categoryId:
 *                 type: integer
 *               tagIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *               status:
 *                 type: string
 *                 enum: [DRAFT, PUBLISHED, ARCHIVED]
 *     responses:
 *       201:
 *         description: Post created successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient privileges
 */
const router = express.Router()

// Apply common middleware to all routes
router.use(authenticateToken)
router.use(generalRateLimit)
router.use(requestSizeLimiter)
router.use(sanitizeInput)

/**
 * @swagger
 * /api/v1/posts:
 *   get:
 *     summary: Get all posts with filtering and pagination
 *     description: Retrieves posts with optional filtering by category, tag, author, etc.
 *     tags: [Posts]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         default: 10
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: tagId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: authorId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, PUBLISHED, ARCHIVED]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           maxLength: 255
 *     responses:
 *       200:
 *         description: Posts retrieved successfully
 *       400:
 *         description: Invalid query parameters
 */
router.get('/', getPosts)

/**
 * @swagger
 * /api/v1/posts:
 *   post:
 *     summary: Create a new post
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', createRateLimit, createPost)

/**
 * @swagger
 * /api/v1/posts/{id}:
 *   get:
 *     summary: Get a single post by ID
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Post retrieved successfully
 *       404:
 *         description: Post not found
 */
router.get('/:id', getPostById)

/**
 * @swagger
 * /api/v1/posts/{id}:
 *   put:
 *     summary: Update a post
 *     description: Updates an existing post (only by the author)
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 255
 *               content:
 *                 type: string
 *                 maxLength: 10000
 *               categoryId:
 *                 type: integer
 *               tagIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *               status:
 *                 type: string
 *                 enum: [DRAFT, PUBLISHED, ARCHIVED]
 *     responses:
 *       200:
 *         description: Post updated successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Not the post author
 *       404:
 *         description: Post not found
 */
router.put('/:id', updateRateLimit, updatePost)

/**
 * @swagger
 * /api/v1/posts/{id}:
 *   delete:
 *     summary: Delete a post
 *     description: Deletes an existing post (only by the author)
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Post deleted successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Not the post author
 *       404:
 *         description: Post not found
 */
router.delete('/:id', deletePost)

/**
 * @swagger
 * /api/v1/posts/user/{userId}:
 *   get:
 *     summary: Get posts by user
 *     description: Retrieves all posts by a specific user
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         default: 10
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: tagId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           maxLength: 255
 *     responses:
 *       200:
 *         description: User posts retrieved successfully
 *       400:
 *         description: Invalid query parameters
 */
router.get('/user/:userId', getPostsByUser)

export default router
