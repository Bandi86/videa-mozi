import express from 'express'
import { body, param, query, validationResult } from 'express-validator'
import { contentFlagsService } from '../services/contentFlagsService.js'
import logger from '../config/logger.js'

const router = express.Router()

/**
 * @swagger
 * /api/content-flags:
 *   post:
 *     summary: Create a content flag
 *     description: Flag content for moderation review
 *     tags: [Content Flags]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [contentId, contentType, flagType, confidence]
 *             properties:
 *               contentId:
 *                 type: string
 *                 description: ID of the content to flag
 *               contentType:
 *                 type: string
 *                 enum: [POST, COMMENT, USER_PROFILE, MEDIA, MESSAGE]
 *                 description: Type of content being flagged
 *               flagType:
 *                 type: string
 *                 enum: [EXPLICIT_CONTENT, VIOLENCE, HATE_SPEECH, SPAM, MISINFORMATION, COPYRIGHT, OTHER]
 *                 description: Type of flag
 *               confidence:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 1
 *                 description: AI confidence score (0.0 to 1.0)
 *               flaggedBy:
 *                 type: string
 *                 description: ID of the system/user that flagged the content (optional)
 *               reason:
 *                 type: string
 *                 description: Reason for flagging (optional)
 *               metadata:
 *                 type: object
 *                 description: Additional metadata from the flagging system (optional)
 *             example:
 *               contentId: "post123"
 *               contentType: "POST"
 *               flagType: "HATE_SPEECH"
 *               confidence: 0.85
 *               flaggedBy: "ai-system-1"
 *               reason: "Detected hate speech with high confidence"
 *     responses:
 *       201:
 *         description: Content flag created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ContentFlag'
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
    body('flagType').isIn([
      'EXPLICIT_CONTENT',
      'VIOLENCE',
      'HATE_SPEECH',
      'SPAM',
      'MISINFORMATION',
      'COPYRIGHT',
      'OTHER',
    ]),
    body('confidence').isFloat({ min: 0, max: 1 }),
    body('flaggedBy').optional().isString(),
    body('reason').optional().isString(),
    body('metadata').optional().isObject(),
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

      const flag = await contentFlagsService.createContentFlag(req.body)

      res.status(201).json({
        message: 'Content flag created successfully',
        flag,
      })
    } catch (error: any) {
      logger.error('Create content flag error:', error)
      res.status(500).json({
        error: 'Failed to create content flag',
        message: error.message,
      })
    }
  },
)

/**
 * @swagger
 * /api/content-flags/{id}:
 *   get:
 *     summary: Get content flag by ID
 *     description: Retrieve a specific content flag by its ID
 *     tags: [Content Flags]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Content flag ID
 *     responses:
 *       200:
 *         description: Content flag retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ContentFlag'
 *       404:
 *         description: Content flag not found
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

    const flag = await contentFlagsService.getContentFlagById(req.params.id)

    res.json({
      flag,
    })
  } catch (error: any) {
    logger.error('Get content flag error:', error)

    if (error.message === 'Content flag not found') {
      return res.status(404).json({
        error: 'Content flag not found',
      })
    }

    res.status(500).json({
      error: 'Failed to get content flag',
      message: error.message,
    })
  }
})

/**
 * @swagger
 * /api/content-flags:
 *   get:
 *     summary: Get content flags with filtering
 *     description: Retrieve content flags with optional filtering and pagination
 *     tags: [Content Flags]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: contentId
 *         schema:
 *           type: string
 *         description: Filter by content ID
 *       - in: query
 *         name: contentType
 *         schema:
 *           type: string
 *           enum: [POST, COMMENT, USER_PROFILE, MEDIA, MESSAGE]
 *         description: Filter by content type
 *       - in: query
 *         name: flagType
 *         schema:
 *           type: string
 *           enum: [EXPLICIT_CONTENT, VIOLENCE, HATE_SPEECH, SPAM, MISINFORMATION, COPYRIGHT, OTHER]
 *         description: Filter by flag type
 *       - in: query
 *         name: isResolved
 *         schema:
 *           type: boolean
 *         description: Filter by resolution status
 *       - in: query
 *         name: confidenceMin
 *         schema:
 *           type: number
 *           minimum: 0
 *           maximum: 1
 *         description: Minimum confidence score
 *       - in: query
 *         name: confidenceMax
 *         schema:
 *           type: number
 *           minimum: 0
 *           maximum: 1
 *         description: Maximum confidence score
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
 *         description: Content flags retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ContentFlag'
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
    query('contentId').optional().isString(),
    query('contentType').optional().isIn(['POST', 'COMMENT', 'USER_PROFILE', 'MEDIA', 'MESSAGE']),
    query('flagType')
      .optional()
      .isIn([
        'EXPLICIT_CONTENT',
        'VIOLENCE',
        'HATE_SPEECH',
        'SPAM',
        'MISINFORMATION',
        'COPYRIGHT',
        'OTHER',
      ]),
    query('isResolved').optional().isBoolean(),
    query('confidenceMin').optional().isFloat({ min: 0, max: 1 }),
    query('confidenceMax').optional().isFloat({ min: 0, max: 1 }),
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
        contentId: req.query.contentId as string,
        contentType: req.query.contentType as any,
        flagType: req.query.flagType as any,
        isResolved: req.query.isResolved ? req.query.isResolved === 'true' : undefined,
        confidence: {
          min: req.query.confidenceMin ? parseFloat(req.query.confidenceMin as string) : undefined,
          max: req.query.confidenceMax ? parseFloat(req.query.confidenceMax as string) : undefined,
        },
      }

      const pagination = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      }

      const result = await contentFlagsService.getContentFlags(filters, pagination)

      res.json(result)
    } catch (error: any) {
      logger.error('Get content flags error:', error)
      res.status(500).json({
        error: 'Failed to get content flags',
        message: error.message,
      })
    }
  },
)

/**
 * @swagger
 * /api/content-flags/{id}:
 *   put:
 *     summary: Update content flag
 *     description: Update content flag details or mark as resolved
 *     tags: [Content Flags]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Content flag ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isResolved:
 *                 type: boolean
 *                 description: Whether the flag has been resolved
 *               resolvedAt:
 *                 type: string
 *                 format: date-time
 *                 description: When the flag was resolved (optional, defaults to now)
 *               resolvedBy:
 *                 type: string
 *                 description: ID of the user who resolved the flag
 *               confidence:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 1
 *                 description: Updated confidence score
 *               reason:
 *                 type: string
 *                 description: Updated reason for flagging
 *               metadata:
 *                 type: object
 *                 description: Updated metadata
 *             example:
 *               isResolved: true
 *               resolvedBy: "mod123"
 *     responses:
 *       200:
 *         description: Content flag updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ContentFlag'
 *       404:
 *         description: Content flag not found
 *       500:
 *         description: Internal server error
 */
router.put(
  '/:id',
  [
    param('id').isString().notEmpty(),
    body('isResolved').optional().isBoolean(),
    body('resolvedAt').optional().isISO8601(),
    body('resolvedBy').optional().isString(),
    body('confidence').optional().isFloat({ min: 0, max: 1 }),
    body('reason').optional().isString(),
    body('metadata').optional().isObject(),
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

      const flag = await contentFlagsService.updateContentFlag(req.params.id, req.body)

      res.json({
        message: 'Content flag updated successfully',
        flag,
      })
    } catch (error: any) {
      logger.error('Update content flag error:', error)
      res.status(500).json({
        error: 'Failed to update content flag',
        message: error.message,
      })
    }
  },
)

/**
 * @swagger
 * /api/content-flags/{id}/resolve:
 *   post:
 *     summary: Resolve content flag
 *     description: Mark a content flag as resolved
 *     tags: [Content Flags]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Content flag ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [resolvedBy]
 *             properties:
 *               resolvedBy:
 *                 type: string
 *                 description: ID of the user who resolved the flag
 *             example:
 *               resolvedBy: "mod123"
 *     responses:
 *       200:
 *         description: Content flag resolved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ContentFlag'
 *       404:
 *         description: Content flag not found
 *       500:
 *         description: Internal server error
 */
router.post(
  '/:id/resolve',
  [param('id').isString().notEmpty(), body('resolvedBy').isString().notEmpty()],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        })
      }

      const flag = await contentFlagsService.resolveContentFlag(req.params.id, req.body.resolvedBy)

      res.json({
        message: 'Content flag resolved successfully',
        flag,
      })
    } catch (error: any) {
      logger.error('Resolve content flag error:', error)
      res.status(500).json({
        error: 'Failed to resolve content flag',
        message: error.message,
      })
    }
  },
)

/**
 * @swagger
 * /api/content-flags/{id}:
 *   delete:
 *     summary: Delete content flag
 *     description: Delete a content flag (admin only)
 *     tags: [Content Flags]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Content flag ID
 *     responses:
 *       200:
 *         description: Content flag deleted successfully
 *       404:
 *         description: Content flag not found
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

    await contentFlagsService.deleteContentFlag(req.params.id)

    res.json({
      message: 'Content flag deleted successfully',
    })
  } catch (error: any) {
    logger.error('Delete content flag error:', error)
    res.status(500).json({
      error: 'Failed to delete content flag',
      message: error.message,
    })
  }
})

/**
 * @swagger
 * /api/content-flags/content/{contentId}:
 *   get:
 *     summary: Get flags for specific content
 *     description: Retrieve all flags for a specific piece of content
 *     tags: [Content Flags]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Content ID
 *     responses:
 *       200:
 *         description: Content flags retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ContentFlag'
 *       500:
 *         description: Internal server error
 */
router.get('/content/:contentId', [param('contentId').isString().notEmpty()], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      })
    }

    const flags = await contentFlagsService.getContentFlagsByContentId(req.params.contentId)

    res.json(flags)
  } catch (error: any) {
    logger.error('Get content flags by content ID error:', error)
    res.status(500).json({
      error: 'Failed to get content flags',
      message: error.message,
    })
  }
})

/**
 * @swagger
 * /api/content-flags/high-confidence:
 *   get:
 *     summary: Get high-confidence unresolved flags
 *     description: Retrieve high-confidence flags that need immediate attention
 *     tags: [Content Flags]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: threshold
 *         schema:
 *           type: number
 *           minimum: 0
 *           maximum: 1
 *           default: 0.8
 *         description: Confidence threshold
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Maximum number of flags to return
 *     responses:
 *       200:
 *         description: High-confidence flags retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ContentFlag'
 *       500:
 *         description: Internal server error
 */
router.get(
  '/high-confidence/all',
  [
    query('threshold').optional().isFloat({ min: 0, max: 1 }),
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

      const threshold = req.query.threshold ? parseFloat(req.query.threshold as string) : 0.8
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50

      const flags = await contentFlagsService.getHighConfidenceFlags(threshold, limit)

      res.json(flags)
    } catch (error: any) {
      logger.error('Get high confidence flags error:', error)
      res.status(500).json({
        error: 'Failed to get high confidence flags',
        message: error.message,
      })
    }
  },
)

/**
 * @swagger
 * /api/content-flags/stats:
 *   get:
 *     summary: Get content flag statistics
 *     description: Get comprehensive statistics about content flags
 *     tags: [Content Flags]
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
 *                 resolved:
 *                   type: integer
 *                 unresolved:
 *                   type: integer
 *                 byType:
 *                   type: object
 *                   additionalProperties:
 *                     type: integer
 *                 byContentType:
 *                   type: object
 *                   additionalProperties:
 *                     type: integer
 *                 averageConfidence:
 *                   type: number
 *               required: [total, resolved, unresolved, byType, byContentType, averageConfidence]
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

      const stats = await contentFlagsService.getContentFlagStats(dateFrom, dateTo)

      res.json(stats)
    } catch (error: any) {
      logger.error('Get content flag stats error:', error)
      res.status(500).json({
        error: 'Failed to get content flag statistics',
        message: error.message,
      })
    }
  },
)

export { router as contentFlagsRouter }
