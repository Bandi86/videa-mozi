import { redis } from '../../index.js'
import logger from '../../config/logger.js'

/**
 * User activity tracking WebSocket event handlers
 * Tracks user behavior, preferences, and engagement in real-time
 */
export const userActivityHandlers = (socket: any, io: any) => {
  const user = socket.data.user
  const isAuthenticated = socket.data.authenticated
  const sessionId = socket.id

  // Track user online status
  socket.on('user:online', async () => {
    try {
      if (!isAuthenticated) return

      const userKey = `user:online:${user.id}`
      const sessionKey = `session:${sessionId}`

      // Set user online status
      await redis.setex(
        userKey,
        300,
        JSON.stringify({
          userId: user.id,
          username: user.username,
          lastSeen: new Date().toISOString(),
          sessionId,
        }),
      )

      // Track session
      await redis.setex(
        sessionKey,
        3600,
        JSON.stringify({
          userId: user.id,
          sessionId,
          connectedAt: new Date().toISOString(),
          ip: socket.handshake.address,
        }),
      )

      // Broadcast online status to friends/followers
      // In a real implementation, you'd get the user's friends/followers list
      io.emit('user:status:changed', {
        userId: user.id,
        username: user.username,
        status: 'online',
        timestamp: new Date().toISOString(),
      })

      logger.info(`🟢 User online: ${user.username} (${user.id})`)
    } catch (error) {
      logger.error('User online tracking error:', error)
    }
  })

  // Track user activity
  socket.on(
    'user:activity',
    async (activity: {
      type: string
      contentId?: string
      contentType?: string
      action: string
      metadata?: any
    }) => {
      try {
        if (!isAuthenticated) return

        const activityData = {
          userId: user.id,
          sessionId,
          ...activity,
          timestamp: new Date().toISOString(),
          ip: socket.handshake.address,
        }

        // Store activity in Redis for real-time analytics
        const activityKey = `activity:${user.id}:${Date.now()}`
        await redis.setex(activityKey, 86400, JSON.stringify(activityData)) // 24 hours

        // Add to user's activity feed
        const userActivityKey = `user_activity:${user.id}`
        await redis.lpush(userActivityKey, JSON.stringify(activityData))
        await redis.ltrim(userActivityKey, 0, 99) // Keep last 100 activities

        // Broadcast activity to followers (if public)
        if (activity.metadata?.public !== false) {
          // In a real implementation, you'd check privacy settings
          io.emit('user:activity:new', {
            userId: user.id,
            username: user.username,
            activity: activityData,
          })
        }

        logger.info(`📊 User activity: ${user.username} - ${activity.type}:${activity.action}`)
      } catch (error) {
        logger.error('User activity tracking error:', error)
      }
    },
  )

  // Track content engagement
  socket.on(
    'content:engage',
    async (engagement: {
      contentId: string
      contentType: string
      action: 'like' | 'dislike' | 'bookmark' | 'share' | 'watchlist'
      value?: any
    }) => {
      try {
        if (!isAuthenticated) {
          socket.emit('error', { message: 'Authentication required' })
          return
        }

        const { contentId, contentType, action, value } = engagement

        // Store engagement in Redis
        const engagementKey = `engagement:${user.id}:${contentType}:${contentId}:${action}`
        const engagementData = {
          userId: user.id,
          contentId,
          contentType,
          action,
          value,
          timestamp: new Date().toISOString(),
        }

        await redis.setex(engagementKey, 2592000, JSON.stringify(engagementData)) // 30 days

        // Update content engagement counters
        const counterKey = `content_engagement:${contentType}:${contentId}:${action}`
        await redis.incr(counterKey)

        // Broadcast engagement update
        io.to(`${contentType}:${contentId}`).emit('content:engagement:updated', {
          contentId,
          contentType,
          action,
          userId: user.id,
          value,
          timestamp: new Date().toISOString(),
        })

        // Log activity
        socket.emit('user:activity', {
          type: 'content_engagement',
          contentId,
          contentType,
          action,
          metadata: { value },
        })

        logger.info(
          `💖 Content engagement: ${user.username} ${action}d ${contentType}:${contentId}`,
        )
      } catch (error) {
        logger.error('Content engagement error:', error)
        socket.emit('error', { message: 'Failed to process engagement' })
      }
    },
  )

  // Track user preferences
  socket.on(
    'user:preference',
    async (preference: { key: string; value: any; category?: string }) => {
      try {
        if (!isAuthenticated) return

        const { key, value, category = 'general' } = preference

        // Store user preference
        const preferenceKey = `user_preference:${user.id}:${category}:${key}`
        await redis.set(
          preferenceKey,
          JSON.stringify({
            value,
            updatedAt: new Date().toISOString(),
          }),
        )

        logger.info(`⚙️  User preference updated: ${user.username} - ${category}:${key}`)
      } catch (error) {
        logger.error('User preference error:', error)
      }
    },
  )

  // Track search queries
  socket.on(
    'search:query',
    async (searchData: { query: string; category?: string; results: number; filters?: any }) => {
      try {
        const { query, category, results, filters } = searchData

        // Store search query for analytics
        const searchKey = `search:${Date.now()}:${sessionId}`
        await redis.setex(
          searchKey,
          3600,
          JSON.stringify({
            query,
            category,
            results,
            filters,
            userId: user?.id || 'anonymous',
            sessionId,
            timestamp: new Date().toISOString(),
            ip: socket.handshake.address,
          }),
        )

        // Track popular searches
        if (query.length > 2) {
          const popularSearchKey = `popular_search:${query.toLowerCase()}`
          await redis.incr(popularSearchKey)
          await redis.expire(popularSearchKey, 604800) // 7 days
        }

        logger.info(`🔍 Search query: "${query}" - ${results} results`)
      } catch (error) {
        logger.error('Search query tracking error:', error)
      }
    },
  )

  // Track page views and navigation
  socket.on(
    'page:view',
    async (pageData: { path: string; title?: string; referrer?: string; timeSpent?: number }) => {
      try {
        const { path, title, referrer, timeSpent } = pageData

        // Store page view
        const pageViewKey = `page_view:${sessionId}:${Date.now()}`
        await redis.setex(
          pageViewKey,
          3600,
          JSON.stringify({
            path,
            title,
            referrer,
            timeSpent,
            userId: user?.id || 'anonymous',
            sessionId,
            timestamp: new Date().toISOString(),
            ip: socket.handshake.address,
          }),
        )

        // Update page popularity
        const pagePopularityKey = `page_popularity:${path}`
        await redis.incr(pagePopularityKey)
        await redis.expire(pagePopularityKey, 604800) // 7 days

        logger.info(`📄 Page view: ${path} ${timeSpent ? `(${timeSpent}ms)` : ''}`)
      } catch (error) {
        logger.error('Page view tracking error:', error)
      }
    },
  )

  // Handle user typing indicators (for chat features)
  socket.on('user:typing:start', (data: { roomId: string }) => {
    if (!isAuthenticated) return

    socket.to(data.roomId).emit('user:typing:start', {
      userId: user.id,
      username: user.username,
    })
  })

  socket.on('user:typing:stop', (data: { roomId: string }) => {
    if (!isAuthenticated) return

    socket.to(data.roomId).emit('user:typing:stop', {
      userId: user.id,
      username: user.username,
    })
  })

  // Handle user presence in rooms
  socket.on('room:join', (roomId: string) => {
    socket.join(roomId)

    // Broadcast user joined
    socket.to(roomId).emit('user:joined', {
      userId: user?.id || 'anonymous',
      username: user?.username || 'Anonymous',
      timestamp: new Date().toISOString(),
    })

    logger.info(`🚪 User joined room: ${roomId}`)
  })

  socket.on('room:leave', (roomId: string) => {
    socket.leave(roomId)

    // Broadcast user left
    socket.to(roomId).emit('user:left', {
      userId: user?.id || 'anonymous',
      username: user?.username || 'Anonymous',
      timestamp: new Date().toISOString(),
    })

    logger.info(`🚪 User left room: ${roomId}`)
  })

  // Handle disconnection
  socket.on('disconnect', async () => {
    try {
      if (isAuthenticated) {
        // Update last seen
        const userKey = `user:online:${user.id}`
        await redis.setex(
          userKey,
          60,
          JSON.stringify({
            userId: user.id,
            username: user.username,
            lastSeen: new Date().toISOString(),
            status: 'offline',
          }),
        )

        // Remove session
        const sessionKey = `session:${sessionId}`
        await redis.del(sessionKey)

        // Broadcast offline status
        io.emit('user:status:changed', {
          userId: user.id,
          username: user.username,
          status: 'offline',
          timestamp: new Date().toISOString(),
        })

        logger.info(`🔴 User offline: ${user.username} (${user.id})`)
      }
    } catch (error) {
      logger.error('User disconnect handling error:', error)
    }
  })
}

/**
 * Get real-time analytics data
 */
export async function getRealtimeAnalytics(): Promise<any> {
  try {
    // Get online users count
    const onlineUsersPattern = 'user:online:*'
    const onlineUserKeys = await redis.keys(onlineUsersPattern)
    const onlineUsers = onlineUserKeys.length

    // Get active sessions
    const sessionPattern = 'session:*'
    const sessionKeys = await redis.keys(sessionPattern)
    const activeSessions = sessionKeys.length

    // Get popular searches
    const popularSearchesPattern = 'popular_search:*'
    const searchKeys = await redis.keys(popularSearchesPattern)

    const popularSearches = []
    for (const key of searchKeys.slice(0, 10)) {
      const count = await redis.get(key)
      const query = key.replace('popular_search:', '')
      popularSearches.push({ query, count: parseInt(count || '0') })
    }

    // Get top engaged content
    const engagementPattern = 'content_engagement:*'
    const engagementKeys = await redis.keys(engagementPattern)

    const topContent = []
    for (const key of engagementKeys.slice(0, 10)) {
      const count = await redis.get(key)
      const [, contentType, contentId, action] = key.split(':')
      topContent.push({
        contentType,
        contentId,
        action,
        count: parseInt(count || '0'),
      })
    }

    return {
      onlineUsers,
      activeSessions,
      popularSearches: popularSearches.sort((a, b) => b.count - a.count),
      topContent: topContent.sort((a, b) => b.count - a.count),
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    logger.error('Get realtime analytics error:', error)
    return {
      onlineUsers: 0,
      activeSessions: 0,
      popularSearches: [],
      topContent: [],
      timestamp: new Date().toISOString(),
      error: 'Failed to get analytics',
    }
  }
}
