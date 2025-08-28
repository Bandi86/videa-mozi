import { Socket } from 'socket.io'
import logger from '../../config/logger.js'
import { appealsService } from '../../services/appealsService.js'
import { requireModerator, logModerationEvent, joinAppealRoom } from '../middleware/auth.js'

/**
 * Handle appeal-related WebSocket events
 */
export const registerAppealHandlers = (socket: Socket) => {
  /**
   * Get appeal by ID
   */
  socket.on('appeal:get', async (data: any) => {
    try {
      const { appealId } = data

      if (!appealId) {
        socket.emit('error', { message: 'Appeal ID is required' })
        return
      }

      const appeal = await appealsService.getAppealById(appealId)

      socket.emit('appeal:data', appeal)
      logModerationEvent('appeal:get')(socket, data)
    } catch (error) {
      logger.error('Get appeal error:', error)
      socket.emit('error', { message: 'Failed to get appeal' })
    }
  })

  /**
   * Get appeals with filtering
   */
  socket.on('appeal:list', async (data: any) => {
    try {
      const filters = {
        appellantId: data.appellantId,
        status: data.status,
        reviewedBy: data.reviewedBy,
      }

      const pagination = {
        page: data.page || 1,
        limit: data.limit || 20,
      }

      const result = await appealsService.getAppeals(filters, pagination)

      socket.emit('appeal:list:data', result)
      logModerationEvent('appeal:list')(socket, data)
    } catch (error) {
      logger.error('Get appeals error:', error)
      socket.emit('error', { message: 'Failed to get appeals' })
    }
  })

  /**
   * Update appeal
   */
  socket.on('appeal:update', async (data: any) => {
    if (!socket.user?.isModerator) {
      socket.emit('error', { message: 'Moderator privileges required' })
      return
    }

    try {
      const { appealId, updateData } = data

      if (!appealId || !updateData) {
        socket.emit('error', { message: 'Appeal ID and update data are required' })
        return
      }

      const appeal = await appealsService.updateAppeal(appealId, updateData)

      // Broadcast update to appeal room and moderation updates
      socket.to(`appeal:${appealId}`).emit('appeal:updated', appeal)
      socket.to('moderation:updates').emit('appeal:updated', appeal)

      socket.emit('appeal:updated', appeal)
      logModerationEvent('appeal:update')(socket, data)
    } catch (error) {
      logger.error('Update appeal error:', error)
      socket.emit('error', { message: 'Failed to update appeal' })
    }
  })

  /**
   * Approve appeal
   */
  socket.on('appeal:approve', async (data: any) => {
    if (!socket.user?.isModerator) {
      socket.emit('error', { message: 'Moderator privileges required' })
      return
    }

    try {
      const { appealId, reviewNotes } = data

      if (!appealId) {
        socket.emit('error', { message: 'Appeal ID is required' })
        return
      }

      const appeal = await appealsService.approveAppeal(appealId, socket.user.id, reviewNotes)

      // Broadcast approval to appeal room and moderation updates
      socket.to(`appeal:${appealId}`).emit('appeal:approved', appeal)
      socket.to('moderation:updates').emit('appeal:approved', appeal)

      socket.emit('appeal:approved', appeal)
      logModerationEvent('appeal:approve')(socket, data)
    } catch (error) {
      logger.error('Approve appeal error:', error)
      socket.emit('error', { message: 'Failed to approve appeal' })
    }
  })

  /**
   * Reject appeal
   */
  socket.on('appeal:reject', async (data: any) => {
    if (!socket.user?.isModerator) {
      socket.emit('error', { message: 'Moderator privileges required' })
      return
    }

    try {
      const { appealId, reviewNotes } = data

      if (!appealId) {
        socket.emit('error', { message: 'Appeal ID is required' })
        return
      }

      const appeal = await appealsService.rejectAppeal(appealId, socket.user.id, reviewNotes)

      // Broadcast rejection to appeal room and moderation updates
      socket.to(`appeal:${appealId}`).emit('appeal:rejected', appeal)
      socket.to('moderation:updates').emit('appeal:rejected', appeal)

      socket.emit('appeal:rejected', appeal)
      logModerationEvent('appeal:reject')(socket, data)
    } catch (error) {
      logger.error('Reject appeal error:', error)
      socket.emit('error', { message: 'Failed to reject appeal' })
    }
  })

  /**
   * Delete appeal
   */
  socket.on('appeal:delete', async (data: any) => {
    if (!socket.user?.isModerator) {
      socket.emit('error', { message: 'Moderator privileges required' })
      return
    }

    try {
      const { appealId } = data

      if (!appealId) {
        socket.emit('error', { message: 'Appeal ID is required' })
        return
      }

      await appealsService.deleteAppeal(appealId)

      // Broadcast deletion to appeal room and moderation updates
      socket.to(`appeal:${appealId}`).emit('appeal:deleted', { appealId })
      socket.to('moderation:updates').emit('appeal:deleted', { appealId })

      socket.emit('appeal:deleted', { appealId })
      logModerationEvent('appeal:delete')(socket, data)
    } catch (error) {
      logger.error('Delete appeal error:', error)
      socket.emit('error', { message: 'Failed to delete appeal' })
    }
  })

  /**
   * Subscribe to appeal updates
   */
  socket.on('appeal:subscribe', (data: any) => {
    const { appealId } = data

    if (appealId) {
      joinAppealRoom(socket, appealId)

      socket.emit('appeal:subscribed', {
        appealId,
        timestamp: new Date().toISOString(),
      })

      logModerationEvent('appeal:subscribe')(socket, data)
    }
  })

  /**
   * Unsubscribe from appeal updates
   */
  socket.on('appeal:unsubscribe', (data: any) => {
    const { appealId } = data

    if (appealId) {
      socket.leave(`appeal:${appealId}`)

      socket.emit('appeal:unsubscribed', {
        appealId,
        timestamp: new Date().toISOString(),
      })

      logModerationEvent('appeal:unsubscribe')(socket, data)
    }
  })

  /**
   * Get pending appeals
   */
  socket.on('appeal:pending', async (data: any) => {
    if (!socket.user?.isModerator) {
      socket.emit('error', { message: 'Moderator privileges required' })
      return
    }

    try {
      const pagination = {
        page: data.page || 1,
        limit: data.limit || 20,
      }

      const result = await appealsService.getPendingAppeals(pagination)

      socket.emit('appeal:pending:data', result)
      logModerationEvent('appeal:pending')(socket, data)
    } catch (error) {
      logger.error('Get pending appeals error:', error)
      socket.emit('error', { message: 'Failed to get pending appeals' })
    }
  })

  /**
   * Get appeal statistics
   */
  socket.on('appeal:stats', async (data: any) => {
    if (!socket.user?.isModerator) {
      socket.emit('error', { message: 'Moderator privileges required' })
      return
    }

    try {
      const dateFrom = data.dateFrom ? new Date(data.dateFrom) : undefined
      const dateTo = data.dateTo ? new Date(data.dateTo) : undefined

      const stats = await appealsService.getAppealStats(dateFrom, dateTo)

      socket.emit('appeal:stats:data', stats)
      logModerationEvent('appeal:stats')(socket, data)
    } catch (error) {
      logger.error('Get appeal stats error:', error)
      socket.emit('error', { message: 'Failed to get appeal statistics' })
    }
  })

  /**
   * Get appeal timeline
   */
  socket.on('appeal:timeline', async (data: any) => {
    try {
      const { reportId } = data

      if (!reportId) {
        socket.emit('error', { message: 'Report ID is required' })
        return
      }

      const timeline = await appealsService.getAppealTimeline(reportId)

      socket.emit('appeal:timeline:data', timeline)
      logModerationEvent('appeal:timeline')(socket, data)
    } catch (error) {
      logger.error('Get appeal timeline error:', error)
      socket.emit('error', { message: 'Failed to get appeal timeline' })
    }
  })

  /**
   * Check if user can appeal
   */
  socket.on('appeal:can-appeal', async (data: any) => {
    try {
      const { reportId, userId } = data

      if (!reportId || !userId) {
        socket.emit('error', { message: 'Report ID and user ID are required' })
        return
      }

      const canAppeal = await appealsService.canUserAppeal(reportId, userId)

      socket.emit('appeal:can-appeal:result', {
        reportId,
        userId,
        canAppeal,
        timestamp: new Date().toISOString(),
      })

      logModerationEvent('appeal:can-appeal')(socket, data)
    } catch (error) {
      logger.error('Check appeal eligibility error:', error)
      socket.emit('error', { message: 'Failed to check appeal eligibility' })
    }
  })

  /**
   * Get appeals by appellant
   */
  socket.on('appeal:user:list', async (data: any) => {
    try {
      const { appellantId, page = 1, limit = 20 } = data

      if (!appellantId) {
        socket.emit('error', { message: 'Appellant ID is required' })
        return
      }

      const result = await appealsService.getAppealsByAppellant(appellantId, { page, limit })

      socket.emit('appeal:user:list:data', result)
      logModerationEvent('appeal:user:list')(socket, data)
    } catch (error) {
      logger.error('Get appeals by appellant error:', error)
      socket.emit('error', { message: 'Failed to get user appeals' })
    }
  })

  /**
   * Get appeals reviewed by moderator
   */
  socket.on('appeal:moderator:list', async (data: any) => {
    if (!socket.user?.isModerator) {
      socket.emit('error', { message: 'Moderator privileges required' })
      return
    }

    try {
      const { page = 1, limit = 20 } = data

      const result = await appealsService.getAppealsByReviewer(socket.user.id, { page, limit })

      socket.emit('appeal:moderator:list:data', result)
      logModerationEvent('appeal:moderator:list')(socket, data)
    } catch (error) {
      logger.error('Get appeals by moderator error:', error)
      socket.emit('error', { message: 'Failed to get moderator appeals' })
    }
  })

  /**
   * Bulk update appeals
   */
  socket.on('appeal:bulk:update', async (data: any) => {
    if (!socket.user?.isModerator) {
      socket.emit('error', { message: 'Moderator privileges required' })
      return
    }

    try {
      const { appealIds, updateData } = data

      if (!appealIds || !Array.isArray(appealIds) || !updateData) {
        socket.emit('error', { message: 'Appeal IDs array and update data are required' })
        return
      }

      const results = []
      for (const appealId of appealIds) {
        try {
          const appeal = await appealsService.updateAppeal(appealId, updateData)
          results.push({ appealId, success: true, appeal })

          // Broadcast update
          socket.to(`appeal:${appealId}`).emit('appeal:updated', appeal)
        } catch (error) {
          results.push({ appealId, success: false, error: error.message })
        }
      }

      socket.to('moderation:updates').emit('appeal:bulk:updated', {
        appealIds,
        updateData,
        results,
        timestamp: new Date().toISOString(),
      })

      socket.emit('appeal:bulk:updated', {
        appealIds,
        updateData,
        results,
        timestamp: new Date().toISOString(),
      })

      logModerationEvent('appeal:bulk:update')(socket, data)
    } catch (error) {
      logger.error('Bulk update appeals error:', error)
      socket.emit('error', { message: 'Failed to bulk update appeals' })
    }
  })
}
