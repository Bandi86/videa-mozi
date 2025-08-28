import express from 'express'
import {
  createCategory,
  updateCategory,
  deleteCategory,
  getCategories,
  getCategoryById,
} from '../controllers/categoriesController.js'
import { authenticateToken } from '../middlewares/auth.js'
import { generalRateLimit, adminRateLimit } from '../middlewares/rateLimit.js'
import { requestSizeLimiter, sanitizeInput } from '../middlewares/security.js'

/**
 * @swagger
 * tags:
 *   name: Categories
 *   description: Category management endpoints
 */

const router = express.Router()

// Public routes (no auth required)
router.get('/', generalRateLimit, getCategories)
router.get('/:id', generalRateLimit, getCategoryById)

// Apply auth middleware to protected routes
router.use(authenticateToken)
router.use(requestSizeLimiter)
router.use(sanitizeInput)

/**
 * @swagger
 * /api/v1/categories:
 *   post:
 *     summary: Create a new category (Admin only)
 *     description: Creates a new category for organizing posts - Admin privileges required
 *     tags: [Categories]
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
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       201:
 *         description: Category created successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin privileges required
 *       409:
 *         description: Category name already exists
 */
router.post('/', adminRateLimit, createCategory)

/**
 * @swagger
 * /api/v1/categories/{id}:
 *   put:
 *     summary: Update a category (Admin only)
 *     description: Updates an existing category - Admin privileges required
 *     tags: [Categories]
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
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Category updated successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin privileges required
 *       404:
 *         description: Category not found
 *       409:
 *         description: Category name already exists
 */
router.put('/:id', adminRateLimit, updateCategory)

/**
 * @swagger
 * /api/v1/categories/{id}:
 *   delete:
 *     summary: Delete a category (Admin only)
 *     description: Deletes an existing category - Admin privileges required
 *     tags: [Categories]
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
 *         description: Category deleted successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin privileges required
 *       404:
 *         description: Category not found
 */
router.delete('/:id', adminRateLimit, deleteCategory)

export default router
