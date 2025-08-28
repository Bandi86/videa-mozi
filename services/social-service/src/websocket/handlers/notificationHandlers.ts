import { Socket } from 'socket.io'
import logger from '../../config/logger.js'
import { NotificationsService } from '../../services/notificationsService.js'

/**
 * Handle notification-related WebSocket events
 */
export const registerNotificationHandlers = (socket: Socket) => {
  /**
   * Mark notification as read
   */
  socket.on('notification:read', async (data: any) => {
    try {
      const { notificationId, userId } = data

      if (!notificationId || !userId) {
        socket.emit('error', { message: 'Notification ID and user ID are required' })
        return
      }

      const notification = await NotificationsService.markAsRead(notificationId, userId)

      socket.emit('notification:read:success', notification)
      logger.info(`📖 Notification ${notificationId} marked as read by user ${userId}`)
    } catch (error) {
      logger.error('Mark notification as read error:', error)
      socket.emit('error', { message: 'Failed to mark notification as read' })
    }
  })

  /**
   * Mark all notifications as read
   */
  socket.on('notification:read:all', async (data: any) => {
    try {
      const { userId } = data

      if (!userId) {
        socket.emit('error', { message: 'User ID is required' })
        return
      }

      const count = await NotificationsService.markAllAsRead(userId)

      socket.emit('notification:read:all:success', { count })
      logger.info(`📚 All notifications marked as read for user ${userId} (${count} notifications)`)
    } catch (error) {
      logger.error('Mark all notifications as read error:', error)
      socket.emit('error', { message: 'Failed to mark all notifications as read' })
    }
  })

  /**
   * Delete a notification
   */
  socket.on('notification:delete', async (data: any) => {
    try {
      const { notificationId, userId } = data

      if (!notificationId || !userId) {
        socket.emit('error', { message: 'Notification ID and user ID are required' })
        return
      }

      await NotificationsService.deleteNotification(notificationId, userId)

      socket.emit('notification:deleted', { notificationId })
      logger.info(`🗑️ Notification ${notificationId} deleted by user ${userId}`)
    } catch (error) {
      logger.error('Delete notification error:', error)
      socket.emit('error', { message: 'Failed to delete notification' })
    }
  })

  /**
   * Get notifications for user
   */
  socket.on('notification:get', async (data: any) => {
    try {
      const { userId, page = 1, limit = 20, unreadOnly = false } = data

      if (!userId) {
        socket.emit('error', { message: 'User ID is required' })
        return
      }

      const notifications = await NotificationsService.getUserNotifications(userId, {
        page: Number(page),
        limit: Number(limit),
        unreadOnly: Boolean(unreadOnly),
      })

      socket.emit('notification:list', {
        userId,
        notifications: notifications.data,
        pagination: notifications.pagination,
      })
    } catch (error) {
      logger.error('Get notifications error:', error)
      socket.emit('error', { message: 'Failed to get notifications' })
    }
  })

  /**
   * Get notification history
   */
  socket.on('notification:history', async (data: any) => {
    try {
      const { userId, type, page = 1, limit = 20 } = data

      if (!userId) {
        socket.emit('error', { message: 'User ID is required' })
        return
      }

      const history = await NotificationsService.getNotificationHistory(userId, {
        type,
        page: Number(page),
        limit: Number(limit),
      })

      socket.emit('notification:history:list', {
        userId,
        type,
        history: history.data,
        pagination: history.pagination,
      })
    } catch (error) {
      logger.error('Get notification history error:', error)
      socket.emit('error', { message: 'Failed to get notification history' })
    }
  })

  /**
   * Get notification statistics
   */
  socket.on('notification:stats', async (data: any) => {
    try {
      const { userId } = data

      if (!userId) {
        socket.emit('error', { message: 'User ID is required' })
        return
      }

      const stats = await NotificationsService.getNotificationStats(userId)

      socket.emit('notification:stats', {
        userId,
        stats,
      })
    } catch (error) {
      logger.error('Get notification stats error:', error)
      socket.emit('error', { message: 'Failed to get notification statistics' })
    }
  })

  /**
   * Test notification system
   */
  socket.on('notification:test', async (data: any) => {
    try {
      const { userId, message = 'Test notification' } = data

      if (!userId) {
        socket.emit('error', { message: 'User ID is required' })
        return
      }

      const notification = await NotificationsService.createNotification({
        recipientId: userId,
        type: 'test',
        message,
        data: { test: true, timestamp: new Date().toISOString() },
      })

      // Send real-time notification
      socket.to(`user:${userId}`).emit('notification:new', notification)

      socket.emit('notification:test:success', {
        message: 'Test notification sent',
        notification,
      })

      logger.info(`🧪 Test notification sent to user ${userId}`)
    } catch (error) {
      logger.error('Test notification error:', error)
      socket.emit('error', { message: 'Failed to send test notification' })
    }
  })

  /**
   * Subscribe to notification updates for a user
   */
  socket.on('notification:subscribe', (data: any) => {
    const { userId } = data

    if (userId) {
      socket.join(`user:notifications:${userId}`)
      logger.info(`🔔 User subscribed to notifications: user:notifications:${userId}`)
    }
  })

  /**
   * Unsubscribe from notification updates
   */
  socket.on('notification:unsubscribe', (data: any) => {
    const { userId } = data

    if (userId) {
      socket.leave(`user:notifications:${userId}`)
      logger.info(`🔕 User unsubscribed from notifications: user:notifications:${userId}`)
    }
  })

  /**
   * Acknowledge notification (mark as seen but not read)
   */
  socket.on('notification:acknowledge', async (data: any) => {
    try {
      const { notificationId, userId } = data

      if (!notificationId || !userId) {
        socket.emit('error', { message: 'Notification ID and user ID are required' })
        return
      }

      const notification = await NotificationsService.markAsSeen(notificationId, userId)

      socket.emit('notification:acknowledged', notification)
      logger.info(`👁️ Notification ${notificationId} acknowledged by user ${userId}`)
    } catch (error) {
      logger.error('Acknowledge notification error:', error)
      socket.emit('error', { message: 'Failed to acknowledge notification' })
    }
  })

  /**
   * Get unread notification count
   */
  socket.on('notification:unread:count', async (data: any) => {
    try {
      const { userId } = data

      if (!userId) {
        socket.emit('error', { message: 'User ID is required' })
        return
      }

      const count = await NotificationsService.getUnreadCount(userId)

      socket.emit('notification:unread:count', {
        userId,
        count,
      })
    } catch (error) {
      logger.error('Get unread count error:', error)
      socket.emit('error', { message: 'Failed to get unread count' })
    }
  })

  /**
   * Bulk delete notifications
   */
  socket.on('notification:delete:bulk', async (data: any) => {
    try {
      const { notificationIds, userId } = data

      if (!notificationIds || !Array.isArray(notificationIds) || !userId) {
        socket.emit('error', { message: 'Notification IDs array and user ID are required' })
        return
      }

      const deletedCount = await NotificationsService.bulkDeleteNotifications(
        notificationIds,
        userId,
      )

      socket.emit('notification:deleted:bulk', {
        deletedCount,
        notificationIds,
      })

      logger.info(`🗑️ Bulk deleted ${deletedCount} notifications for user ${userId}`)
    } catch (error) {
      logger.error('Bulk delete notifications error:', error)
      socket.emit('error', { message: 'Failed to bulk delete notifications' })
    }
  })
}
