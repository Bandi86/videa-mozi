import { Server as HttpServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { RedisAdapter } from '@socket.io/redis-adapter'
import { createClient } from 'redis'
import logger from '../config/logger.js'
import { authenticateSocket } from './middleware/auth.js'
import { setupUserActivityHandlers } from './handlers/userActivityHandlers.js'

export interface WebSocketServer extends SocketIOServer {
  port?: number
}

export const initializeWebSocket = (server: HttpServer): WebSocketServer => {
  const io = new SocketIOServer(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
    maxHttpBufferSize: 1e8, // 100MB for file uploads
  })

  // Redis adapter for scaling (if Redis is available)
  if (process.env.REDIS_URL) {
    const pubClient = createClient({ url: process.env.REDIS_URL })
    const subClient = pubClient.duplicate()

    Promise.all([pubClient.connect(), subClient.connect()])
      .then(() => {
        io.adapter(new RedisAdapter(pubClient, subClient))
        logger.info('✅ Redis adapter connected for WebSocket scaling')
      })
      .catch(error => {
        logger.error('❌ Failed to connect Redis adapter:', error)
      })
  }

  // Authentication middleware
  io.use(authenticateSocket)

  // Connection handler
  io.on('connection', socket => {
    const userId = socket.userId
    const username = socket.username

    logger.info(`🔗 User connected: ${username || 'Anonymous'} (${userId || 'No ID'})`)

    // Join user-specific room
    if (userId) {
      socket.join(`user:${userId}`)
    }

    // Handle disconnection
    socket.on('disconnect', reason => {
      logger.info(`🔌 User disconnected: ${username || 'Anonymous'} (${reason})`)

      // Update user last seen
      if (userId) {
        // This would typically update the database
        logger.debug(`User ${userId} went offline`)
      }
    })

    // Handle connection errors
    socket.on('error', error => {
      logger.error('Socket error:', error)
    })

    // Setup user activity handlers
    setupUserActivityHandlers(io, socket)
  })

  // Global error handler
  io.on('connection_error', error => {
    logger.error('Connection error:', error)
  })

  logger.info('🚀 WebSocket server initialized')

  return io as WebSocketServer
}

export default initializeWebSocket
