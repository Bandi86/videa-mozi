import express from 'express'
import { param, query, validationResult } from 'express-validator'
import { prisma } from '../index.js'
import { redis } from '../index.js'
import logger from '../config/logger.js'
import { NotificationsService } from '../services/notificationsService.js'

const router = express.Router()

/**
 * @swagger
 * /api/v1/notifications:
 *   get:
 *     summary: Get user notifications
 *     tags: [Notifications]
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
 *           maximum: 50
 *           default: 20
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [LIKE, COMMENT, FOLLOW, SHARE, MENTION, REPLY, QUOTE]
 *       - in: query
 *         name: isRead
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Notifications retrieved successfully
 */
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50'),
    query('type')
      .optional()
      .isIn(['LIKE', 'COMMENT', 'FOLLOW', 'SHARE', 'MENTION', 'REPLY', 'QUOTE'])
      .withMessage('Invalid notification type'),
    query('isRead').optional().isBoolean().withMessage('Is read must be a boolean'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation error',
          details: errors.array(),
        })
      }

      const filters = {
        userId: req.user!.id,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        type: req.query.type as any,
        isRead:
          req.query.isRead === 'true' ? true : req.query.isRead === 'false' ? false : undefined,
      }

      const result = await NotificationsService.getUserNotifications(filters)

      res.json(result)
    } catch (error) {
      logger.error('Get notifications error:', error)
      res.status(500).json({
        error: 'Notifications retrieval failed',
        message: 'An error occurred while retrieving notifications.',
      })
    }
  },
)

/**
 * @swagger
 * /api/v1/notifications/{id}/read:
 *   post:
 *     summary: Mark notification as read
 *     tags: [Notifications]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification marked as read successfully
 */
router.post(
  '/:id/read',
  [param('id').isString().notEmpty().withMessage('Notification ID is required')],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation error',
          details: errors.array(),
        })
      }

      const notificationId = req.params.id

      const success = await NotificationsService.markAsRead(req.user!.id, notificationId)

      if (!success) {
        return res.status(404).json({
          error: 'Notification not found',
          message: 'The requested notification could not be found.',
        })
      }

      res.json({
        message: 'Notification marked as read successfully',
      })
    } catch (error) {
      logger.error('Mark notification as read error:', error)
      res.status(500).json({
        error: 'Mark as read failed',
        message: 'An error occurred while marking the notification as read.',
      })
    }
  },
)

/**
 * @swagger
 * /api/v1/notifications/read-all:
 *   post:
 *     summary: Mark all notifications as read
 *     tags: [Notifications]
 *     responses:
 *       200:
 *         description: All notifications marked as read successfully
 */
router.post('/read-all', async (req, res) => {
  try {
    const count = await NotificationsService.markAllAsRead(req.user!.id)

    res.json({
      message: 'All notifications marked as read successfully',
      count,
    })
  } catch (error) {
    logger.error('Mark all notifications as read error:', error)
    res.status(500).json({
      error: 'Mark all as read failed',
      message: 'An error occurred while marking all notifications as read.',
    })
  }
})

/**
 * @swagger
 * /api/v1/notifications/{id}:
 *   delete:
 *     summary: Delete notification
 *     tags: [Notifications]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification deleted successfully
 */
router.delete(
  '/:id',
  [param('id').isString().notEmpty().withMessage('Notification ID is required')],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation error',
          details: errors.array(),
        })
      }

      const notificationId = req.params.id

      const success = await NotificationsService.deleteNotification(req.user!.id, notificationId)

      if (!success) {
        return res.status(404).json({
          error: 'Notification not found',
          message: 'The requested notification could not be found.',
        })
      }

      res.json({
        message: 'Notification deleted successfully',
      })
    } catch (error) {
      logger.error('Delete notification error:', error)
      res.status(500).json({
        error: 'Notification deletion failed',
        message: 'An error occurred while deleting the notification.',
      })
    }
  },
)

/**
 * @swagger
 * /api/v1/notifications/stats:
 *   get:
 *     summary: Get notification statistics
 *     tags: [Notifications]
 *     responses:
 *       200:
 *         description: Notification statistics retrieved successfully
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await NotificationsService.getUserNotificationStats(req.user!.id)

    res.json(stats)
  } catch (error) {
    logger.error('Get notification stats error:', error)
    res.status(500).json({
      error: 'Notification stats retrieval failed',
      message: 'An error occurred while retrieving notification statistics.',
    })
  }
})

export { router as notificationsRouter }
