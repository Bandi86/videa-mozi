import express from 'express'
import {
  createComment,
  updateComment,
  deleteComment,
  getComments,
  getCommentById,
  getCommentsByPost,
  getCommentsByUser,
} from '../controllers/commentsController.js'
import { authenticateToken } from '../middlewares/auth.js'
import { generalRateLimit, createRateLimit, updateRateLimit } from '../middlewares/rateLimit.js'
import { requestSizeLimiter, sanitizeInput } from '../middlewares/security.js'

/**
 * @swagger
 * tags:
 *   name: Comments
 *   description: Comment management endpoints
 */

const router = express.Router()

// Apply common middleware to all routes
router.use(authenticateToken)
router.use(generalRateLimit)
router.use(requestSizeLimiter)
router.use(sanitizeInput)

/**
 * @swagger
 * /api/v1/comments:
 *   get:
 *     summary: Get all comments with filtering and pagination
 *     description: Retrieves comments with optional filtering
 *     tags: [Comments]
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
 *         name: postId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: authorId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: tagId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Comments retrieved successfully
 *       400:
 *         description: Invalid query parameters
 */
router.get('/', getComments)

/**
 * @swagger
 * /api/v1/comments:
 *   post:
 *     summary: Create a new comment
 *     description: Creates a new comment on a post or as a reply to another comment
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *               - postId
 *             properties:
 *               content:
 *                 type: string
 *                 maxLength: 2000
 *               postId:
 *                 type: integer
 *               parentId:
 *                 type: integer
 *                 description: ID of parent comment for nested replies
 *     responses:
 *       201:
 *         description: Comment created successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Post or parent comment not found
 */
router.post('/', createRateLimit, createComment)

/**
 * @swagger
 * /api/v1/comments/{id}:
 *   get:
 *     summary: Get a single comment by ID
 *     tags: [Comments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Comment retrieved successfully
 *       404:
 *         description: Comment not found
 */
router.get('/:id', getCommentById)

/**
 * @swagger
 * /api/v1/comments/{id}:
 *   put:
 *     summary: Update a comment
 *     description: Updates an existing comment (only by the author)
 *     tags: [Comments]
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
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 maxLength: 2000
 *     responses:
 *       200:
 *         description: Comment updated successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Not the comment author
 *       404:
 *         description: Comment not found
 */
router.put('/:id', updateRateLimit, updateComment)

/**
 * @swagger
 * /api/v1/comments/{id}:
 *   delete:
 *     summary: Delete a comment
 *     description: Deletes an existing comment and all its replies (only by the author)
 *     tags: [Comments]
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
 *         description: Comment deleted successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Not the comment author
 *       404:
 *         description: Comment not found
 */
router.delete('/:id', deleteComment)

/**
 * @swagger
 * /api/v1/comments/post/{postId}:
 *   get:
 *     summary: Get comments by post
 *     description: Retrieves all comments for a specific post
 *     tags: [Comments]
 *     parameters:
 *       - in: path
 *         name: postId
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
 *     responses:
 *       200:
 *         description: Post comments retrieved successfully
 *       400:
 *         description: Invalid query parameters
 */
router.get('/post/:postId', getCommentsByPost)

/**
 * @swagger
 * /api/v1/comments/user/{userId}:
 *   get:
 *     summary: Get comments by user
 *     description: Retrieves all comments by a specific user
 *     tags: [Comments]
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
 *     responses:
 *       200:
 *         description: User comments retrieved successfully
 *       400:
 *         description: Invalid query parameters
 */
router.get('/user/:userId', getCommentsByUser)

export default router
