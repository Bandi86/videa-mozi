import express from 'express'
import logger from '../config/logger.js'

const router = express.Router()

/**
 * @swagger
 * /websocket:
 *   get:
 *     summary: Get WebSocket connection information
 *     description: Returns WebSocket connection details and available events
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
 *                         content:
 *                           type: array
 *                           items:
 *                             type: string
 *                           description: Content-related events
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
 *                         movie:
 *                           type: string
 *                           description: Movie-specific rooms pattern
 *                         series:
 *                           type: string
 *                           description: Series-specific rooms pattern
 *                         category:
 *                           type: string
 *                           description: Category-specific rooms pattern
 *                         user:
 *                           type: string
 *                           description: User-specific rooms pattern
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
router.get('/', (req, res) => {
  const protocol = req.protocol === 'https' ? 'wss' : 'ws'
  const host = req.get('host')
  const websocketUrl = `${protocol}://${host}`

  const websocketInfo = {
    websocket: {
      url: websocketUrl,
      events: {
        content: [
          'movie:rate - Rate a movie (authenticated)',
          'movie:join - Join movie room for updates',
          'movie:leave - Leave movie room',
          'series:rate - Rate a series (authenticated)',
          'series:join - Join series room for updates',
          'series:leave - Leave series room',
          'category:join - Join category room',
          'category:leave - Leave category room',
          'content:search - Search content in real-time',
          'content:view - Track content view',
          'content:subscribe - Subscribe to content updates (admin)',
          'content:watch:new - Watch for new content (admin)',
        ],
        notifications: [
          'notification:read - Mark notification as read',
          'notification:read:all - Mark all notifications as read',
          'notification:history - Get notification history',
          'notification:subscribe - Subscribe to notification types',
          'notification:unsubscribe - Unsubscribe from notification types',
          'notification:test - Send test notification (dev)',
        ],
        userActivity: [
          'user:online - Mark user as online',
          'user:activity - Track user activity',
          'content:engage - Track content engagement',
          'user:preference - Update user preferences',
          'search:query - Track search queries',
          'page:view - Track page views',
          'user:typing:start - Start typing indicator',
          'user:typing:stop - Stop typing indicator',
          'room:join - Join a room',
          'room:leave - Leave a room',
        ],
      },
      rooms: {
        movie: 'movie:{movieId}',
        series: 'series:{seriesId}',
        category: 'category:{categoryId}',
        user: 'user:{userId}',
        notifications: 'notifications:{type}',
        role: 'role:{role}',
      },
      authentication: {
        required: true,
        token: 'Send JWT token in auth object: { token: "jwt-token" }',
        anonymous: 'Anonymous connections allowed but with limited features',
      },
      broadcasting: {
        'movie:updated': 'Movie data updated',
        'series:updated': 'Series data updated',
        'category:updated': 'Category data updated',
        'movie:rating:updated': 'Movie rating changed',
        'series:rating:updated': 'Series rating changed',
        'content:views:updated': 'Content view count updated',
        'content:engagement:updated': 'Content engagement updated',
        'notification:new': 'New notification received',
        'notification:read': 'Notification marked as read',
        'user:status:changed': 'User online/offline status changed',
        'user:activity:new': 'New user activity',
        'user:joined': 'User joined room',
        'user:left': 'User left room',
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
 *     summary: Get WebSocket server statistics
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
 *     summary: Test WebSocket broadcasting
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
 *                 default: test:broadcast
 *             required: [message]
 *     responses:
 *       200:
 *         description: Test message broadcast successfully
 *       503:
 *         description: WebSocket server not available
 */
router.post('/test', (req, res) => {
  try {
    const { message, event = 'test:broadcast' } = req.body

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
      source: 'websocket-test-endpoint',
    })

    logger.info(`🧪 WebSocket test broadcast: ${message}`)

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

export { router as websocketRouter }
