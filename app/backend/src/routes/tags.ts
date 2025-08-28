import express from 'express'
import {
  createTag,
  updateTag,
  deleteTag,
  getTags,
  getTagById,
} from '../controllers/tagsController.js'
import { authenticateToken } from '../middlewares/auth.js'
import { generalRateLimit, adminRateLimit } from '../middlewares/rateLimit.js'
import { requestSizeLimiter, sanitizeInput } from '../middlewares/security.js'

/**
 * @swagger
 * tags:
 *   name: Tags
 *   description: Tag management endpoints
 */

const router = express.Router()

// Public routes (no auth required)
router.get('/', generalRateLimit, getTags)
router.get('/:id', generalRateLimit, getTagById)

// Apply auth middleware to protected routes
router.use(authenticateToken)
router.use(requestSizeLimiter)
router.use(sanitizeInput)

/**
 * @swagger
 * /api/v1/tags:
 *   post:
 *     summary: Create a new tag (Admin only)
 *     description: Creates a new tag for categorizing content - Admin privileges required
 *     tags: [Tags]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 50
 *     responses:
 *       201:
 *         description: Tag created successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin privileges required
 *       409:
 *         description: Tag name already exists
 */
router.post('/', adminRateLimit, createTag)

/**
 * @swagger
 * /api/v1/tags/{id}:
 *   put:
 *     summary: Update a tag (Admin only)
 *     description: Updates an existing tag - Admin privileges required
 *     tags: [Tags]
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
 *               name:
 *                 type: string
 *                 maxLength: 50
 *     responses:
 *       200:
 *         description: Tag updated successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin privileges required
 *       404:
 *         description: Tag not found
 *       409:
 *         description: Tag name already exists
 */
router.put('/:id', adminRateLimit, updateTag)

/**
 * @swagger
 * /api/v1/tags/{id}:
 *   delete:
 *     summary: Delete a tag (Admin only)
 *     description: Deletes an existing tag - Admin privileges required
 *     tags: [Tags]
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
 *         description: Tag deleted successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin privileges required
 *       404:
 *         description: Tag not found
 */
router.delete('/:id', adminRateLimit, deleteTag)

export default router
