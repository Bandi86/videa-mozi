import { Socket } from 'socket.io'
import logger from '../../config/logger.js'
import { moderationQueueService } from '../../services/moderationQueueService.js'
import { reportsService } from '../../services/reportsService.js'
import { contentFlagsService } from '../../services/contentFlagsService.js'
import { appealsService } from '../../services/appealsService.js'
import {
  requireModerator,
  logModerationEvent,
  joinModeratorRoom,
  updatePresence,
} from '../middleware/auth.js'

/**
 * Handle moderation-related WebSocket events
 */
export const registerModerationHandlers = (socket: Socket) => {
  /**
   * Moderator goes online
   */
  socket.on('moderator:online', (data: any) => {
    const { moderatorId } = data

    if (moderatorId && socket.user?.id === moderatorId && socket.user?.isModerator) {
      joinModeratorRoom(socket)
      updatePresence(socket)

      socket.emit('moderator:online:success', {
        moderatorId,
        timestamp: new Date().toISOString(),
      })

      logger.info(`🟢 Moderator ${moderatorId} came online`)
    } else {
      socket.emit('error', { message: 'Invalid moderator credentials' })
    }
  })

  /**
   * Moderator goes offline
   */
  socket.on('moderator:offline', (data: any) => {
    const { moderatorId } = data

    if (moderatorId && socket.user?.id === moderatorId && socket.user?.isModerator) {
      socket.leave(`moderator:${moderatorId}`)

      // Remove presence from Redis
      if (global.redisClient) {
        try {
          global.redisClient.del(`moderator:presence:${moderatorId}`)
        } catch (redisError) {
          logger.error('Redis presence delete error:', redisError)
        }
      }

      socket.emit('moderator:offline:success', {
        moderatorId,
        timestamp: new Date().toISOString(),
      })

      logger.info(`🔴 Moderator ${moderatorId} went offline`)
    }
  })

  /**
   * Get moderation dashboard data
   */
  socket.on('moderation:dashboard', async (data: any) => {
    if (!socket.user?.isModerator) {
      socket.emit('error', { message: 'Moderator privileges required' })
      return
    }

    try {
      const { dateFrom, dateTo } = data

      // Get all statistics in parallel
      const [queueStats, reportStats, flagStats, appealStats] = await Promise.all([
        moderationQueueService.getQueueStats(
          dateFrom ? new Date(dateFrom) : undefined,
          dateTo ? new Date(dateTo) : undefined,
        ),
        reportsService.getReportStats(
          dateFrom ? new Date(dateFrom) : undefined,
          dateTo ? new Date(dateTo) : undefined,
        ),
        contentFlagsService.getContentFlagStats(
          dateFrom ? new Date(dateFrom) : undefined,
          dateTo ? new Date(dateTo) : undefined,
        ),
        appealsService.getAppealStats(
          dateFrom ? new Date(dateFrom) : undefined,
          dateTo ? new Date(dateTo) : undefined,
        ),
      ])

      const dashboardData = {
        queue: {
          total: queueStats.total,
          unprocessed: queueStats.unprocessed,
          assigned: queueStats.assigned,
          unassigned: queueStats.unassigned,
          byPriority: queueStats.byPriority,
        },
        reports: {
          total: reportStats.total,
          pending: reportStats.pending,
          resolved: reportStats.resolved,
          dismissed: reportStats.dismissed,
          byType: reportStats.byType,
        },
        contentFlags: {
          total: flagStats.total,
          unresolved: flagStats.unresolved,
          byType: flagStats.byType,
          averageConfidence: flagStats.averageConfidence,
        },
        appeals: {
          total: appealStats.total,
          pending: appealStats.pending,
          approved: appealStats.approved,
          rejected: appealStats.rejected,
          byStatus: appealStats.byStatus,
        },
        timestamp: new Date().toISOString(),
      }

      socket.emit('moderation:dashboard:data', dashboardData)
      logger.info(`📊 Dashboard data sent to moderator ${socket.user.id}`)
    } catch (error) {
      logger.error('Get moderation dashboard error:', error)
      socket.emit('error', { message: 'Failed to get dashboard data' })
    }
  })

  /**
   * Subscribe to moderation updates
   */
  socket.on('moderation:subscribe', (data: any) => {
    if (!socket.user?.isModerator) {
      socket.emit('error', { message: 'Moderator privileges required' })
      return
    }

    const { moderatorId } = data

    if (moderatorId && socket.user.id === moderatorId) {
      socket.join(`moderation:updates`)
      socket.join(`moderator:${moderatorId}`)

      socket.emit('moderation:subscribed', {
        moderatorId,
        timestamp: new Date().toISOString(),
      })

      logger.info(`🔔 Moderator ${moderatorId} subscribed to moderation updates`)
    }
  })

  /**
   * Unsubscribe from moderation updates
   */
  socket.on('moderation:unsubscribe', (data: any) => {
    if (!socket.user?.isModerator) {
      return
    }

    const { moderatorId } = data

    if (moderatorId && socket.user.id === moderatorId) {
      socket.leave(`moderation:updates`)
      socket.leave(`moderator:${moderatorId}`)

      socket.emit('moderation:unsubscribed', {
        moderatorId,
        timestamp: new Date().toISOString(),
      })

      logger.info(`🔕 Moderator ${moderatorId} unsubscribed from moderation updates`)
    }
  })

  /**
   * Take moderation action
   */
  socket.on('moderation:action', async (data: any) => {
    if (!socket.user?.isModerator) {
      socket.emit('error', { message: 'Moderator privileges required' })
      return
    }

    try {
      const { action, targetId, targetType, reason, metadata } = data

      if (!action || !targetId || !targetType) {
        socket.emit('error', { message: 'Action, target ID, and target type are required' })
        return
      }

      // Log the moderation action
      logger.info(
        `🛡️ Moderation action taken: ${action} on ${targetType}:${targetId} by ${socket.user.id}`,
      )

      // Broadcast the action to other moderators
      socket.to('moderation:updates').emit('moderation:action:taken', {
        action,
        targetId,
        targetType,
        moderatorId: socket.user.id,
        reason,
        metadata,
        timestamp: new Date().toISOString(),
      })

      socket.emit('moderation:action:success', {
        action,
        targetId,
        targetType,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      logger.error('Moderation action error:', error)
      socket.emit('error', { message: 'Failed to take moderation action' })
    }
  })

  /**
   * Get real-time queue updates
   */
  socket.on('moderation:queue:watch', async (data: any) => {
    if (!socket.user?.isModerator) {
      socket.emit('error', { message: 'Moderator privileges required' })
      return
    }

    try {
      const { limit = 10 } = data

      // Get unassigned items
      const unassignedItems = await moderationQueueService.getUnassignedItems(limit)

      socket.emit('moderation:queue:items', {
        unassigned: unassignedItems,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      logger.error('Get queue items error:', error)
      socket.emit('error', { message: 'Failed to get queue items' })
    }
  })

  /**
   * Join specific moderation room
   */
  socket.on('moderation:room:join', (data: any) => {
    if (!socket.user?.isModerator) {
      socket.emit('error', { message: 'Moderator privileges required' })
      return
    }

    const { room } = data

    if (room) {
      socket.join(`moderation:${room}`)
      logger.info(`👥 Moderator joined room: moderation:${room}`)
    }
  })

  /**
   * Leave specific moderation room
   */
  socket.on('moderation:room:leave', (data: any) => {
    if (!socket.user?.isModerator) {
      return
    }

    const { room } = data

    if (room) {
      socket.leave(`moderation:${room}`)
      logger.info(`👋 Moderator left room: moderation:${room}`)
    }
  })

  /**
   * Send message to all moderators
   */
  socket.on('moderation:broadcast', (data: any) => {
    if (!socket.user?.isModerator) {
      socket.emit('error', { message: 'Moderator privileges required' })
      return
    }

    const { message, type = 'info' } = data

    if (!message) {
      socket.emit('error', { message: 'Message is required' })
      return
    }

    const broadcastData = {
      message,
      type,
      from: socket.user.id,
      fromUsername: socket.user.username,
      timestamp: new Date().toISOString(),
    }

    // Broadcast to all moderators
    socket.to('moderation:updates').emit('moderation:broadcast', broadcastData)
    socket.emit('moderation:broadcast:success', broadcastData)

    logger.info(`📢 Moderator broadcast from ${socket.user.id}: ${message}`)
  })

  /**
   * Heartbeat for moderator presence
   */
  socket.on('moderator:heartbeat', () => {
    if (socket.user?.isModerator) {
      updatePresence(socket)
    }
  })
}
