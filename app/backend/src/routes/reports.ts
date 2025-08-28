import express from 'express'
import {
  createReport,
  updateReport,
  deleteReport,
  getReports,
  getReportById,
  getReportsByPost,
  getReportsByUser,
} from '../controllers/reportsController.js'
import { authenticateToken } from '../middlewares/auth.js'
import { generalRateLimit, createRateLimit, adminRateLimit } from '../middlewares/rateLimit.js'
import { requestSizeLimiter, sanitizeInput } from '../middlewares/security.js'

/**
 * @swagger
 * tags:
 *   name: Reports
 *   description: Report management endpoints (Admin/Moderator only for viewing)
 */

const router = express.Router()

// Apply common middleware to all routes
router.use(authenticateToken)
router.use(generalRateLimit)
router.use(requestSizeLimiter)
router.use(sanitizeInput)

/**
 * @swagger
 * /api/v1/reports:
 *   get:
 *     summary: Get all reports (Admin only)
 *     description: Retrieves reports with filtering and pagination - Admin privileges required
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
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
 *         name: reportedUserId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [SPAM, HARASSMENT, INAPPROPRIATE_CONTENT, COPYRIGHT_VIOLATION, OTHER]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, REVIEWED, RESOLVED, DISMISSED]
 *     responses:
 *       200:
 *         description: Reports retrieved successfully
 *       400:
 *         description: Invalid query parameters
 *       403:
 *         description: Admin privileges required
 */
router.get('/', adminRateLimit, getReports)

/**
 * @swagger
 * /api/v1/reports:
 *   post:
 *     summary: Create a new report
 *     description: Report a post, comment, or user for moderation
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - reason
 *             properties:
 *               postId:
 *                 type: integer
 *               commentId:
 *                 type: integer
 *               reportedUserId:
 *                 type: integer
 *               type:
 *                 type: string
 *                 enum: [SPAM, HARASSMENT, INAPPROPRIATE_CONTENT, COPYRIGHT_VIOLATION, OTHER]
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *               description:
 *                 type: string
 *                 maxLength: 2000
 *             description: Either postId, commentId, or reportedUserId must be provided
 *     responses:
 *       201:
 *         description: Report created successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Target content/user not found
 */
router.post('/', createRateLimit, createReport)

/**
 * @swagger
 * /api/v1/reports/{id}:
 *   get:
 *     summary: Get a single report by ID (Admin only)
 *     tags: [Reports]
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
 *         description: Report retrieved successfully
 *       403:
 *         description: Admin privileges required
 *       404:
 *         description: Report not found
 */
router.get('/:id', adminRateLimit, getReportById)

/**
 * @swagger
 * /api/v1/reports/{id}:
 *   put:
 *     summary: Update a report (Admin only)
 *     description: Update report status and review information - Admin privileges required
 *     tags: [Reports]
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
 *               status:
 *                 type: string
 *                 enum: [PENDING, REVIEWED, RESOLVED, DISMISSED]
 *               description:
 *                 type: string
 *                 maxLength: 2000
 *     responses:
 *       200:
 *         description: Report updated successfully
 *       400:
 *         description: Invalid input data
 *       403:
 *         description: Admin privileges required
 *       404:
 *         description: Report not found
 */
router.put('/:id', adminRateLimit, updateReport)

/**
 * @swagger
 * /api/v1/reports/{id}:
 *   delete:
 *     summary: Delete a report
 *     description: Delete a report (by reporter or admin)
 *     tags: [Reports]
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
 *         description: Report deleted successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Not the reporter or admin
 *       404:
 *         description: Report not found
 */
router.delete('/:id', deleteReport)

/**
 * @swagger
 * /api/v1/reports/post/{postId}:
 *   get:
 *     summary: Get reports by post (Admin only)
 *     description: Retrieves all reports for a specific post - Admin privileges required
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
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
 *         description: Post reports retrieved successfully
 *       400:
 *         description: Invalid query parameters
 *       403:
 *         description: Admin privileges required
 */
router.get('/post/:postId', adminRateLimit, getReportsByPost)

/**
 * @swagger
 * /api/v1/reports/user/{userId}:
 *   get:
 *     summary: Get reports by user (Admin only)
 *     description: Retrieves all reports about a specific user - Admin privileges required
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
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
 *         description: User reports retrieved successfully
 *       400:
 *         description: Invalid query parameters
 *       403:
 *         description: Admin privileges required
 */
router.get('/user/:userId', adminRateLimit, getReportsByUser)

export default router
