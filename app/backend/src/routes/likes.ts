import express from 'express'
import {
  createLike,
  deleteLike,
  getLikes,
  getLikeById,
  getLikesByPost,
  getLikesByUser,
} from '../controllers/likesController.js'
import { authenticateToken } from '../middlewares/auth.js'
import { generalRateLimit, createRateLimit } from '../middlewares/rateLimit.js'
import { requestSizeLimiter, sanitizeInput } from '../middlewares/security.js'

/**
 * @swagger
 * tags:
 *   name: Likes
 *   description: Like management endpoints
 */

const router = express.Router()

// Apply common middleware to all routes
router.use(authenticateToken)
router.use(generalRateLimit)
router.use(requestSizeLimiter)
router.use(sanitizeInput)

/**
 * @swagger
 * /api/v1/likes:
 *   get:
 *     summary: Get all likes with filtering and pagination
 *     description: Retrieves likes with optional filtering
 *     tags: [Likes]
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
 *         name: commentId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: userId
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Likes retrieved successfully
 *       400:
 *         description: Invalid query parameters
 */
router.get('/', getLikes)

/**
 * @swagger
 * /api/v1/likes:
 *   post:
 *     summary: Create a new like
 *     description: Likes a post or comment
 *     tags: [Likes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               postId:
 *                 type: integer
 *               commentId:
 *                 type: integer
 *             description: Either postId or commentId must be provided
 *     responses:
 *       201:
 *         description: Like created successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Post or comment not found
 *       409:
 *         description: Already liked
 */
router.post('/', createRateLimit, createLike)

/**
 * @swagger
 * /api/v1/likes/{id}:
 *   get:
 *     summary: Get a single like by ID
 *     tags: [Likes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Like retrieved successfully
 *       404:
 *         description: Like not found
 */
router.get('/:id', getLikeById)

/**
 * @swagger
 * /api/v1/likes/{id}:
 *   delete:
 *     summary: Delete a like
 *     description: Unlikes a post or comment (only by the liker)
 *     tags: [Likes]
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
 *         description: Like deleted successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Not the like owner
 *       404:
 *         description: Like not found
 */
router.delete('/:id', deleteLike)

/**
 * @swagger
 * /api/v1/likes/post/{postId}:
 *   get:
 *     summary: Get likes by post
 *     description: Retrieves all likes for a specific post
 *     tags: [Likes]
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
 *         description: Post likes retrieved successfully
 *       400:
 *         description: Invalid query parameters
 */
router.get('/post/:postId', getLikesByPost)

/**
 * @swagger
 * /api/v1/likes/user/{userId}:
 *   get:
 *     summary: Get likes by user
 *     description: Retrieves all likes by a specific user
 *     tags: [Likes]
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
 *         description: User likes retrieved successfully
 *       400:
 *         description: Invalid query parameters
 */
router.get('/user/:userId', getLikesByUser)

export default router
