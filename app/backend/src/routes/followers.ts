import express from 'express'
import {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  getFollowerById,
  getFollowersByUser,
  getFollowingByUser,
} from '../controllers/followersController.js'
import { authenticateToken } from '../middlewares/auth.js'
import { generalRateLimit, followRateLimit } from '../middlewares/rateLimit.js'
import { requestSizeLimiter, sanitizeInput } from '../middlewares/security.js'

/**
 * @swagger
 * tags:
 *   name: Followers
 *   description: Follower/Following management endpoints
 */

const router = express.Router()

// Apply common middleware to all routes
router.use(authenticateToken)
router.use(generalRateLimit)
router.use(requestSizeLimiter)
router.use(sanitizeInput)

/**
 * @swagger
 * /api/v1/followers:
 *   get:
 *     summary: Get followers with filtering and pagination
 *     description: Retrieves followers with optional filtering
 *     tags: [Followers]
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
 *         name: userId
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Followers retrieved successfully
 *       400:
 *         description: Invalid query parameters
 */
router.get('/', getFollowers)

/**
 * @swagger
 * /api/v1/followers/follow:
 *   post:
 *     summary: Follow a user
 *     description: Follow another user
 *     tags: [Followers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - followingId
 *             properties:
 *               followingId:
 *                 type: integer
 *                 description: ID of the user to follow
 *     responses:
 *       201:
 *         description: User followed successfully
 *       400:
 *         description: Invalid input data or self-following
 *       401:
 *         description: Authentication required
 *       404:
 *         description: User to follow not found
 *       409:
 *         description: Already following
 */
router.post('/follow', followRateLimit, followUser)

/**
 * @swagger
 * /api/v1/followers/unfollow/{id}:
 *   delete:
 *     summary: Unfollow a user
 *     description: Unfollow a user
 *     tags: [Followers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the user to unfollow
 *     responses:
 *       200:
 *         description: User unfollowed successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Not following this user
 */
router.delete('/unfollow/:id', unfollowUser)

/**
 * @swagger
 * /api/v1/followers/{id}:
 *   get:
 *     summary: Get a follower relationship by ID
 *     tags: [Followers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Follower relationship retrieved successfully
 *       404:
 *         description: Follower relationship not found
 */
router.get('/:id', getFollowerById)

/**
 * @swagger
 * /api/v1/followers/user/{userId}/followers:
 *   get:
 *     summary: Get followers by user
 *     description: Retrieves all followers of a specific user
 *     tags: [Followers]
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
 *         description: User followers retrieved successfully
 *       400:
 *         description: Invalid query parameters
 */
router.get('/user/:userId/followers', getFollowersByUser)

/**
 * @swagger
 * /api/v1/followers/user/{userId}/following:
 *   get:
 *     summary: Get following by user
 *     description: Retrieves all users followed by a specific user
 *     tags: [Followers]
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
 *         description: User following retrieved successfully
 *       400:
 *         description: Invalid query parameters
 */
router.get('/user/:userId/following', getFollowingByUser)

/**
 * @swagger
 * /api/v1/followers/following:
 *   get:
 *     summary: Get following with filtering and pagination
 *     description: Retrieves following relationships with optional filtering
 *     tags: [Followers]
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
 *         name: userId
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Following retrieved successfully
 *       400:
 *         description: Invalid query parameters
 */
router.get('/following', getFollowing)

export default router
