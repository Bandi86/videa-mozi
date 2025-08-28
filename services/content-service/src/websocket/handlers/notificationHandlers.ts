import { redis } from '../../index.js'
import logger from '../../config/logger.js'

/**
 * Notification-related WebSocket event handlers
 * Handles real-time notifications for users
 */
export const notificationHandlers = (socket: any, io: any) => {
  const user = socket.data.user
  const isAuthenticated = socket.data.authenticated

  // Mark notification as read
  socket.on('notification:read', async (notificationId: string) => {
    try {
      if (!isAuthenticated) {
        socket.emit('error', { message: 'Authentication required' })
        return
      }

      // Mark notification as read in Redis/database
      const notificationKey = `notification:${user.id}:${notificationId}`
      await redis.set(notificationKey, 'read')

      // Notify other clients of the user
      io.to(`user:${user.id}`).emit('notification:read', {
        notificationId,
        userId: user.id,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      logger.error('Notification read error:', error)
      socket.emit('error', { message: 'Failed to mark notification as read' })
    }
  })

  // Mark all notifications as read
  socket.on('notification:read:all', async () => {
    try {
      if (!isAuthenticated) {
        socket.emit('error', { message: 'Authentication required' })
        return
      }

      // Mark all notifications as read
      const pattern = `notification:${user.id}:*`
      const keys = await redis.keys(pattern)

      if (keys.length > 0) {
        await redis.del(keys)
      }

      // Notify other clients
      io.to(`user:${user.id}`).emit('notification:read:all', {
        userId: user.id,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      logger.error('Mark all notifications read error:', error)
      socket.emit('error', { message: 'Failed to mark notifications as read' })
    }
  })

  // Get notification history
  socket.on('notification:history', async (options: { limit?: number; offset?: number } = {}) => {
    try {
      if (!isAuthenticated) {
        socket.emit('error', { message: 'Authentication required' })
        return
      }

      const { limit = 20, offset = 0 } = options

      // Get notifications from Redis/database
      const notifications = await getUserNotifications(user.id, limit, offset)

      socket.emit('notification:history', {
        notifications,
        pagination: {
          limit,
          offset,
          hasMore: notifications.length === limit,
        },
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      logger.error('Get notification history error:', error)
      socket.emit('error', { message: 'Failed to get notification history' })
    }
  })

  // Subscribe to specific notification types
  socket.on('notification:subscribe', (types: string[]) => {
    if (!isAuthenticated) {
      socket.emit('error', { message: 'Authentication required' })
      return
    }

    // Leave existing notification rooms
    types.forEach(type => {
      socket.leave(`notifications:${type}`)
    })

    // Join new notification rooms
    types.forEach(type => {
      socket.join(`notifications:${type}`)
      logger.info(`🔔 User ${user.username} subscribed to ${type} notifications`)
    })

    socket.emit('notification:subscribed', {
      types,
      timestamp: new Date().toISOString(),
    })
  })

  // Unsubscribe from notification types
  socket.on('notification:unsubscribe', (types: string[]) => {
    if (!isAuthenticated) {
      socket.emit('error', { message: 'Authentication required' })
      return
    }

    types.forEach(type => {
      socket.leave(`notifications:${type}`)
      logger.info(`🔕 User ${user.username} unsubscribed from ${type} notifications`)
    })

    socket.emit('notification:unsubscribed', {
      types,
      timestamp: new Date().toISOString(),
    })
  })

  // Send test notification (for development/testing)
  socket.on('notification:test', async () => {
    try {
      if (!isAuthenticated) {
        socket.emit('error', { message: 'Authentication required' })
        return
      }

      const testNotification = {
        id: `test-${Date.now()}`,
        type: 'test',
        title: 'Test Notification',
        message: 'This is a test notification from the WebSocket server',
        data: {
          timestamp: new Date().toISOString(),
          source: 'websocket-test',
        },
        priority: 'low',
        userId: user.id,
      }

      // Store notification
      await storeNotification(user.id, testNotification)

      // Send to user
      io.to(`user:${user.id}`).emit('notification:new', testNotification)

      socket.emit('notification:test:sent', {
        notificationId: testNotification.id,
        timestamp: new Date().toISOString(),
      })

      logger.info(`🧪 Test notification sent to ${user.username}`)
    } catch (error) {
      logger.error('Test notification error:', error)
      socket.emit('error', { message: 'Failed to send test notification' })
    }
  })
}

/**
 * Store notification in Redis/database
 */
async function storeNotification(userId: string, notification: any): Promise<void> {
  try {
    const notificationKey = `notification:${userId}:${notification.id}`
    const userNotificationsKey = `user_notifications:${userId}`

    // Store notification data
    await redis.setex(notificationKey, 604800, JSON.stringify(notification)) // 7 days

    // Add to user's notification list
    await redis.lpush(userNotificationsKey, notification.id)
    await redis.ltrim(userNotificationsKey, 0, 99) // Keep only last 100 notifications
  } catch (error) {
    logger.error('Store notification error:', error)
    throw error
  }
}

/**
 * Get user notifications from Redis
 */
async function getUserNotifications(
  userId: string,
  limit: number = 20,
  offset: number = 0,
): Promise<any[]> {
  try {
    const userNotificationsKey = `user_notifications:${userId}`
    const notificationIds = await redis.lrange(userNotificationsKey, offset, offset + limit - 1)

    const notifications = []

    for (const notificationId of notificationIds) {
      const notificationKey = `notification:${userId}:${notificationId}`
      const notificationData = await redis.get(notificationKey)

      if (notificationData) {
        notifications.push(JSON.parse(notificationData))
      }
    }

    return notifications
  } catch (error) {
    logger.error('Get user notifications error:', error)
    return []
  }
}

/**
 * Send notification to user (can be called from other parts of the application)
 */
export async function sendNotificationToUser(
  io: any,
  userId: string,
  notification: any,
): Promise<void> {
  try {
    // Store notification
    await storeNotification(userId, notification)

    // Send real-time notification
    io.to(`user:${userId}`).emit('notification:new', notification)

    logger.info(`📤 Notification sent to user ${userId}: ${notification.title}`)
  } catch (error) {
    logger.error('Send notification error:', error)
  }
}

/**
 * Broadcast notification to all users with specific role
 */
export async function broadcastNotification(
  io: any,
  role: string,
  notification: any,
): Promise<void> {
  try {
    // Store notification for each user with the role
    // This would require user data - in a real implementation,
    // you'd query the database for users with the specified role

    // For now, broadcast to a role-based room
    io.to(`role:${role}`).emit('notification:new', {
      ...notification,
      broadcast: true,
      role,
      timestamp: new Date().toISOString(),
    })

    logger.info(`📢 Broadcast notification to role ${role}: ${notification.title}`)
  } catch (error) {
    logger.error('Broadcast notification error:', error)
  }
}

/**
 * Send system-wide notification
 */
export async function sendSystemNotification(io: any, notification: any): Promise<void> {
  try {
    io.emit('notification:system', {
      ...notification,
      system: true,
      timestamp: new Date().toISOString(),
    })

    logger.info(`🌐 System notification sent: ${notification.title}`)
  } catch (error) {
    logger.error('System notification error:', error)
  }
}
