import { Server as HTTPServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { RedisAdapter } from '@socket.io/redis-adapter'
import { redis } from '../index.js'
import logger from '../config/logger.js'
import { authenticateSocket } from './middleware/auth.js'
import { contentHandlers } from './handlers/contentHandlers.js'
import { notificationHandlers } from './handlers/notificationHandlers.js'
import { userActivityHandlers } from './handlers/userActivityHandlers.js'

export class WebSocketServer {
  private io: SocketIOServer | null = null
  private httpServer: HTTPServer | null = null

  constructor(httpServer: HTTPServer) {
    this.httpServer = httpServer
    this.initializeSocketServer()
  }

  private async initializeSocketServer() {
    if (!this.httpServer) {
      throw new Error('HTTP server not provided')
    }

    // Create Socket.IO server with CORS configuration
    this.io = new SocketIOServer(this.httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      // Connection settings
      pingTimeout: 60000,
      pingInterval: 25000,
      maxHttpBufferSize: 1e8, // 100MB for file uploads
      transports: ['websocket', 'polling'],
      allowEIO3: true,
    })

    // Use Redis adapter for scaling across multiple instances
    if (redis) {
      try {
        this.io.adapter(new RedisAdapter(redis, redis.duplicate()))
        logger.info('✅ WebSocket Redis adapter enabled for scaling')
      } catch (error) {
        logger.warn('⚠️  Redis adapter not available, running in single-instance mode')
      }
    }

    // Global middleware
    this.io.use(authenticateSocket)

    // Connection handling
    this.io.on('connection', socket => {
      logger.info(`🔌 User connected: ${socket.id}`, {
        userId: socket.data.user?.id || 'anonymous',
        ip: socket.handshake.address,
        userAgent: socket.handshake.headers['user-agent'],
      })

      // Join user-specific room for targeted notifications
      if (socket.data.user?.id) {
        socket.join(`user:${socket.data.user.id}`)
        logger.info(`👤 User ${socket.data.user.id} joined personal room`)
      }

      // Register event handlers
      this.registerEventHandlers(socket)

      // Handle disconnection
      socket.on('disconnect', reason => {
        logger.info(`🔌 User disconnected: ${socket.id}`, {
          reason,
          userId: socket.data.user?.id || 'anonymous',
        })
      })

      // Handle connection errors
      socket.on('error', error => {
        logger.error(`🔌 Socket error for ${socket.id}:`, error)
      })
    })

    logger.info('🚀 WebSocket server initialized')
  }

  private registerEventHandlers(socket: any) {
    // Content-related events
    contentHandlers(socket, this.io!)

    // Notification events
    notificationHandlers(socket, this.io!)

    // User activity events
    userActivityHandlers(socket, this.io!)
  }

  // Broadcast methods for real-time updates
  public broadcastMovieUpdate(movieId: string, data: any) {
    if (this.io) {
      this.io.to(`movie:${movieId}`).emit('movie:updated', {
        movieId,
        ...data,
        timestamp: new Date().toISOString(),
      })
    }
  }

  public broadcastSeriesUpdate(seriesId: string, data: any) {
    if (this.io) {
      this.io.to(`series:${seriesId}`).emit('series:updated', {
        seriesId,
        ...data,
        timestamp: new Date().toISOString(),
      })
    }
  }

  public broadcastCategoryUpdate(categoryId: string, data: any) {
    if (this.io) {
      this.io.to(`category:${categoryId}`).emit('category:updated', {
        categoryId,
        ...data,
        timestamp: new Date().toISOString(),
      })
    }
  }

  public sendNotificationToUser(userId: string, notification: any) {
    if (this.io) {
      this.io.to(`user:${userId}`).emit('notification:new', {
        ...notification,
        timestamp: new Date().toISOString(),
      })
    }
  }

  public broadcastToAll(event: string, data: any) {
    if (this.io) {
      this.io.emit(event, {
        ...data,
        timestamp: new Date().toISOString(),
      })
    }
  }

  // Room management methods
  public joinMovieRoom(socket: any, movieId: string) {
    socket.join(`movie:${movieId}`)
    logger.info(`🎬 Socket ${socket.id} joined movie room: ${movieId}`)
  }

  public leaveMovieRoom(socket: any, movieId: string) {
    socket.leave(`movie:${movieId}`)
    logger.info(`🎬 Socket ${socket.id} left movie room: ${movieId}`)
  }

  public joinSeriesRoom(socket: any, seriesId: string) {
    socket.join(`series:${seriesId}`)
    logger.info(`📺 Socket ${socket.id} joined series room: ${seriesId}`)
  }

  public leaveSeriesRoom(socket: any, seriesId: string) {
    socket.leave(`series:${seriesId}`)
    logger.info(`📺 Socket ${socket.id} left series room: ${seriesId}`)
  }

  public joinCategoryRoom(socket: any, categoryId: string) {
    socket.join(`category:${categoryId}`)
    logger.info(`🏷️  Socket ${socket.id} joined category room: ${categoryId}`)
  }

  public leaveCategoryRoom(socket: any, categoryId: string) {
    socket.leave(`category:${categoryId}`)
    logger.info(`🏷️  Socket ${socket.id} left category room: ${categoryId}`)
  }

  // Get server instance for external use
  public getServer(): SocketIOServer | null {
    return this.io
  }

  // Graceful shutdown
  public async shutdown() {
    if (this.io) {
      logger.info('🔌 Shutting down WebSocket server...')
      this.io.disconnectSockets(true)
      await new Promise<void>(resolve => {
        this.io!.close(() => {
          logger.info('✅ WebSocket server shut down')
          resolve()
        })
      })
    }
  }
}

// Export singleton instance
let websocketServer: WebSocketServer | null = null

export const initializeWebSocket = (httpServer: HTTPServer): WebSocketServer => {
  if (!websocketServer) {
    websocketServer = new WebSocketServer(httpServer)
  }
  return websocketServer
}

export const getWebSocketServer = (): WebSocketServer | null => {
  return websocketServer
}
