import { Socket } from 'socket.io'
import logger from '../../config/logger.js'
import { contentFlagsService } from '../../services/contentFlagsService.js'
import { requireModerator, logModerationEvent } from '../middleware/auth.js'

/**
 * Handle content flag-related WebSocket events
 */
export const registerContentFlagHandlers = (socket: Socket) => {
  /**
   * Get content flag by ID
   */
  socket.on('content-flag:get', async (data: any) => {
    try {
      const { flagId } = data

      if (!flagId) {
        socket.emit('error', { message: 'Content flag ID is required' })
        return
      }

      const flag = await contentFlagsService.getContentFlagById(flagId)

      socket.emit('content-flag:data', flag)
      logModerationEvent('content-flag:get')(socket, data)
    } catch (error) {
      logger.error('Get content flag error:', error)
      socket.emit('error', { message: 'Failed to get content flag' })
    }
  })

  /**
   * Get content flags with filtering
   */
  socket.on('content-flag:list', async (data: any) => {
    try {
      const filters = {
        contentId: data.contentId,
        contentType: data.contentType,
        flagType: data.flagType,
        isResolved: data.isResolved,
        confidence:
          data.confidenceMin || data.confidenceMax
            ? {
                min: data.confidenceMin,
                max: data.confidenceMax,
              }
            : undefined,
      }

      const pagination = {
        page: data.page || 1,
        limit: data.limit || 20,
      }

      const result = await contentFlagsService.getContentFlags(filters, pagination)

      socket.emit('content-flag:list:data', result)
      logModerationEvent('content-flag:list')(socket, data)
    } catch (error) {
      logger.error('Get content flags error:', error)
      socket.emit('error', { message: 'Failed to get content flags' })
    }
  })

  /**
   * Update content flag
   */
  socket.on('content-flag:update', async (data: any) => {
    if (!socket.user?.isModerator) {
      socket.emit('error', { message: 'Moderator privileges required' })
      return
    }

    try {
      const { flagId, updateData } = data

      if (!flagId || !updateData) {
        socket.emit('error', { message: 'Content flag ID and update data are required' })
        return
      }

      const flag = await contentFlagsService.updateContentFlag(flagId, updateData)

      // Broadcast update to content room and moderation updates
      socket.to(`content:${flag.contentId}`).emit('content-flag:updated', flag)
      socket.to('moderation:updates').emit('content-flag:updated', flag)

      socket.emit('content-flag:updated', flag)
      logModerationEvent('content-flag:update')(socket, data)
    } catch (error) {
      logger.error('Update content flag error:', error)
      socket.emit('error', { message: 'Failed to update content flag' })
    }
  })

  /**
   * Resolve content flag
   */
  socket.on('content-flag:resolve', async (data: any) => {
    if (!socket.user?.isModerator) {
      socket.emit('error', { message: 'Moderator privileges required' })
      return
    }

    try {
      const { flagId } = data

      if (!flagId) {
        socket.emit('error', { message: 'Content flag ID is required' })
        return
      }

      const flag = await contentFlagsService.resolveContentFlag(flagId, socket.user.id)

      // Broadcast resolution to content room and moderation updates
      socket.to(`content:${flag.contentId}`).emit('content-flag:resolved', flag)
      socket.to('moderation:updates').emit('content-flag:resolved', flag)

      socket.emit('content-flag:resolved', flag)
      logModerationEvent('content-flag:resolve')(socket, data)
    } catch (error) {
      logger.error('Resolve content flag error:', error)
      socket.emit('error', { message: 'Failed to resolve content flag' })
    }
  })

  /**
   * Delete content flag
   */
  socket.on('content-flag:delete', async (data: any) => {
    if (!socket.user?.isModerator) {
      socket.emit('error', { message: 'Moderator privileges required' })
      return
    }

    try {
      const { flagId } = data

      if (!flagId) {
        socket.emit('error', { message: 'Content flag ID is required' })
        return
      }

      await contentFlagsService.deleteContentFlag(flagId)

      // Broadcast deletion to moderation updates
      socket.to('moderation:updates').emit('content-flag:deleted', { flagId })

      socket.emit('content-flag:deleted', { flagId })
      logModerationEvent('content-flag:delete')(socket, data)
    } catch (error) {
      logger.error('Delete content flag error:', error)
      socket.emit('error', { message: 'Failed to delete content flag' })
    }
  })

  /**
   * Get flags for specific content
   */
  socket.on('content-flag:content:list', async (data: any) => {
    try {
      const { contentId } = data

      if (!contentId) {
        socket.emit('error', { message: 'Content ID is required' })
        return
      }

      const flags = await contentFlagsService.getContentFlagsByContentId(contentId)

      socket.emit('content-flag:content:list:data', {
        contentId,
        flags,
        timestamp: new Date().toISOString(),
      })

      logModerationEvent('content-flag:content:list')(socket, data)
    } catch (error) {
      logger.error('Get content flags by content ID error:', error)
      socket.emit('error', { message: 'Failed to get content flags' })
    }
  })

  /**
   * Bulk resolve content flags
   */
  socket.on('content-flag:bulk:resolve', async (data: any) => {
    if (!socket.user?.isModerator) {
      socket.emit('error', { message: 'Moderator privileges required' })
      return
    }

    try {
      const { flagIds } = data

      if (!flagIds || !Array.isArray(flagIds)) {
        socket.emit('error', { message: 'Content flag IDs array is required' })
        return
      }

      const result = await contentFlagsService.bulkResolveFlags(flagIds, socket.user.id)

      socket.to('moderation:updates').emit('content-flag:bulk:resolved', {
        flagIds,
        moderatorId: socket.user.id,
        count: result.count,
        timestamp: new Date().toISOString(),
      })

      socket.emit('content-flag:bulk:resolved', {
        flagIds,
        count: result.count,
        timestamp: new Date().toISOString(),
      })

      logModerationEvent('content-flag:bulk:resolve')(socket, data)
    } catch (error) {
      logger.error('Bulk resolve content flags error:', error)
      socket.emit('error', { message: 'Failed to bulk resolve content flags' })
    }
  })

  /**
   * Get high-confidence unresolved flags
   */
  socket.on('content-flag:high-confidence', async (data: any) => {
    if (!socket.user?.isModerator) {
      socket.emit('error', { message: 'Moderator privileges required' })
      return
    }

    try {
      const { threshold = 0.8, limit = 50 } = data

      const flags = await contentFlagsService.getHighConfidenceFlags(threshold, limit)

      socket.emit('content-flag:high-confidence:data', {
        flags,
        threshold,
        limit,
        timestamp: new Date().toISOString(),
      })

      logModerationEvent('content-flag:high-confidence')(socket, data)
    } catch (error) {
      logger.error('Get high confidence flags error:', error)
      socket.emit('error', { message: 'Failed to get high confidence flags' })
    }
  })

  /**
   * Get content flag statistics
   */
  socket.on('content-flag:stats', async (data: any) => {
    if (!socket.user?.isModerator) {
      socket.emit('error', { message: 'Moderator privileges required' })
      return
    }

    try {
      const dateFrom = data.dateFrom ? new Date(data.dateFrom) : undefined
      const dateTo = data.dateTo ? new Date(data.dateTo) : undefined

      const stats = await contentFlagsService.getContentFlagStats(dateFrom, dateTo)

      socket.emit('content-flag:stats:data', stats)
      logModerationEvent('content-flag:stats')(socket, data)
    } catch (error) {
      logger.error('Get content flag stats error:', error)
      socket.emit('error', { message: 'Failed to get content flag statistics' })
    }
  })

  /**
   * Subscribe to content flag updates
   */
  socket.on('content-flag:subscribe', (data: any) => {
    const { contentId } = data

    if (contentId) {
      socket.join(`content:${contentId}`)

      socket.emit('content-flag:subscribed', {
        contentId,
        timestamp: new Date().toISOString(),
      })

      logModerationEvent('content-flag:subscribe')(socket, data)
    }
  })

  /**
   * Unsubscribe from content flag updates
   */
  socket.on('content-flag:unsubscribe', (data: any) => {
    const { contentId } = data

    if (contentId) {
      socket.leave(`content:${contentId}`)

      socket.emit('content-flag:unsubscribed', {
        contentId,
        timestamp: new Date().toISOString(),
      })

      logModerationEvent('content-flag:unsubscribe')(socket, data)
    }
  })

  /**
   * Check if content should be flagged
   */
  socket.on('content-flag:should-flag', (data: any) => {
    const { confidence, threshold = 0.7 } = data

    if (confidence !== undefined) {
      const shouldFlag = contentFlagsService.shouldFlagContent(confidence, threshold)

      socket.emit('content-flag:should-flag:result', {
        confidence,
        threshold,
        shouldFlag,
        timestamp: new Date().toISOString(),
      })

      logModerationEvent('content-flag:should-flag')(socket, data)
    } else {
      socket.emit('error', { message: 'Confidence score is required' })
    }
  })

  /**
   * Create new content flag
   */
  socket.on('content-flag:create', async (data: any) => {
    try {
      const flag = await contentFlagsService.createContentFlag(data)

      // Broadcast new flag to content room and moderation updates
      socket.to(`content:${flag.contentId}`).emit('content-flag:created', flag)
      socket.to('moderation:updates').emit('content-flag:created', flag)

      socket.emit('content-flag:created', flag)
      logModerationEvent('content-flag:create')(socket, data)
    } catch (error) {
      logger.error('Create content flag error:', error)
      socket.emit('error', { message: 'Failed to create content flag' })
    }
  })

  /**
   * Join content room for updates
   */
  socket.on('content-flag:room:join', (data: any) => {
    const { contentId } = data

    if (contentId) {
      socket.join(`content:${contentId}`)
      logger.info(`👥 User joined content room: content:${contentId}`)
    }
  })

  /**
   * Leave content room
   */
  socket.on('content-flag:room:leave', (data: any) => {
    const { contentId } = data

    if (contentId) {
      socket.leave(`content:${contentId}`)
      logger.info(`👋 User left content room: content:${contentId}`)
    }
  })
}
