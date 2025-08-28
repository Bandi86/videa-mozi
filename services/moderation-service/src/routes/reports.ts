import express from 'express'
import { body, param, query, validationResult } from 'express-validator'
import { reportsService } from '../services/reportsService.js'
import logger from '../config/logger.js'

const router = express.Router()

/**
 * @swagger
 * /api/reports:
 *   post:
 *     summary: Create a new report
 *     description: Submit a new report for content moderation
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reporterId, reportType]
 *             properties:
 *               reporterId:
 *                 type: string
 *                 description: ID of the user submitting the report
 *               reportedUserId:
 *                 type: string
 *                 description: ID of the user being reported (optional)
 *               contentId:
 *                 type: string
 *                 description: ID of the content being reported (optional)
 *               contentType:
 *                 type: string
 *                 enum: [POST, COMMENT, USER_PROFILE, MEDIA, MESSAGE]
 *                 description: Type of content being reported (optional)
 *               reportType:
 *                 type: string
 *                 enum: [SPAM, HARASSMENT, INAPPROPRIATE_CONTENT, COPYRIGHT_VIOLATION, HATE_SPEECH, THREAT, MISLEADING, OTHER]
 *                 description: Type of report
 *               reason:
 *                 type: string
 *                 description: Reason for the report (optional)
 *               description:
 *                 type: string
 *                 description: Detailed description of the issue (optional)
 *               priority:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 4
 *                 description: Priority level (optional, auto-calculated if not provided)
 *             example:
 *               reporterId: "user123"
 *               reportedUserId: "user456"
 *               contentId: "post789"
 *               contentType: "POST"
 *               reportType: "HARASSMENT"
 *               reason: "Inappropriate language"
 *               description: "The post contains offensive language and threats"
 *     responses:
 *       201:
 *         description: Report created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Report'
 *       400:
 *         description: Validation error
 *       500:
 *         description: Internal server error
 */
router.post(
  '/',
  [
    body('reporterId').isString().notEmpty(),
    body('reportedUserId').optional().isString(),
    body('contentId').optional().isString(),
    body('contentType').optional().isIn(['POST', 'COMMENT', 'USER_PROFILE', 'MEDIA', 'MESSAGE']),
    body('reportType').isIn([
      'SPAM',
      'HARASSMENT',
      'INAPPROPRIATE_CONTENT',
      'COPYRIGHT_VIOLATION',
      'HATE_SPEECH',
      'THREAT',
      'MISLEADING',
      'OTHER',
    ]),
    body('reason').optional().isString(),
    body('description').optional().isString(),
    body('priority').optional().isInt({ min: 1, max: 4 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        })
      }

      const report = await reportsService.createReport(req.body)

      res.status(201).json({
        message: 'Report created successfully',
        report,
      })
    } catch (error: any) {
      logger.error('Create report error:', error)
      res.status(500).json({
        error: 'Failed to create report',
        message: error.message,
      })
    }
  },
)

/**
 * @swagger
 * /api/reports/{id}:
 *   get:
 *     summary: Get report by ID
 *     description: Retrieve a specific report by its ID
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Report ID
 *     responses:
 *       200:
 *         description: Report retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Report'
 *       404:
 *         description: Report not found
 *       500:
 *         description: Internal server error
 */
router.get('/:id', [param('id').isString().notEmpty()], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      })
    }

    const report = await reportsService.getReportById(req.params.id)

    res.json({
      report,
    })
  } catch (error: any) {
    logger.error('Get report error:', error)

    if (error.message === 'Report not found') {
      return res.status(404).json({
        error: 'Report not found',
      })
    }

    res.status(500).json({
      error: 'Failed to get report',
      message: error.message,
    })
  }
})

/**
 * @swagger
 * /api/reports:
 *   get:
 *     summary: Get reports with filtering
 *     description: Retrieve reports with optional filtering and pagination
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, UNDER_REVIEW, RESOLVED, DISMISSED]
 *       - in: query
 *         name: reportType
 *         schema:
 *           type: string
 *           enum: [SPAM, HARASSMENT, INAPPROPRIATE_CONTENT, COPYRIGHT_VIOLATION, HATE_SPEECH, THREAT, MISLEADING, OTHER]
 *       - in: query
 *         name: priority
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 4
 *       - in: query
 *         name: assignedTo
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
 *           maximum: 100
 *           default: 20
 *     responses:
 *       200:
 *         description: Reports retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Report'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *               required: [data, pagination]
 *       500:
 *         description: Internal server error
 */
router.get(
  '/',
  [
    query('status').optional().isIn(['PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED']),
    query('reportType')
      .optional()
      .isIn([
        'SPAM',
        'HARASSMENT',
        'INAPPROPRIATE_CONTENT',
        'COPYRIGHT_VIOLATION',
        'HATE_SPEECH',
        'THREAT',
        'MISLEADING',
        'OTHER',
      ]),
    query('priority').optional().isInt({ min: 1, max: 4 }),
    query('assignedTo').optional().isString(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        })
      }

      const filters = {
        status: req.query.status as any,
        reportType: req.query.reportType as any,
        priority: req.query.priority ? parseInt(req.query.priority as string) : undefined,
        assignedTo: req.query.assignedTo as string,
      }

      const pagination = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      }

      const result = await reportsService.getReports(filters, pagination)

      res.json(result)
    } catch (error: any) {
      logger.error('Get reports error:', error)
      res.status(500).json({
        error: 'Failed to get reports',
        message: error.message,
      })
    }
  },
)

/**
 * @swagger
 * /api/reports/{id}:
 *   put:
 *     summary: Update a report
 *     description: Update report details, status, or assignment
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Report ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [PENDING, UNDER_REVIEW, RESOLVED, DISMISSED]
 *               priority:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 4
 *               assignedTo:
 *                 type: string
 *                 description: Moderator ID to assign the report to
 *               resolution:
 *                 type: string
 *                 description: Resolution notes when closing the report
 *             example:
 *               status: "RESOLVED"
 *               resolution: "Content removed and user warned"
 *     responses:
 *       200:
 *         description: Report updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Report'
 *       404:
 *         description: Report not found
 *       500:
 *         description: Internal server error
 */
router.put(
  '/:id',
  [
    param('id').isString().notEmpty(),
    body('status').optional().isIn(['PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED']),
    body('priority').optional().isInt({ min: 1, max: 4 }),
    body('assignedTo').optional().isString(),
    body('resolution').optional().isString(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        })
      }

      const report = await reportsService.updateReport(req.params.id, req.body)

      res.json({
        message: 'Report updated successfully',
        report,
      })
    } catch (error: any) {
      logger.error('Update report error:', error)
      res.status(500).json({
        error: 'Failed to update report',
        message: error.message,
      })
    }
  },
)

/**
 * @swagger
 * /api/reports/{id}/assign:
 *   post:
 *     summary: Assign report to moderator
 *     description: Assign a report to a specific moderator for review
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Report ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [moderatorId]
 *             properties:
 *               moderatorId:
 *                 type: string
 *                 description: ID of the moderator to assign the report to
 *             example:
 *               moderatorId: "mod123"
 *     responses:
 *       200:
 *         description: Report assigned successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Report'
 *       404:
 *         description: Report not found
 *       500:
 *         description: Internal server error
 */
router.post(
  '/:id/assign',
  [param('id').isString().notEmpty(), body('moderatorId').isString().notEmpty()],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        })
      }

      const report = await reportsService.assignReport(req.params.id, req.body.moderatorId)

      res.json({
        message: 'Report assigned successfully',
        report,
      })
    } catch (error: any) {
      logger.error('Assign report error:', error)
      res.status(500).json({
        error: 'Failed to assign report',
        message: error.message,
      })
    }
  },
)

/**
 * @swagger
 * /api/reports/{id}/resolve:
 *   post:
 *     summary: Resolve a report
 *     description: Mark a report as resolved with resolution notes
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Report ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [resolution]
 *             properties:
 *               resolution:
 *                 type: string
 *                 description: Resolution notes and actions taken
 *             example:
 *               resolution: "Content removed and user issued warning"
 *     responses:
 *       200:
 *         description: Report resolved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Report'
 *       404:
 *         description: Report not found
 *       500:
 *         description: Internal server error
 */
router.post(
  '/:id/resolve',
  [param('id').isString().notEmpty(), body('resolution').isString().notEmpty()],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        })
      }

      // Get moderator ID from request (would come from auth middleware)
      const moderatorId = req.user?.id || 'system'

      const report = await reportsService.resolveReport(
        req.params.id,
        req.body.resolution,
        moderatorId,
      )

      res.json({
        message: 'Report resolved successfully',
        report,
      })
    } catch (error: any) {
      logger.error('Resolve report error:', error)
      res.status(500).json({
        error: 'Failed to resolve report',
        message: error.message,
      })
    }
  },
)

/**
 * @swagger
 * /api/reports/{id}:
 *   delete:
 *     summary: Delete a report
 *     description: Delete a report (admin/moderator only)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Report ID
 *     responses:
 *       200:
 *         description: Report deleted successfully
 *       404:
 *         description: Report not found
 *       500:
 *         description: Internal server error
 */
router.delete('/:id', [param('id').isString().notEmpty()], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      })
    }

    await reportsService.deleteReport(req.params.id)

    res.json({
      message: 'Report deleted successfully',
    })
  } catch (error: any) {
    logger.error('Delete report error:', error)
    res.status(500).json({
      error: 'Failed to delete report',
      message: error.message,
    })
  }
})

/**
 * @swagger
 * /api/reports/stats:
 *   get:
 *     summary: Get report statistics
 *     description: Get comprehensive statistics about reports
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for statistics (ISO 8601)
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for statistics (ISO 8601)
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                 pending:
 *                   type: integer
 *                 resolved:
 *                   type: integer
 *                 dismissed:
 *                   type: integer
 *                 byType:
 *                   type: object
 *                   additionalProperties:
 *                     type: integer
 *                 byPriority:
 *                   type: object
 *                   additionalProperties:
 *                     type: integer
 *               required: [total, pending, resolved, dismissed, byType, byPriority]
 *       500:
 *         description: Internal server error
 */
router.get(
  '/stats/summary',
  [query('dateFrom').optional().isISO8601(), query('dateTo').optional().isISO8601()],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        })
      }

      const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined
      const dateTo = req.query.dateTo ? new Date(req.query.dateTo as string) : undefined

      const stats = await reportsService.getReportStats(dateFrom, dateTo)

      res.json(stats)
    } catch (error: any) {
      logger.error('Get report stats error:', error)
      res.status(500).json({
        error: 'Failed to get report statistics',
        message: error.message,
      })
    }
  },
)

export { router as reportsRouter }
