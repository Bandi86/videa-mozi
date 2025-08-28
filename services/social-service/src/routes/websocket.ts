import express, { Request, Response } from 'express'
import { param, query, validationResult } from 'express-validator'
import logger from '../config/logger.js'

const router = express.Router()

/**
 * @swagger
 * /websocket:
 *   get:
 *     summary: Get WebSocket connection information for Social Service
 *     description: Returns WebSocket connection details and available events for social interactions
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
 *                         social:
 *                           type: array
 *                           items:
 *                             type: string
 *                           description: Social interaction events
 *                         notifications:
 *                           type: array
 *                           items:
 *                             type: string
 *                           description: Notification events
 *                         userActivity:
 *                           type: array
 *                           items:
 *                             type: string
 *                           description: User activity events
 *                     rooms:
 *                       type: object
 *                       properties:
 *                         post:
 *                           type: string
 *                           description: Post-specific rooms pattern
 *                         user:
 *                           type: string
 *                           description: User-specific rooms pattern
 *                         notification:
 *                           type: string
 *                           description: Notification-specific rooms pattern
 *                     authentication:
 *                       type: object
 *                       properties:
 *                         required:
 *                           type: boolean
 *                           description: Whether authentication is required
 *                         token:
 *                           type: string
 *                           description: How to send authentication token
 *                   required: [url, events]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *               required: [websocket, timestamp]
 */
router.get('/', (req: Request, res: Response) => {
  const protocol = req.protocol === 'https' ? 'wss' : 'ws'
  const host = req.get('host')
  const websocketUrl = `${protocol}://${host}`

  const websocketInfo = {
    websocket: {
      url: websocketUrl,
      events: {
        social: [
          'post:create - New post created',
          'post:update - Post updated',
          'post:delete - Post deleted',
          'comment:create - New comment created',
          'comment:update - Comment updated',
          'comment:delete - Comment deleted',
          'like:post - Post liked/unliked',
          'like:comment - Comment liked/unliked',
          'share:create - New share created',
          'follow:create - New follow created',
          'follow:accept - Follow request accepted',
          'follow:reject - Follow request rejected',
          'user:online - User came online',
          'user:offline - User went offline',
        ],
        notifications: [
          'notification:new - New notification received',
          'notification:read - Notification marked as read',
          'notification:delete - Notification deleted',
        ],
        userActivity: [
          'user:activity - User activity update',
          'user:typing:start - User started typing',
          'user:typing:stop - User stopped typing',
          'presence:join - User joined room',
          'presence:leave - User left room',
        ],
      },
      rooms: {
        post: 'post:{postId}',
        user: 'user:{userId}',
        notification: 'notification:{userId}',
        social: 'social:{type}',
      },
      authentication: {
        required: true,
        token: 'Send JWT token in auth object: { token: "jwt-token" }',
        anonymous: 'Limited access for anonymous users',
      },
      broadcasting: {
        'post:created': 'New post broadcast to followers',
        'comment:created': 'New comment broadcast to post viewers',
        'like:updated': 'Like count updated',
        'notification:new': 'New notification sent',
        'user:status:changed': 'User online/offline status changed',
        'social:activity': 'Social activity broadcast',
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
 *     summary: Get WebSocket server statistics for Social Service
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
router.get('/stats', (req: Request, res: Response) => {
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
    const rooms = Object.keys(io.sockets.adapter.rooms).length

    res.json({
      connectedSockets,
      rooms,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
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
 *     summary: Test WebSocket broadcasting for Social Service
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
 *                 default: social:test
 *             required: [message]
 *     responses:
 *       200:
 *         description: Test message broadcast successfully
 *       503:
 *         description: WebSocket server not available
 */
router.post('/test', (req: Request, res: Response) => {
  try {
    const { message, event = 'social:test' } = req.body

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
      source: 'social-service-test-endpoint',
    })

    logger.info(`🧪 Social WebSocket test broadcast: ${message}`)

    res.json({
      success: true,
      message: 'Test message broadcast successfully',
      event,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    logger.error('WebSocket test error:', error)
    res.status(500).json({
      error: 'Failed to send test message',
      timestamp: new Date().toISOString(),
    })
  }
})

export { router as websocketRouter }
