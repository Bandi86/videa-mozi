import express from 'express'
import { body, param, query, validationResult } from 'express-validator'
import { appealsService } from '../services/appealsService.js'
import logger from '../config/logger.js'

const router = express.Router()

/**
 * @swagger
 * /api/appeals:
 *   post:
 *     summary: Create a new appeal
 *     description: Submit an appeal for a moderation decision
 *     tags: [Appeals]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reportId, appellantId, reason]
 *             properties:
 *               reportId:
 *                 type: string
 *                 description: ID of the report being appealed
 *               appellantId:
 *                 type: string
 *                 description: ID of the user submitting the appeal
 *               reason:
 *                 type: string
 *                 description: Reason for the appeal
 *             example:
 *               reportId: "report123"
 *               appellantId: "user456"
 *               reason: "I believe this content should not have been removed"
 *     responses:
 *       201:
 *         description: Appeal created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Appeal'
 *       400:
 *         description: Validation error
 *       500:
 *         description: Internal server error
 */
router.post(
  '/',
  [
    body('reportId').isString().notEmpty(),
    body('appellantId').isString().notEmpty(),
    body('reason').isString().notEmpty(),
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

      const appeal = await appealsService.createAppeal(req.body)

      res.status(201).json({
        message: 'Appeal created successfully',
        appeal,
      })
    } catch (error: any) {
      logger.error('Create appeal error:', error)
      res.status(500).json({
        error: 'Failed to create appeal',
        message: error.message,
      })
    }
  },
)

/**
 * @swagger
 * /api/appeals/{id}:
 *   get:
 *     summary: Get appeal by ID
 *     description: Retrieve a specific appeal by its ID
 *     tags: [Appeals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Appeal ID
 *     responses:
 *       200:
 *         description: Appeal retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Appeal'
 *       404:
 *         description: Appeal not found
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

    const appeal = await appealsService.getAppealById(req.params.id)

    res.json({
      appeal,
    })
  } catch (error: any) {
    logger.error('Get appeal error:', error)

    if (error.message === 'Appeal not found') {
      return res.status(404).json({
        error: 'Appeal not found',
      })
    }

    res.status(500).json({
      error: 'Failed to get appeal',
      message: error.message,
    })
  }
})

/**
 * @swagger
 * /api/appeals:
 *   get:
 *     summary: Get appeals with filtering
 *     description: Retrieve appeals with optional filtering and pagination
 *     tags: [Appeals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: appellantId
 *         schema:
 *           type: string
 *         description: Filter by appellant ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
 *         description: Filter by appeal status
 *       - in: query
 *         name: reviewedBy
 *         schema:
 *           type: string
 *         description: Filter by reviewer ID
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
 *         description: Appeals retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Appeal'
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
    query('appellantId').optional().isString(),
    query('status').optional().isIn(['PENDING', 'APPROVED', 'REJECTED']),
    query('reviewedBy').optional().isString(),
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
        appellantId: req.query.appellantId as string,
        status: req.query.status as any,
        reviewedBy: req.query.reviewedBy as string,
      }

      const pagination = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      }

      const result = await appealsService.getAppeals(filters, pagination)

      res.json(result)
    } catch (error: any) {
      logger.error('Get appeals error:', error)
      res.status(500).json({
        error: 'Failed to get appeals',
        message: error.message,
      })
    }
  },
)

/**
 * @swagger
 * /api/appeals/{id}:
 *   put:
 *     summary: Update appeal
 *     description: Update appeal details or status
 *     tags: [Appeals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Appeal ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [PENDING, APPROVED, REJECTED]
 *                 description: New status for the appeal
 *               reviewedBy:
 *                 type: string
 *                 description: ID of the reviewer (optional)
 *               reviewedAt:
 *                 type: string
 *                 format: date-time
 *                 description: Review timestamp (optional)
 *               reviewNotes:
 *                 type: string
 *                 description: Review notes (optional)
 *             example:
 *               status: "APPROVED"
 *               reviewNotes: "Appeal approved after review"
 *     responses:
 *       200:
 *         description: Appeal updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Appeal'
 *       404:
 *         description: Appeal not found
 *       500:
 *         description: Internal server error
 */
router.put(
  '/:id',
  [
    param('id').isString().notEmpty(),
    body('status').optional().isIn(['PENDING', 'APPROVED', 'REJECTED']),
    body('reviewedBy').optional().isString(),
    body('reviewedAt').optional().isISO8601(),
    body('reviewNotes').optional().isString(),
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

      const appeal = await appealsService.updateAppeal(req.params.id, req.body)

      res.json({
        message: 'Appeal updated successfully',
        appeal,
      })
    } catch (error: any) {
      logger.error('Update appeal error:', error)
      res.status(500).json({
        error: 'Failed to update appeal',
        message: error.message,
      })
    }
  },
)

/**
 * @swagger
 * /api/appeals/{id}/approve:
 *   post:
 *     summary: Approve appeal
 *     description: Approve an appeal and update the original report
 *     tags: [Appeals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Appeal ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reviewerId]
 *             properties:
 *               reviewerId:
 *                 type: string
 *                 description: ID of the reviewer approving the appeal
 *               reviewNotes:
 *                 type: string
 *                 description: Review notes (optional)
 *             example:
 *               reviewerId: "mod123"
 *               reviewNotes: "Appeal approved after careful review"
 *     responses:
 *       200:
 *         description: Appeal approved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Appeal'
 *       404:
 *         description: Appeal not found
 *       500:
 *         description: Internal server error
 */
router.post(
  '/:id/approve',
  [
    param('id').isString().notEmpty(),
    body('reviewerId').isString().notEmpty(),
    body('reviewNotes').optional().isString(),
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

      const appeal = await appealsService.approveAppeal(
        req.params.id,
        req.body.reviewerId,
        req.body.reviewNotes,
      )

      res.json({
        message: 'Appeal approved successfully',
        appeal,
      })
    } catch (error: any) {
      logger.error('Approve appeal error:', error)
      res.status(500).json({
        error: 'Failed to approve appeal',
        message: error.message,
      })
    }
  },
)

/**
 * @swagger
 * /api/appeals/{id}/reject:
 *   post:
 *     summary: Reject appeal
 *     description: Reject an appeal with review notes
 *     tags: [Appeals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Appeal ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reviewerId]
 *             properties:
 *               reviewerId:
 *                 type: string
 *                 description: ID of the reviewer rejecting the appeal
 *               reviewNotes:
 *                 type: string
 *                 description: Review notes explaining the rejection
 *             example:
 *               reviewerId: "mod123"
 *               reviewNotes: "Appeal rejected due to policy violation"
 *     responses:
 *       200:
 *         description: Appeal rejected successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Appeal'
 *       404:
 *         description: Appeal not found
 *       500:
 *         description: Internal server error
 */
router.post(
  '/:id/reject',
  [
    param('id').isString().notEmpty(),
    body('reviewerId').isString().notEmpty(),
    body('reviewNotes').optional().isString(),
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

      const appeal = await appealsService.rejectAppeal(
        req.params.id,
        req.body.reviewerId,
        req.body.reviewNotes,
      )

      res.json({
        message: 'Appeal rejected successfully',
        appeal,
      })
    } catch (error: any) {
      logger.error('Reject appeal error:', error)
      res.status(500).json({
        error: 'Failed to reject appeal',
        message: error.message,
      })
    }
  },
)

/**
 * @swagger
 * /api/appeals/{id}:
 *   delete:
 *     summary: Delete appeal
 *     description: Delete an appeal (admin only)
 *     tags: [Appeals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Appeal ID
 *     responses:
 *       200:
 *         description: Appeal deleted successfully
 *       404:
 *         description: Appeal not found
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

    await appealsService.deleteAppeal(req.params.id)

    res.json({
      message: 'Appeal deleted successfully',
    })
  } catch (error: any) {
    logger.error('Delete appeal error:', error)
    res.status(500).json({
      error: 'Failed to delete appeal',
      message: error.message,
    })
  }
})

/**
 * @swagger
 * /api/appeals/user/{appellantId}:
 *   get:
 *     summary: Get appeals by appellant
 *     description: Retrieve all appeals submitted by a specific user
 *     tags: [Appeals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appellantId
 *         required: true
 *         schema:
 *           type: string
 *         description: Appellant ID
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
 *         description: Appeals retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Appeal'
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
  '/user/:appellantId',
  [
    param('appellantId').isString().notEmpty(),
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

      const pagination = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      }

      const result = await appealsService.getAppealsByAppellant(req.params.appellantId, pagination)

      res.json(result)
    } catch (error: any) {
      logger.error('Get appeals by appellant error:', error)
      res.status(500).json({
        error: 'Failed to get appeals',
        message: error.message,
      })
    }
  },
)

/**
 * @swagger
 * /api/appeals/pending:
 *   get:
 *     summary: Get pending appeals
 *     description: Retrieve all appeals that are pending review
 *     tags: [Appeals]
 *     security:
 *       - bearerAuth: []
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
 *           maximum: 100
 *           default: 20
 *     responses:
 *       200:
 *         description: Pending appeals retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Appeal'
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
  '/pending/all',
  [
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

      const pagination = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      }

      const result = await appealsService.getPendingAppeals(pagination)

      res.json(result)
    } catch (error: any) {
      logger.error('Get pending appeals error:', error)
      res.status(500).json({
        error: 'Failed to get pending appeals',
        message: error.message,
      })
    }
  },
)

/**
 * @swagger
 * /api/appeals/report/{reportId}/timeline:
 *   get:
 *     summary: Get appeal timeline for a report
 *     description: Retrieve the appeal timeline including appeal creation and review
 *     tags: [Appeals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: string
 *         description: Report ID
 *     responses:
 *       200:
 *         description: Appeal timeline retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 appeal:
 *                   $ref: '#/components/schemas/Appeal'
 *                 timeline:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       type:
 *                         type: string
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                       user:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           username:
 *                             type: string
 *                       description:
 *                         type: string
 *                       details:
 *                         type: string
 *                     required: [type, timestamp, user, description]
 *               required: [appeal, timeline]
 *       404:
 *         description: No appeal found for this report
 *       500:
 *         description: Internal server error
 */
router.get(
  '/report/:reportId/timeline',
  [param('reportId').isString().notEmpty()],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        })
      }

      const timeline = await appealsService.getAppealTimeline(req.params.reportId)

      res.json(timeline)
    } catch (error: any) {
      logger.error('Get appeal timeline error:', error)

      if (error.message === 'Appeal not found for this report') {
        return res.status(404).json({
          error: 'No appeal found for this report',
        })
      }

      res.status(500).json({
        error: 'Failed to get appeal timeline',
        message: error.message,
      })
    }
  },
)

/**
 * @swagger
 * /api/appeals/can-appeal:
 *   post:
 *     summary: Check if user can appeal a report
 *     description: Check if a user is eligible to appeal a specific report
 *     tags: [Appeals]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reportId, userId]
 *             properties:
 *               reportId:
 *                 type: string
 *                 description: ID of the report to check
 *               userId:
 *                 type: string
 *                 description: ID of the user who wants to appeal
 *             example:
 *               reportId: "report123"
 *               userId: "user456"
 *     responses:
 *       200:
 *         description: Appeal eligibility checked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 canAppeal:
 *                   type: boolean
 *                   description: Whether the user can appeal the report
 *               required: [canAppeal]
 *       400:
 *         description: Validation error
 *       500:
 *         description: Internal server error
 */
router.post(
  '/can-appeal',
  [body('reportId').isString().notEmpty(), body('userId').isString().notEmpty()],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        })
      }

      const canAppeal = await appealsService.canUserAppeal(req.body.reportId, req.body.userId)

      res.json({
        canAppeal,
      })
    } catch (error: any) {
      logger.error('Check appeal eligibility error:', error)
      res.status(500).json({
        error: 'Failed to check appeal eligibility',
        message: error.message,
      })
    }
  },
)

/**
 * @swagger
 * /api/appeals/stats:
 *   get:
 *     summary: Get appeal statistics
 *     description: Get comprehensive statistics about appeals
 *     tags: [Appeals]
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
 *                 approved:
 *                   type: integer
 *                 rejected:
 *                   type: integer
 *                 byStatus:
 *                   type: object
 *                   additionalProperties:
 *                     type: integer
 *               required: [total, pending, approved, rejected, byStatus]
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

      const stats = await appealsService.getAppealStats(dateFrom, dateTo)

      res.json(stats)
    } catch (error: any) {
      logger.error('Get appeal stats error:', error)
      res.status(500).json({
        error: 'Failed to get appeal statistics',
        message: error.message,
      })
    }
  },
)

export { router as appealsRouter }
