import express from 'express'
import { param, query, validationResult } from 'express-validator'
import logger from '../config/logger.js'

const router = express.Router()

/**
 * @swagger
 * /websocket:
 *   get:
 *     summary: Get WebSocket connection information for Moderation Service
 *     description: Returns WebSocket connection details and available events for moderation
 *     tags: [WebSocket]
 *     responses:
 *       200:
 *         description: WebSocket information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 websocket:
 *                   type: object
 *                   properties:
 *                     url:
 *                       type: string
 *                       description: WebSocket server URL
 *                     events:
 *                       type: object
 *                       properties:
 *                         moderation:
 *                           type: array
 *                           items:
 *                             type: string
 *                           description: Moderation-related events
 *                         reports:
 *                           type: array
 *                           items:
 *                             type: string
 *                           description: Report-related events
 *                         appeals:
 *                           type: array
 *                           items:
 *                             type: string
 *                           description: Appeal-related events
 *                     rooms:
 *                       type: object
 *                       properties:
 *                         moderator:
 *                           type: string
 *                           description: Moderator-specific rooms pattern
 *                         report:
 *                           type: string
 *                           description: Report-specific rooms pattern
 *                         appeal:
 *                           type: string
 *                           description: Appeal-specific rooms pattern
 *                     authentication:
 *                       type: object
 *                       properties:
 *                         required:
 *                           type: boolean
 *                           description: Whether authentication is required
 *                         token:
 *                           type: string
 *                           description: How to send authentication token
 *                     broadcasting:
 *                       type: object
 *                       properties:
 *                         'report:new':
 *                           type: string
 *                           description: New report broadcast
 *                         'content:flagged':
 *                           type: string
 *                           description: Content flagged broadcast
 *                         'appeal:new':
 *                           type: string
 *                           description: New appeal broadcast
 *                   required: [url, events]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *               required: [websocket, timestamp]
 */
router.get('/', (req, res) => {
  const protocol = req.protocol === 'https' ? 'wss' : 'ws'
  const host = req.get('host')
  const websocketUrl = `${protocol}://${host}`

  const websocketInfo = {
    websocket: {
      url: websocketUrl,
      events: {
        moderation: [
          'moderation:action - Moderation action taken',
          'moderation:queue:updated - Moderation queue updated',
          'moderation:stats:updated - Moderation statistics updated',
        ],
        reports: [
          'report:new - New report submitted',
          'report:updated - Report updated',
          'report:assigned - Report assigned to moderator',
          'report:resolved - Report resolved',
        ],
        appeals: [
          'appeal:new - New appeal submitted',
          'appeal:updated - Appeal updated',
          'appeal:approved - Appeal approved',
          'appeal:rejected - Appeal rejected',
        ],
        contentFlags: [
          'content:flagged - Content flagged for moderation',
          'content:flag:resolved - Content flag resolved',
        ],
      },
      rooms: {
        moderator: 'moderator:{moderatorId}',
        report: 'report:{reportId}',
        appeal: 'appeal:{appealId}',
        content: 'content:{contentId}',
      },
      authentication: {
        required: true,
        token: 'Send JWT token in auth object: { token: "jwt-token" }',
        moderator: 'Must have moderator or admin role',
      },
      broadcasting: {
        'report:new': 'New reports broadcast to moderators',
        'content:flagged': 'Flagged content broadcast to moderators',
        'appeal:new': 'New appeals broadcast to moderators',
        'moderation:queue:updated': 'Queue updates broadcast to assigned moderators',
      },
    },
    timestamp: new Date().toISOString(),
  }

  res.json(websocketInfo)
})

/**
 * @swagger
 * /websocket/stats:
 *   get:
 *     summary: Get WebSocket server statistics for Moderation Service
 *     description: Returns real-time WebSocket server statistics
 *     tags: [WebSocket]
 *     responses:
 *       200:
 *         description: WebSocket statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 connectedSockets:
 *                   type: integer
 *                   description: Number of connected sockets
 *                 rooms:
 *                   type: integer
 *                   description: Number of active rooms
 *                 uptime:
 *                   type: number
 *                   description: WebSocket server uptime in seconds
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *               required: [connectedSockets, rooms, uptime, timestamp]
 */
router.get('/stats', (req, res) => {
  try {
    const websocketServer = global.websocketServer

    if (!websocketServer) {
      return res.status(503).json({
        error: 'WebSocket server not available',
        timestamp: new Date().toISOString(),
      })
    }

    const io = websocketServer.getServer()
    if (!io) {
      return res.status(503).json({
        error: 'WebSocket server not initialized',
        timestamp: new Date().toISOString(),
      })
    }

    const connectedSockets = io.sockets.sockets.size
    const rooms = io.sockets.adapter.rooms.size

    res.json({
      connectedSockets,
      rooms,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    logger.error('WebSocket stats error:', error)
    res.status(500).json({
      error: 'Failed to get WebSocket statistics',
      timestamp: new Date().toISOString(),
    })
  }
})

/**
 * @swagger
 * /websocket/test:
 *   post:
 *     summary: Test WebSocket broadcasting for Moderation Service
 *     description: Send a test message to all connected WebSocket clients
 *     tags: [WebSocket]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 description: Test message to broadcast
 *               event:
 *                 type: string
 *                 description: Event name to emit
 *                 default: moderation:test
 *             required: [message]
 *     responses:
 *       200:
 *         description: Test message broadcast successfully
 *       503:
 *         description: WebSocket server not available
 */
router.post('/test', (req, res) => {
  try {
    const { message, event = 'moderation:test' } = req.body

    if (!message) {
      return res.status(400).json({
        error: 'Message is required',
        timestamp: new Date().toISOString(),
      })
    }

    const websocketServer = global.websocketServer
    if (!websocketServer) {
      return res.status(503).json({
        error: 'WebSocket server not available',
        timestamp: new Date().toISOString(),
      })
    }

    const io = websocketServer.getServer()
    if (!io) {
      return res.status(503).json({
        error: 'WebSocket server not initialized',
        timestamp: new Date().toISOString(),
      })
    }

    // Broadcast test message
    io.emit(event, {
      message,
      timestamp: new Date().toISOString(),
      source: 'moderation-service-test-endpoint',
    })

    logger.info(`🧪 Moderation WebSocket test broadcast: ${message}`)

    res.json({
      success: true,
      message: 'Test message broadcast successfully',
      event,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    logger.error('WebSocket test error:', error)
    res.status(500).json({
      error: 'Failed to send test message',
      timestamp: new Date().toISOString(),
    })
  }
})

/**
 * @swagger
 * /websocket/moderator/{moderatorId}/test:
 *   post:
 *     summary: Test WebSocket broadcasting to specific moderator
 *     description: Send a test message to a specific moderator's WebSocket room
 *     tags: [WebSocket]
 *     parameters:
 *       - in: path
 *         name: moderatorId
 *         required: true
 *         schema:
 *           type: string
 *         description: Moderator ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 description: Test message to broadcast
 *             required: [message]
 *     responses:
 *       200:
 *         description: Test message broadcast successfully
 *       503:
 *         description: WebSocket server not available
 */
router.post(
  '/moderator/:moderatorId/test',
  [param('moderatorId').isString().notEmpty()],
  (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        })
      }

      const { message } = req.body
      const moderatorId = req.params.moderatorId

      if (!message) {
        return res.status(400).json({
          error: 'Message is required',
          timestamp: new Date().toISOString(),
        })
      }

      const websocketServer = global.websocketServer
      if (!websocketServer) {
        return res.status(503).json({
          error: 'WebSocket server not available',
          timestamp: new Date().toISOString(),
        })
      }

      const io = websocketServer.getServer()
      if (!io) {
        return res.status(503).json({
          error: 'WebSocket server not initialized',
          timestamp: new Date().toISOString(),
        })
      }

      // Broadcast test message to specific moderator
      io.to(`moderator:${moderatorId}`).emit('moderation:test', {
        message,
        moderatorId,
        timestamp: new Date().toISOString(),
        source: 'moderation-service-test-endpoint',
      })

      logger.info(`🧪 Moderation WebSocket test broadcast to moderator ${moderatorId}: ${message}`)

      res.json({
        success: true,
        message: 'Test message broadcast successfully',
        moderatorId,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      logger.error('WebSocket moderator test error:', error)
      res.status(500).json({
        error: 'Failed to send test message',
        timestamp: new Date().toISOString(),
      })
    }
  },
)

export { router as websocketRouter }
