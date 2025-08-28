import express from 'express'
import {
  createShare,
  deleteShare,
  getShares,
  getShareById,
  getSharesByPost,
  getSharesByUser,
} from '../controllers/sharesController.js'
import { authenticateToken } from '../middlewares/auth.js'
import { generalRateLimit, createRateLimit } from '../middlewares/rateLimit.js'
import { requestSizeLimiter, sanitizeInput } from '../middlewares/security.js'

/**
 * @swagger
 * tags:
 *   name: Shares
 *   description: Share management endpoints
 */

const router = express.Router()

// Apply common middleware to all routes
router.use(authenticateToken)
router.use(generalRateLimit)
router.use(requestSizeLimiter)
router.use(sanitizeInput)

/**
 * @swagger
 * /api/v1/shares:
 *   get:
 *     summary: Get all shares with filtering and pagination
 *     description: Retrieves shares with optional filtering
 *     tags: [Shares]
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
 *         name: userId
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Shares retrieved successfully
 *       400:
 *         description: Invalid query parameters
 */
router.get('/', getShares)

/**
 * @swagger
 * /api/v1/shares:
 *   post:
 *     summary: Share a post
 *     description: Share an existing post
 *     tags: [Shares]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - postId
 *             properties:
 *               postId:
 *                 type: integer
 *                 description: ID of the post to share
 *     responses:
 *       201:
 *         description: Post shared successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Post not found
 *       409:
 *         description: Already shared
 */
router.post('/', createRateLimit, createShare)

/**
 * @swagger
 * /api/v1/shares/{id}:
 *   get:
 *     summary: Get a single share by ID
 *     tags: [Shares]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Share retrieved successfully
 *       404:
 *         description: Share not found
 */
router.get('/:id', getShareById)

/**
 * @swagger
 * /api/v1/shares/{id}:
 *   delete:
 *     summary: Delete a share
 *     description: Remove a share (only by the sharer)
 *     tags: [Shares]
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
 *         description: Share deleted successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Not the share owner
 *       404:
 *         description: Share not found
 */
router.delete('/:id', deleteShare)

/**
 * @swagger
 * /api/v1/shares/post/{postId}:
 *   get:
 *     summary: Get shares by post
 *     description: Retrieves all shares for a specific post
 *     tags: [Shares]
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
 *         description: Post shares retrieved successfully
 *       400:
 *         description: Invalid query parameters
 */
router.get('/post/:postId', getSharesByPost)

/**
 * @swagger
 * /api/v1/shares/user/{userId}:
 *   get:
 *     summary: Get shares by user
 *     description: Retrieves all shares by a specific user
 *     tags: [Shares]
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
 *         description: User shares retrieved successfully
 *       400:
 *         description: Invalid query parameters
 */
router.get('/user/:userId', getSharesByUser)

export default router
