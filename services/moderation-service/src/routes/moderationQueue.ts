import express from 'express'
import { body, param, query, validationResult } from 'express-validator'
import { moderationQueueService } from '../services/moderationQueueService.js'
import logger from '../config/logger.js'

const router = express.Router()

/**
 * @swagger
 * /api/moderation-queue:
 *   post:
 *     summary: Add item to moderation queue
 *     description: Add content to the moderation queue for review
 *     tags: [Moderation Queue]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [contentId, contentType]
 *             properties:
 *               contentId:
 *                 type: string
 *                 description: ID of the content to moderate
 *               contentType:
 *                 type: string
 *                 enum: [POST, COMMENT, USER_PROFILE, MEDIA, MESSAGE]
 *                 description: Type of content being moderated
 *               priority:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 4
 *                 description: Priority level (optional, auto-calculated if not provided)
 *               reason:
 *                 type: string
 *                 description: Reason for moderation (optional)
 *               flags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of content flag IDs (optional)
 *             example:
 *               contentId: "post123"
 *               contentType: "POST"
 *               priority: 3
 *               reason: "Multiple reports of inappropriate content"
 *               flags: ["flag1", "flag2"]
 *     responses:
 *       201:
 *         description: Item added to moderation queue successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ModerationQueueItem'
 *       400:
 *         description: Validation error
 *       500:
 *         description: Internal server error
 */
router.post(
  '/',
  [
    body('contentId').isString().notEmpty(),
    body('contentType').isIn(['POST', 'COMMENT', 'USER_PROFILE', 'MEDIA', 'MESSAGE']),
    body('priority').optional().isInt({ min: 1, max: 4 }),
    body('reason').optional().isString(),
    body('flags').optional().isArray(),
    body('flags.*').optional().isString(),
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

      const queueItem = await moderationQueueService.addToQueue(req.body)

      res.status(201).json({
        message: 'Item added to moderation queue successfully',
        queueItem,
      })
    } catch (error: any) {
      logger.error('Add to moderation queue error:', error)
      res.status(500).json({
        error: 'Failed to add item to moderation queue',
        message: error.message,
      })
    }
  },
)

/**
 * @swagger
 * /api/moderation-queue/{id}:
 *   get:
 *     summary: Get queue item by ID
 *     description: Retrieve a specific moderation queue item by its ID
 *     tags: [Moderation Queue]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Queue item ID
 *     responses:
 *       200:
 *         description: Queue item retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ModerationQueueItem'
 *       404:
 *         description: Queue item not found
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

    const item = await moderationQueueService.getQueueItemById(req.params.id)

    res.json({
      item,
    })
  } catch (error: any) {
    logger.error('Get queue item error:', error)

    if (error.message === 'Queue item not found') {
      return res.status(404).json({
        error: 'Queue item not found',
      })
    }

    res.status(500).json({
      error: 'Failed to get queue item',
      message: error.message,
    })
  }
})

/**
 * @swagger
 * /api/moderation-queue:
 *   get:
 *     summary: Get moderation queue items with filtering
 *     description: Retrieve moderation queue items with optional filtering and pagination
 *     tags: [Moderation Queue]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: contentType
 *         schema:
 *           type: string
 *           enum: [POST, COMMENT, USER_PROFILE, MEDIA, MESSAGE]
 *         description: Filter by content type
 *       - in: query
 *         name: priority
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 4
 *         description: Filter by priority
 *       - in: query
 *         name: assignedTo
 *         schema:
 *           type: string
 *         description: Filter by assigned moderator
 *       - in: query
 *         name: isProcessed
 *         schema:
 *           type: boolean
 *         description: Filter by processing status
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
 *         description: Queue items retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ModerationQueueItem'
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
    query('contentType').optional().isIn(['POST', 'COMMENT', 'USER_PROFILE', 'MEDIA', 'MESSAGE']),
    query('priority').optional().isInt({ min: 1, max: 4 }),
    query('assignedTo').optional().isString(),
    query('isProcessed').optional().isBoolean(),
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
        contentType: req.query.contentType as any,
        priority: req.query.priority ? parseInt(req.query.priority as string) : undefined,
        assignedTo: req.query.assignedTo as string,
        isProcessed: req.query.isProcessed ? req.query.isProcessed === 'true' : undefined,
      }

      const pagination = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      }

      const result = await moderationQueueService.getQueueItems(filters, pagination)

      res.json(result)
    } catch (error: any) {
      logger.error('Get queue items error:', error)
      res.status(500).json({
        error: 'Failed to get queue items',
        message: error.message,
      })
    }
  },
)

/**
 * @swagger
 * /api/moderation-queue/{id}:
 *   put:
 *     summary: Update queue item
 *     description: Update moderation queue item details
 *     tags: [Moderation Queue]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Queue item ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               assignedTo:
 *                 type: string
 *                 description: ID of the moderator to assign
 *               isProcessed:
 *                 type: boolean
 *                 description: Whether the item has been processed
 *               processedAt:
 *                 type: string
 *                 format: date-time
 *                 description: When the item was processed
 *               action:
 *                 type: string
 *                 enum: [NONE, WARNING, CONTENT_REMOVAL, USER_SUSPENSION, USER_BAN, CONTENT_QUARANTINE]
 *                 description: Moderation action taken
 *               notes:
 *                 type: string
 *                 description: Additional notes about the moderation action
 *             example:
 *               assignedTo: "mod123"
 *               isProcessed: true
 *               action: "CONTENT_REMOVAL"
 *               notes: "Content removed due to policy violation"
 *     responses:
 *       200:
 *         description: Queue item updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ModerationQueueItem'
 *       404:
 *         description: Queue item not found
 *       500:
 *         description: Internal server error
 */
router.put(
  '/:id',
  [
    param('id').isString().notEmpty(),
    body('assignedTo').optional().isString(),
    body('isProcessed').optional().isBoolean(),
    body('processedAt').optional().isISO8601(),
    body('action')
      .optional()
      .isIn([
        'NONE',
        'WARNING',
        'CONTENT_REMOVAL',
        'USER_SUSPENSION',
        'USER_BAN',
        'CONTENT_QUARANTINE',
      ]),
    body('notes').optional().isString(),
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

      const item = await moderationQueueService.updateQueueItem(req.params.id, req.body)

      res.json({
        message: 'Queue item updated successfully',
        item,
      })
    } catch (error: any) {
      logger.error('Update queue item error:', error)
      res.status(500).json({
        error: 'Failed to update queue item',
        message: error.message,
      })
    }
  },
)

/**
 * @swagger
 * /api/moderation-queue/{id}/assign:
 *   post:
 *     summary: Assign queue item to moderator
 *     description: Assign a moderation queue item to a specific moderator
 *     tags: [Moderation Queue]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Queue item ID
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
 *                 description: ID of the moderator to assign the item to
 *             example:
 *               moderatorId: "mod123"
 *     responses:
 *       200:
 *         description: Queue item assigned successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ModerationQueueItem'
 *       404:
 *         description: Queue item not found
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

      const item = await moderationQueueService.assignQueueItem(req.params.id, req.body.moderatorId)

      res.json({
        message: 'Queue item assigned successfully',
        item,
      })
    } catch (error: any) {
      logger.error('Assign queue item error:', error)
      res.status(500).json({
        error: 'Failed to assign queue item',
        message: error.message,
      })
    }
  },
)

/**
 * @swagger
 * /api/moderation-queue/{id}/process:
 *   post:
 *     summary: Process queue item
 *     description: Mark a moderation queue item as processed with action taken
 *     tags: [Moderation Queue]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Queue item ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [action]
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [NONE, WARNING, CONTENT_REMOVAL, USER_SUSPENSION, USER_BAN, CONTENT_QUARANTINE]
 *                 description: Moderation action taken
 *               notes:
 *                 type: string
 *                 description: Additional notes about the moderation action
 *             example:
 *               action: "CONTENT_REMOVAL"
 *               notes: "Content removed due to policy violation"
 *     responses:
 *       200:
 *         description: Queue item processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ModerationQueueItem'
 *       404:
 *         description: Queue item not found
 *       500:
 *         description: Internal server error
 */
router.post(
  '/:id/process',
  [
    param('id').isString().notEmpty(),
    body('action').isIn([
      'NONE',
      'WARNING',
      'CONTENT_REMOVAL',
      'USER_SUSPENSION',
      'USER_BAN',
      'CONTENT_QUARANTINE',
    ]),
    body('notes').optional().isString(),
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

      // Get moderator ID from request (would come from auth middleware)
      const moderatorId = req.user?.id || 'system'

      const item = await moderationQueueService.processQueueItem(
        req.params.id,
        req.body.action,
        moderatorId,
        req.body.notes,
      )

      res.json({
        message: 'Queue item processed successfully',
        item,
      })
    } catch (error: any) {
      logger.error('Process queue item error:', error)
      res.status(500).json({
        error: 'Failed to process queue item',
        message: error.message,
      })
    }
  },
)

/**
 * @swagger
 * /api/moderation-queue/{id}:
 *   delete:
 *     summary: Delete queue item
 *     description: Delete a moderation queue item (admin only)
 *     tags: [Moderation Queue]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Queue item ID
 *     responses:
 *       200:
 *         description: Queue item deleted successfully
 *       404:
 *         description: Queue item not found
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

    await moderationQueueService.deleteQueueItem(req.params.id)

    res.json({
      message: 'Queue item deleted successfully',
    })
  } catch (error: any) {
    logger.error('Delete queue item error:', error)
    res.status(500).json({
      error: 'Failed to delete queue item',
      message: error.message,
    })
  }
})

/**
 * @swagger
 * /api/moderation-queue/unassigned:
 *   get:
 *     summary: Get unassigned queue items
 *     description: Retrieve moderation queue items that haven't been assigned to moderators
 *     tags: [Moderation Queue]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Maximum number of items to return
 *     responses:
 *       200:
 *         description: Unassigned queue items retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ModerationQueueItem'
 *       500:
 *         description: Internal server error
 */
router.get(
  '/unassigned/all',
  [query('limit').optional().isInt({ min: 1, max: 50 })],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        })
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10
      const items = await moderationQueueService.getUnassignedItems(limit)

      res.json(items)
    } catch (error: any) {
      logger.error('Get unassigned items error:', error)
      res.status(500).json({
        error: 'Failed to get unassigned items',
        message: error.message,
      })
    }
  },
)

/**
 * @swagger
 * /api/moderation-queue/assigned/{moderatorId}:
 *   get:
 *     summary: Get assigned queue items for moderator
 *     description: Retrieve moderation queue items assigned to a specific moderator
 *     tags: [Moderation Queue]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: moderatorId
 *         required: true
 *         schema:
 *           type: string
 *         description: Moderator ID
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
 *         description: Assigned queue items retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ModerationQueueItem'
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
  '/assigned/:moderatorId',
  [
    param('moderatorId').isString().notEmpty(),
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

      const result = await moderationQueueService.getAssignedItems(
        req.params.moderatorId,
        pagination,
      )

      res.json(result)
    } catch (error: any) {
      logger.error('Get assigned items error:', error)
      res.status(500).json({
        error: 'Failed to get assigned items',
        message: error.message,
      })
    }
  },
)

/**
 * @swagger
 * /api/moderation-queue/bulk-assign:
 *   post:
 *     summary: Bulk assign queue items
 *     description: Assign multiple moderation queue items to a moderator
 *     tags: [Moderation Queue]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [itemIds, moderatorId]
 *             properties:
 *               itemIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of queue item IDs to assign
 *               moderatorId:
 *                 type: string
 *                 description: ID of the moderator to assign items to
 *             example:
 *               itemIds: ["item1", "item2", "item3"]
 *               moderatorId: "mod123"
 *     responses:
 *       200:
 *         description: Queue items assigned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                   description: Number of items assigned
 *               required: [count]
 *       400:
 *         description: Validation error
 *       500:
 *         description: Internal server error
 */
router.post(
  '/bulk-assign',
  [
    body('itemIds').isArray({ min: 1 }),
    body('itemIds.*').isString().notEmpty(),
    body('moderatorId').isString().notEmpty(),
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

      const result = await moderationQueueService.bulkAssignItems(
        req.body.itemIds,
        req.body.moderatorId,
      )

      res.json({
        message: `${result.count} queue items assigned successfully`,
        count: result.count,
      })
    } catch (error: any) {
      logger.error('Bulk assign items error:', error)
      res.status(500).json({
        error: 'Failed to bulk assign items',
        message: error.message,
      })
    }
  },
)

/**
 * @swagger
 * /api/moderation-queue/stats:
 *   get:
 *     summary: Get moderation queue statistics
 *     description: Get comprehensive statistics about the moderation queue
 *     tags: [Moderation Queue]
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
 *                 processed:
 *                   type: integer
 *                 unprocessed:
 *                   type: integer
 *                 assigned:
 *                   type: integer
 *                 unassigned:
 *                   type: integer
 *                 byType:
 *                   type: object
 *                   additionalProperties:
 *                     type: integer
 *                 byPriority:
 *                   type: object
 *                   additionalProperties:
 *                     type: integer
 *               required: [total, processed, unprocessed, assigned, unassigned, byType, byPriority]
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

      const stats = await moderationQueueService.getQueueStats(dateFrom, dateTo)

      res.json(stats)
    } catch (error: any) {
      logger.error('Get queue stats error:', error)
      res.status(500).json({
        error: 'Failed to get queue statistics',
        message: error.message,
      })
    }
  },
)

export { router as moderationQueueRouter }
