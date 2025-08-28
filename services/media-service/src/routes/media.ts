import express from 'express'
import multer from 'multer'
import { body, param, query, validationResult } from 'express-validator'
import { mediaService } from '../services/mediaService.js'
import { processingService } from '../services/processingService.js'
import logger from '../config/logger.js'
import { AccessLevel, MediaType } from '@prisma/client'

const router = express.Router()

// Configure multer for file uploads
const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images, videos, audio, documents
    const allowedTypes = [
      'image/',
      'video/',
      'audio/',
      'application/pdf',
      'text/',
      'application/msword',
      'application/vnd.openxmlformats-officedocument',
    ]

    const isAllowed = allowedTypes.some(type => file.mimetype.startsWith(type))
    if (isAllowed) {
      cb(null, true)
    } else {
      cb(new Error('File type not allowed'))
    }
  },
})

/**
 * @swagger
 * /api/media/upload:
 *   post:
 *     summary: Upload media file
 *     description: Upload a media file (image, video, audio, document)
 *     tags: [Media]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Media file to upload
 *               accessLevel:
 *                 type: string
 *                 enum: [PUBLIC, PRIVATE, RESTRICTED]
 *                 description: Access level for the uploaded file
 *               metadata:
 *                 type: string
 *                 description: JSON metadata for the file
 *             required: [file]
 *     responses:
 *       201:
 *         description: Media uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Media'
 *       400:
 *         description: Validation error or file type not allowed
 *       500:
 *         description: Internal server error
 */
router.post(
  '/upload',
  upload.single('file'),
  [body('accessLevel').optional().isIn(['PUBLIC', 'PRIVATE', 'RESTRICTED'])],
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'No file uploaded',
        })
      }

      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        })
      }

      const accessLevel = (req.body.accessLevel as AccessLevel) || AccessLevel.PUBLIC
      const metadata = req.body.metadata ? JSON.parse(req.body.metadata) : undefined

      const media = await mediaService.uploadMedia({
        filename: req.file.originalname,
        buffer: req.file.buffer,
        mimeType: req.file.mimetype,
        uploadedBy: req.user?.id,
        accessLevel,
        metadata,
      })

      res.status(201).json({
        message: 'Media uploaded successfully',
        media,
      })
    } catch (error: any) {
      logger.error('Upload media error:', error)

      if (error.message === 'File type not allowed') {
        return res.status(400).json({
          error: 'File type not allowed',
        })
      }

      res.status(500).json({
        error: 'Failed to upload media',
        message: error.message,
      })
    }
  },
)

/**
 * @swagger
 * /api/media/{id}:
 *   get:
 *     summary: Get media by ID
 *     description: Retrieve media information by its ID
 *     tags: [Media]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Media ID
 *     responses:
 *       200:
 *         description: Media retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Media'
 *       404:
 *         description: Media not found
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

    const media = await mediaService.getMediaById(req.params.id)

    // Log access for analytics
    await mediaService.logMediaAccess(
      req.params.id,
      req.user?.id,
      req.ip,
      req.get('User-Agent'),
      req.get('Referer'),
    )

    res.json({
      media,
    })
  } catch (error: any) {
    logger.error('Get media error:', error)

    if (error.message === 'Media not found') {
      return res.status(404).json({
        error: 'Media not found',
      })
    }

    res.status(500).json({
      error: 'Failed to get media',
      message: error.message,
    })
  }
})

/**
 * @swagger
 * /api/media:
 *   get:
 *     summary: Get media with filtering
 *     description: Retrieve media files with optional filtering and pagination
 *     tags: [Media]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [IMAGE, VIDEO, AUDIO, DOCUMENT, ARCHIVE, OTHER]
 *       - in: query
 *         name: uploadedBy
 *         schema:
 *           type: string
 *         description: Filter by uploader ID
 *       - in: query
 *         name: accessLevel
 *         schema:
 *           type: string
 *           enum: [PUBLIC, PRIVATE, RESTRICTED]
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
 *         description: Media retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Media'
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
    query('type').optional().isIn(['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'ARCHIVE', 'OTHER']),
    query('uploadedBy').optional().isString(),
    query('accessLevel').optional().isIn(['PUBLIC', 'PRIVATE', 'RESTRICTED']),
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
        type: req.query.type as MediaType,
        uploadedBy: req.query.uploadedBy as string,
        accessLevel: req.query.accessLevel as AccessLevel,
      }

      const pagination = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      }

      const result = await mediaService.getMedia(filters, pagination)

      res.json(result)
    } catch (error: any) {
      logger.error('Get media error:', error)
      res.status(500).json({
        error: 'Failed to get media',
        message: error.message,
      })
    }
  },
)

/**
 * @swagger
 * /api/media/{id}:
 *   put:
 *     summary: Update media
 *     description: Update media metadata and settings
 *     tags: [Media]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Media ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               accessLevel:
 *                 type: string
 *                 enum: [PUBLIC, PRIVATE, RESTRICTED]
 *               metadata:
 *                 type: object
 *                 description: Updated metadata
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *                 description: Expiration date
 *             example:
 *               accessLevel: "PRIVATE"
 *               metadata: { "tags": ["vacation", "beach"] }
 *     responses:
 *       200:
 *         description: Media updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Media'
 *       404:
 *         description: Media not found
 *       500:
 *         description: Internal server error
 */
router.put(
  '/:id',
  [
    param('id').isString().notEmpty(),
    body('accessLevel').optional().isIn(['PUBLIC', 'PRIVATE', 'RESTRICTED']),
    body('metadata').optional().isObject(),
    body('expiresAt').optional().isISO8601(),
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

      const updateData = {
        accessLevel: req.body.accessLevel,
        metadata: req.body.metadata,
        expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : undefined,
      }

      const media = await mediaService.updateMedia(req.params.id, updateData)

      res.json({
        message: 'Media updated successfully',
        media,
      })
    } catch (error: any) {
      logger.error('Update media error:', error)
      res.status(500).json({
        error: 'Failed to update media',
        message: error.message,
      })
    }
  },
)

/**
 * @swagger
 * /api/media/{id}:
 *   delete:
 *     summary: Delete media
 *     description: Delete a media file and all its variants
 *     tags: [Media]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Media ID
 *     responses:
 *       200:
 *         description: Media deleted successfully
 *       404:
 *         description: Media not found
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

    await mediaService.deleteMedia(req.params.id)

    res.json({
      message: 'Media deleted successfully',
    })
  } catch (error: any) {
    logger.error('Delete media error:', error)
    res.status(500).json({
      error: 'Failed to delete media',
      message: error.message,
    })
  }
})

/**
 * @swagger
 * /api/media/{id}/process:
 *   post:
 *     summary: Process media
 *     description: Create a processing job for the media file
 *     tags: [Media]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Media ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type]
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [THUMBNAIL, RESIZE, COMPRESS, CONVERT, WATERMARK, CROP, OPTIMIZE]
 *                 description: Processing type
 *               config:
 *                 type: object
 *                 description: Processing configuration
 *               priority:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 4
 *                 description: Processing priority
 *             example:
 *               type: "THUMBNAIL"
 *               config: { "sizes": [150, 300, 600] }
 *               priority: 2
 *     responses:
 *       201:
 *         description: Processing job created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProcessingJob'
 *       400:
 *         description: Validation error
 *       500:
 *         description: Internal server error
 */
router.post(
  '/:id/process',
  [
    param('id').isString().notEmpty(),
    body('type').isIn([
      'THUMBNAIL',
      'RESIZE',
      'COMPRESS',
      'CONVERT',
      'WATERMARK',
      'CROP',
      'OPTIMIZE',
    ]),
    body('config').optional().isObject(),
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

      const job = await mediaService.createProcessingJob({
        mediaId: req.params.id,
        type: req.body.type,
        config: req.body.config || {},
        priority: req.body.priority,
      })

      res.status(201).json({
        message: 'Processing job created successfully',
        job,
      })
    } catch (error: any) {
      logger.error('Create processing job error:', error)
      res.status(500).json({
        error: 'Failed to create processing job',
        message: error.message,
      })
    }
  },
)

/**
 * @swagger
 * /api/media/{id}/variants:
 *   get:
 *     summary: Get media variants
 *     description: Retrieve all variants of a media file
 *     tags: [Media]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Media ID
 *     responses:
 *       200:
 *         description: Media variants retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/MediaVariant'
 *       500:
 *         description: Internal server error
 */
router.get('/:id/variants', [param('id').isString().notEmpty()], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      })
    }

    const variants = await mediaService.getMediaVariants(req.params.id)

    res.json(variants)
  } catch (error: any) {
    logger.error('Get media variants error:', error)
    res.status(500).json({
      error: 'Failed to get media variants',
      message: error.message,
    })
  }
})

/**
 * @swagger
 * /api/media/user/{userId}:
 *   get:
 *     summary: Get user's media
 *     description: Retrieve all media uploaded by a specific user
 *     tags: [Media]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
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
 *         description: User media retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Media'
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
  '/user/:userId',
  [
    param('userId').isString().notEmpty(),
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

      const result = await mediaService.getUserMedia(req.params.userId, pagination)

      res.json(result)
    } catch (error: any) {
      logger.error('Get user media error:', error)
      res.status(500).json({
        error: 'Failed to get user media',
        message: error.message,
      })
    }
  },
)

/**
 * @swagger
 * /api/media/stats/summary:
 *   get:
 *     summary: Get media statistics
 *     description: Get comprehensive statistics about media files
 *     tags: [Media]
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
 *                 totalSize:
 *                   type: integer
 *                 byType:
 *                   type: object
 *                   additionalProperties:
 *                     type: integer
 *                 byStatus:
 *                   type: object
 *                   additionalProperties:
 *                     type: integer
 *               required: [total, totalSize, byType, byStatus]
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

      const stats = await mediaService.getMediaStats(dateFrom, dateTo)

      res.json(stats)
    } catch (error: any) {
      logger.error('Get media stats error:', error)
      res.status(500).json({
        error: 'Failed to get media statistics',
        message: error.message,
      })
    }
  },
)

export { router as mediaRouter }
