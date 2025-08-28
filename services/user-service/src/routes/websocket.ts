import express from 'express'
import logger from '../config/logger.js'

const router = express.Router()

/**
 * @swagger
 * /api/websocket/info:
 *   get:
 *     summary: Get WebSocket server information
 *     description: Get information about the WebSocket server status and configuration
 *     tags: [WebSocket]
 *     responses:
 *       200:
 *         description: WebSocket server information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [running, stopped]
 *                 server:
 *                   type: object
 *                   properties:
 *                     port:
 *                       type: integer
 *                     protocol:
 *                       type: string
 *                     path:
 *                       type: string
 *                   required: [port, protocol, path]
 *                 clients:
 *                   type: object
 *                   properties:
 *                     connected:
 *                       type: integer
 *                     rooms:
 *                       type: integer
 *                   required: [connected, rooms]
 *                 uptime:
 *                   type: number
 *                   description: WebSocket server uptime in seconds
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *               required: [status, server, clients, uptime, timestamp]
 *       503:
 *         description: WebSocket server not available
 */
router.get('/info', (req, res) => {
  try {
    const websocketServer = (global as any).websocketServer

    if (!websocketServer) {
      return res.status(503).json({
        status: 'stopped',
        message: 'WebSocket server not initialized',
        timestamp: new Date().toISOString(),
      })
    }

    const serverInfo = {
      status: 'running',
      server: {
        port: websocketServer.port || 3002,
        protocol: process.env.NODE_ENV === 'production' ? 'wss' : 'ws',
        path: '/socket.io',
      },
      clients: {
        connected: websocketServer.engine?.clientsCount || 0,
        rooms: websocketServer.sockets?.adapter?.rooms?.size || 0,
      },
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    }

    res.json(serverInfo)
  } catch (error: any) {
    logger.error('WebSocket info error:', error)
    res.status(500).json({
      error: 'Failed to get WebSocket information',
      message: error.message,
      timestamp: new Date().toISOString(),
    })
  }
})

/**
 * @swagger
 * /api/websocket/clients:
 *   get:
 *     summary: Get connected WebSocket clients
 *     description: Get information about connected WebSocket clients
 *     tags: [WebSocket]
 *     responses:
 *       200:
 *         description: Connected clients information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 clients:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       userId:
 *                         type: string
 *                         nullable: true
 *                       connectedAt:
 *                         type: string
 *                         format: date-time
 *                       userAgent:
 *                         type: string
 *                         nullable: true
 *                       ip:
 *                         type: string
 *                         nullable: true
 *                     required: [id, connectedAt]
 *                 total:
 *                   type: integer
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *               required: [clients, total, timestamp]
 *       503:
 *         description: WebSocket server not available
 */
router.get('/clients', (req, res) => {
  try {
    const websocketServer = (global as any).websocketServer

    if (!websocketServer) {
      return res.status(503).json({
        error: 'WebSocket server not available',
        timestamp: new Date().toISOString(),
      })
    }

    const clients: any[] = []
    const sockets = websocketServer.sockets?.sockets || new Map()

    sockets.forEach((socket: any) => {
      clients.push({
        id: socket.id,
        userId: socket.userId || null,
        connectedAt: socket.connectedAt || new Date().toISOString(),
        userAgent: socket.handshake?.headers?.['user-agent'] || null,
        ip: socket.handshake?.address || null,
      })
    })

    res.json({
      clients,
      total: clients.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    logger.error('WebSocket clients error:', error)
    res.status(500).json({
      error: 'Failed to get WebSocket clients',
      message: error.message,
      timestamp: new Date().toISOString(),
    })
  }
})

/**
 * @swagger
 * /api/websocket/rooms:
 *   get:
 *     summary: Get WebSocket rooms information
 *     description: Get information about WebSocket rooms and their clients
 *     tags: [WebSocket]
 *     responses:
 *       200:
 *         description: Rooms information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 rooms:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       clientCount:
 *                         type: integer
 *                       clients:
 *                         type: array
 *                         items:
 *                           type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                     required: [name, clientCount, clients, createdAt]
 *                 total:
 *                   type: integer
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *               required: [rooms, total, timestamp]
 *       503:
 *         description: WebSocket server not available
 */
router.get('/rooms', (req, res) => {
  try {
    const websocketServer = (global as any).websocketServer

    if (!websocketServer) {
      return res.status(503).json({
        error: 'WebSocket server not available',
        timestamp: new Date().toISOString(),
      })
    }

    const rooms: any[] = []
    const adapter = websocketServer.sockets?.adapter

    if (adapter?.rooms) {
      adapter.rooms.forEach((room: any, roomName: string) => {
        if (roomName.includes('#')) {
          // Skip internal rooms
          return
        }

        rooms.push({
          name: roomName,
          clientCount: room.size || 0,
          clients: Array.from(room),
          createdAt: new Date().toISOString(),
        })
      })
    }

    res.json({
      rooms,
      total: rooms.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    logger.error('WebSocket rooms error:', error)
    res.status(500).json({
      error: 'Failed to get WebSocket rooms',
      message: error.message,
      timestamp: new Date().toISOString(),
    })
  }
})

/**
 * @swagger
 * /api/websocket/stats:
 *   get:
 *     summary: Get WebSocket server statistics
 *     description: Get detailed statistics about WebSocket server performance
 *     tags: [WebSocket]
 *     responses:
 *       200:
 *         description: WebSocket statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 server:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                     uptime:
 *                       type: number
 *                     memoryUsage:
 *                       type: object
 *                       properties:
 *                         rss:
 *                           type: number
 *                         heapTotal:
 *                           type: number
 *                         heapUsed:
 *                           type: number
 *                         external:
 *                           type: number
 *                       required: [rss, heapTotal, heapUsed, external]
 *                   required: [status, uptime, memoryUsage]
 *                 connections:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     active:
 *                       type: integer
 *                     peak:
 *                       type: integer
 *                     connectionsPerSecond:
 *                       type: number
 *                   required: [total, active, peak, connectionsPerSecond]
 *                 events:
 *                   type: object
 *                   properties:
 *                     connect:
 *                       type: integer
 *                     disconnect:
 *                       type: integer
 *                     message:
 *                       type: integer
 *                     error:
 *                       type: integer
 *                   required: [connect, disconnect, message, error]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *               required: [server, connections, events, timestamp]
 *       503:
 *         description: WebSocket server not available
 */
router.get('/stats', (req, res) => {
  try {
    const websocketServer = (global as any).websocketServer

    if (!websocketServer) {
      return res.status(503).json({
        error: 'WebSocket server not available',
        timestamp: new Date().toISOString(),
      })
    }

    const memoryUsage = process.memoryUsage()
    const uptime = process.uptime()

    // Get connection statistics
    const clientsCount = websocketServer.engine?.clientsCount || 0

    // Calculate connections per second (simplified)
    const connectionsPerSecond = clientsCount / Math.max(uptime, 1)

    const stats = {
      server: {
        status: 'running',
        uptime: uptime,
        memoryUsage: {
          rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
          external: Math.round(memoryUsage.external / 1024 / 1024), // MB
        },
      },
      connections: {
        total: clientsCount,
        active: clientsCount,
        peak: clientsCount, // TODO: Track peak connections
        connectionsPerSecond: Math.round(connectionsPerSecond * 100) / 100,
      },
      events: {
        connect: 0, // TODO: Track connection events
        disconnect: 0, // TODO: Track disconnection events
        message: 0, // TODO: Track message events
        error: 0, // TODO: Track error events
      },
      timestamp: new Date().toISOString(),
    }

    res.json(stats)
  } catch (error: any) {
    logger.error('WebSocket stats error:', error)
    res.status(500).json({
      error: 'Failed to get WebSocket statistics',
      message: error.message,
      timestamp: new Date().toISOString(),
    })
  }
})

export { router as websocketRouter }
