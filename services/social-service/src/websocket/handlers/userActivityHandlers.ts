import { Socket } from 'socket.io'
import logger from '../../config/logger.js'

/**
 * Handle user activity-related WebSocket events
 */
export const registerUserActivityHandlers = (socket: Socket) => {
  /**
   * User goes online
   */
  socket.on('user:online', (data: any) => {
    const { userId, username, userAgent } = data

    if (userId) {
      // Join user's personal room
      socket.join(`user:${userId}`)

      // Broadcast online status to followers
      socket.to(`user:followers:${userId}`).emit('user:status:changed', {
        userId,
        username,
        status: 'online',
        timestamp: new Date().toISOString(),
      })

      // Update presence in Redis (if available)
      if (global.redisClient) {
        try {
          global.redisClient.set(
            `user:presence:${userId}`,
            JSON.stringify({
              status: 'online',
              socketId: socket.id,
              lastSeen: new Date().toISOString(),
              userAgent,
            }),
            'EX',
            300,
          ) // 5 minutes expiry
        } catch (redisError) {
          logger.error('Redis presence update error:', redisError)
        }
      }

      logger.info(`🟢 User ${userId} (${username}) came online`)
    }
  })

  /**
   * User goes offline
   */
  socket.on('user:offline', (data: any) => {
    const { userId, username } = data

    if (userId) {
      // Leave user's personal room
      socket.leave(`user:${userId}`)

      // Broadcast offline status to followers
      socket.to(`user:followers:${userId}`).emit('user:status:changed', {
        userId,
        username,
        status: 'offline',
        timestamp: new Date().toISOString(),
      })

      // Remove presence from Redis
      if (global.redisClient) {
        try {
          global.redisClient.del(`user:presence:${userId}`)
        } catch (redisError) {
          logger.error('Redis presence delete error:', redisError)
        }
      }

      logger.info(`🔴 User ${userId} (${username}) went offline`)
    }
  })

  /**
   * Track user activity
   */
  socket.on('user:activity', (data: any) => {
    const { userId, activity, metadata } = data

    if (userId && activity) {
      const activityData = {
        userId,
        activity,
        metadata: metadata || {},
        timestamp: new Date().toISOString(),
      }

      // Broadcast activity to followers (optional - can be disabled for privacy)
      // socket.to(`user:followers:${userId}`).emit('user:activity:update', activityData)

      // Store activity in Redis for analytics
      if (global.redisClient) {
        try {
          global.redisClient.lpush(`user:activity:${userId}`, JSON.stringify(activityData))
          global.redisClient.ltrim(`user:activity:${userId}`, 0, 99) // Keep last 100 activities
          global.redisClient.expire(`user:activity:${userId}`, 86400) // 24 hours
        } catch (redisError) {
          logger.error('Redis activity tracking error:', redisError)
        }
      }

      logger.info(`📊 User ${userId} activity: ${activity}`)
    }
  })

  /**
   * Track content engagement
   */
  socket.on('user:content:engage', (data: any) => {
    const { userId, contentId, contentType, action, duration } = data

    if (userId && contentId && contentType && action) {
      const engagementData = {
        userId,
        contentId,
        contentType,
        action,
        duration: duration || 0,
        timestamp: new Date().toISOString(),
      }

      // Broadcast engagement to content room for real-time analytics
      socket.to(`content:${contentType}:${contentId}`).emit('content:engagement', engagementData)

      // Store engagement in Redis
      if (global.redisClient) {
        try {
          const key = `content:engagement:${contentType}:${contentId}`
          global.redisClient.lpush(key, JSON.stringify(engagementData))
          global.redisClient.ltrim(key, 0, 49) // Keep last 50 engagements
          global.redisClient.expire(key, 3600) // 1 hour
        } catch (redisError) {
          logger.error('Redis engagement tracking error:', redisError)
        }
      }

      logger.info(`🎯 User ${userId} engaged with ${contentType}:${contentId} (${action})`)
    }
  })

  /**
   * Track user preferences
   */
  socket.on('user:preference:update', (data: any) => {
    const { userId, preferences } = data

    if (userId && preferences) {
      const preferenceData = {
        userId,
        preferences,
        timestamp: new Date().toISOString(),
      }

      // Store preferences in Redis
      if (global.redisClient) {
        try {
          global.redisClient.set(`user:preferences:${userId}`, JSON.stringify(preferenceData))
          global.redisClient.expire(`user:preferences:${userId}`, 604800) // 7 days
        } catch (redisError) {
          logger.error('Redis preference update error:', redisError)
        }
      }

      logger.info(`⚙️ User ${userId} updated preferences`)
    }
  })

  /**
   * Track search queries
   */
  socket.on('user:search', (data: any) => {
    const { userId, query, results, filters } = data

    if (userId && query) {
      const searchData = {
        userId,
        query,
        results: results || 0,
        filters: filters || {},
        timestamp: new Date().toISOString(),
      }

      // Store search in Redis for analytics
      if (global.redisClient) {
        try {
          global.redisClient.lpush(`user:searches:${userId}`, JSON.stringify(searchData))
          global.redisClient.ltrim(`user:searches:${userId}`, 0, 19) // Keep last 20 searches
          global.redisClient.expire(`user:searches:${userId}`, 86400) // 24 hours
        } catch (redisError) {
          logger.error('Redis search tracking error:', redisError)
        }
      }

      logger.info(`🔍 User ${userId} searched: "${query}"`)
    }
  })

  /**
   * Track page views
   */
  socket.on('user:page:view', (data: any) => {
    const { userId, page, referrer, duration } = data

    if (userId && page) {
      const pageViewData = {
        userId,
        page,
        referrer: referrer || '',
        duration: duration || 0,
        timestamp: new Date().toISOString(),
      }

      // Store page view in Redis
      if (global.redisClient) {
        try {
          global.redisClient.lpush(`user:pageviews:${userId}`, JSON.stringify(pageViewData))
          global.redisClient.ltrim(`user:pageviews:${userId}`, 0, 99) // Keep last 100 page views
          global.redisClient.expire(`user:pageviews:${userId}`, 86400) // 24 hours
        } catch (redisError) {
          logger.error('Redis page view tracking error:', redisError)
        }
      }

      logger.info(`📄 User ${userId} viewed page: ${page}`)
    }
  })

  /**
   * Typing indicators
   */
  socket.on('user:typing:start', (data: any) => {
    const { userId, targetUserId, targetType, targetId } = data

    if (userId && targetUserId && targetType && targetId) {
      const typingData = {
        userId,
        timestamp: new Date().toISOString(),
      }

      // Broadcast typing indicator to target
      if (targetType === 'user') {
        socket.to(`user:${targetUserId}`).emit('user:typing:start', typingData)
      } else if (targetType === 'post') {
        socket.to(`post:${targetId}`).emit('user:typing:start', typingData)
      }
    }
  })

  socket.on('user:typing:stop', (data: any) => {
    const { userId, targetUserId, targetType, targetId } = data

    if (userId && targetUserId && targetType && targetId) {
      const typingData = {
        userId,
        timestamp: new Date().toISOString(),
      }

      // Stop typing indicator
      if (targetType === 'user') {
        socket.to(`user:${targetUserId}`).emit('user:typing:stop', typingData)
      } else if (targetType === 'post') {
        socket.to(`post:${targetId}`).emit('user:typing:stop', typingData)
      }
    }
  })

  /**
   * Presence indicators
   */
  socket.on('presence:join', (data: any) => {
    const { userId, room, roomType } = data

    if (userId && room && roomType) {
      socket.join(`${roomType}:${room}`)

      // Broadcast presence to room
      socket.to(`${roomType}:${room}`).emit('presence:joined', {
        userId,
        room,
        roomType,
        timestamp: new Date().toISOString(),
      })

      logger.info(`👥 User ${userId} joined ${roomType}:${room}`)
    }
  })

  socket.on('presence:leave', (data: any) => {
    const { userId, room, roomType } = data

    if (userId && room && roomType) {
      socket.leave(`${roomType}:${room}`)

      // Broadcast presence to room
      socket.to(`${roomType}:${room}`).emit('presence:left', {
        userId,
        room,
        roomType,
        timestamp: new Date().toISOString(),
      })

      logger.info(`👋 User ${userId} left ${roomType}:${room}`)
    }
  })

  /**
   * Get user's online status
   */
  socket.on('user:status:get', async (data: any) => {
    const { userId } = data

    if (userId) {
      let status = 'offline'
      let lastSeen = null

      if (global.redisClient) {
        try {
          const presenceData = await global.redisClient.get(`user:presence:${userId}`)
          if (presenceData) {
            const presence = JSON.parse(presenceData)
            status = presence.status
            lastSeen = presence.lastSeen
          }
        } catch (redisError) {
          logger.error('Redis status check error:', redisError)
        }
      }

      socket.emit('user:status', {
        userId,
        status,
        lastSeen,
      })
    }
  })

  /**
   * Heartbeat for presence
   */
  socket.on('user:heartbeat', (data: any) => {
    const { userId, userAgent } = data

    if (userId && global.redisClient) {
      try {
        global.redisClient.set(
          `user:presence:${userId}`,
          JSON.stringify({
            status: 'online',
            socketId: socket.id,
            lastSeen: new Date().toISOString(),
            userAgent,
          }),
          'EX',
          300,
        ) // 5 minutes expiry
      } catch (redisError) {
        logger.error('Redis heartbeat error:', redisError)
      }
    }
  })
}
