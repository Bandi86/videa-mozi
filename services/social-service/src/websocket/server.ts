import { Server as HttpServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import { RedisClientType, createClient } from 'redis'
import logger from '../config/logger.js'
import { authenticateSocket, requireRole } from './middleware/auth.js'
import { registerPostHandlers } from './handlers/postHandlers.js'
import { registerCommentHandlers } from './handlers/commentHandlers.js'
import { registerLikeHandlers } from './handlers/likeHandlers.js'
import { registerShareHandlers } from './handlers/shareHandlers.js'
import { registerFollowerHandlers } from './handlers/followerHandlers.js'
import { registerNotificationHandlers } from './handlers/notificationHandlers.js'
import { registerUserActivityHandlers } from './handlers/userActivityHandlers.js'

interface WebSocketServer {
  getServer: () => SocketIOServer
  initialize: (server: HttpServer) => void
  close: () => void
}

class SocialWebSocketServer implements WebSocketServer {
  private io: SocketIOServer | null = null
  private redisPubClient: RedisClientType | null = null
  private redisSubClient: RedisClientType | null = null

  async initialize(server: HttpServer): Promise<void> {
    try {
      // Create Socket.IO server
      this.io = new SocketIOServer(server, {
        cors: {
          origin: process.env.CORS_ORIGIN || '*',
          methods: ['GET', 'POST'],
          credentials: true,
        },
        transports: ['websocket', 'polling'],
        pingTimeout: 60000,
        pingInterval: 25000,
      })

      // Initialize Redis adapter if Redis URL is provided
      if (process.env.REDIS_URL) {
        await this.initializeRedisAdapter()
      }

      // Global middleware
      this.io.use(authenticateSocket)

      // Connection handler
      this.io.on('connection', socket => {
        this.handleConnection(socket)
      })

      // Store reference globally for access from routes
      global.websocketServer = this

      logger.info('🚀 Social WebSocket Server initialized successfully')
    } catch (error) {
      logger.error('Failed to initialize Social WebSocket Server:', error)
      throw error
    }
  }

  private async initializeRedisAdapter(): Promise<void> {
    try {
      this.redisPubClient = createClient({ url: process.env.REDIS_URL })
      this.redisSubClient = createClient({ url: process.env.REDIS_URL })

      await Promise.all([this.redisPubClient.connect(), this.redisSubClient.connect()])

      if (this.io) {
        this.io.adapter(createAdapter(this.redisPubClient, this.redisSubClient))
        logger.info('🔗 Redis adapter initialized for WebSocket scaling')
      }

      // Store Redis clients globally for handlers
      global.redisClient = this.redisPubClient
    } catch (error) {
      logger.error('Failed to initialize Redis adapter:', error)
      // Continue without Redis adapter
    }
  }

  private handleConnection(socket: any): void {
    const userId = socket.user?.id
    const userRole = socket.user?.role

    logger.info(`🔌 New WebSocket connection: ${socket.id} (User: ${userId || 'anonymous'})`)

    // Register all event handlers
    registerPostHandlers(socket)
    registerCommentHandlers(socket)
    registerLikeHandlers(socket)
    registerShareHandlers(socket)
    registerFollowerHandlers(socket)
    registerNotificationHandlers(socket)
    registerUserActivityHandlers(socket)

    // Send welcome message
    socket.emit('connected', {
      message: 'Connected to Social Service WebSocket',
      userId,
      timestamp: new Date().toISOString(),
    })

    // Handle disconnection
    socket.on('disconnect', (reason: string) => {
      logger.info(`🔌 WebSocket disconnected: ${socket.id} (Reason: ${reason})`)

      // Clean up presence
      if (userId && global.redisClient) {
        try {
          global.redisClient.del(`user:presence:${userId}`)
        } catch (redisError) {
          logger.error('Redis presence cleanup error:', redisError)
        }
      }

      // Broadcast offline status
      if (userId) {
        socket.to(`user:followers:${userId}`).emit('user:status:changed', {
          userId,
          status: 'offline',
          timestamp: new Date().toISOString(),
        })
      }
    })

    // Handle connection errors
    socket.on('error', (error: Error) => {
      logger.error(`WebSocket error for ${socket.id}:`, error)
    })

    // Handle ping/pong for connection health
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date().toISOString() })
    })
  }

  getServer(): SocketIOServer {
    if (!this.io) {
      throw new Error('WebSocket server not initialized')
    }
    return this.io
  }

  async close(): Promise<void> {
    if (this.io) {
      this.io.close()
      this.io = null
    }

    if (this.redisPubClient) {
      await this.redisPubClient.disconnect()
      this.redisPubClient = null
    }

    if (this.redisSubClient) {
      await this.redisSubClient.disconnect()
      this.redisSubClient = null
    }

    logger.info('🔌 Social WebSocket Server closed')
  }
}

// Extend global type for TypeScript
declare global {
  var websocketServer: WebSocketServer
  var redisClient: RedisClientType
}

export { SocialWebSocketServer }
export default SocialWebSocketServer
