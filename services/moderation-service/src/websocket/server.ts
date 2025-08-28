import { Server as HttpServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import { RedisClientType, createClient } from 'redis'
import logger from '../config/logger.js'
import { authenticateSocket, requireRole } from './middleware/auth.js'
import { registerModerationHandlers } from './handlers/moderationHandlers.js'
import { registerReportHandlers } from './handlers/reportHandlers.js'
import { registerAppealHandlers } from './handlers/appealHandlers.js'
import { registerContentFlagHandlers } from './handlers/contentFlagHandlers.js'

interface WebSocketServer {
  getServer: () => SocketIOServer
  initialize: (server: HttpServer) => void
  close: () => void
}

class ModerationWebSocketServer implements WebSocketServer {
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

      logger.info('🚀 Moderation WebSocket Server initialized successfully')
    } catch (error) {
      logger.error('Failed to initialize Moderation WebSocket Server:', error)
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
    registerModerationHandlers(socket)
    registerReportHandlers(socket)
    registerAppealHandlers(socket)
    registerContentFlagHandlers(socket)

    // Send welcome message
    socket.emit('connected', {
      message: 'Connected to Moderation Service WebSocket',
      userId,
      userRole,
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

      // Leave all rooms
      socket.rooms.forEach((room: string) => {
        if (room !== socket.id) {
          socket.leave(room)
        }
      })
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

    logger.info('🔌 Moderation WebSocket Server closed')
  }
}

// Extend global type for TypeScript
declare global {
  var websocketServer: WebSocketServer
  var redisClient: RedisClientType
}

export { ModerationWebSocketServer }
export default ModerationWebSocketServer
