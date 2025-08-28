import { Socket } from 'socket.io'
import logger from '../../config/logger.js'
import { reportsService } from '../../services/reportsService.js'
import { requireModerator, logModerationEvent, joinReportRoom } from '../middleware/auth.js'

/**
 * Handle report-related WebSocket events
 */
export const registerReportHandlers = (socket: Socket) => {
  /**
   * Get report by ID
   */
  socket.on('report:get', async (data: any) => {
    try {
      const { reportId } = data

      if (!reportId) {
        socket.emit('error', { message: 'Report ID is required' })
        return
      }

      const report = await reportsService.getReportById(reportId)

      socket.emit('report:data', report)
      logModerationEvent('report:get')(socket, data)
    } catch (error) {
      logger.error('Get report error:', error)
      socket.emit('error', { message: 'Failed to get report' })
    }
  })

  /**
   * Get reports with filtering
   */
  socket.on('report:list', async (data: any) => {
    try {
      const filters = {
        status: data.status,
        reportType: data.reportType,
        priority: data.priority,
        assignedTo: data.assignedTo,
      }

      const pagination = {
        page: data.page || 1,
        limit: data.limit || 20,
      }

      const result = await reportsService.getReports(filters, pagination)

      socket.emit('report:list:data', result)
      logModerationEvent('report:list')(socket, data)
    } catch (error) {
      logger.error('Get reports error:', error)
      socket.emit('error', { message: 'Failed to get reports' })
    }
  })

  /**
   * Update report
   */
  socket.on('report:update', async (data: any) => {
    if (!socket.user?.isModerator) {
      socket.emit('error', { message: 'Moderator privileges required' })
      return
    }

    try {
      const { reportId, updateData } = data

      if (!reportId || !updateData) {
        socket.emit('error', { message: 'Report ID and update data are required' })
        return
      }

      const report = await reportsService.updateReport(reportId, updateData, socket.user.id)

      // Broadcast update to report room and moderation updates
      socket.to(`report:${reportId}`).emit('report:updated', report)
      socket.to('moderation:updates').emit('report:updated', report)

      socket.emit('report:updated', report)
      logModerationEvent('report:update')(socket, data)
    } catch (error) {
      logger.error('Update report error:', error)
      socket.emit('error', { message: 'Failed to update report' })
    }
  })

  /**
   * Assign report to moderator
   */
  socket.on('report:assign', async (data: any) => {
    if (!socket.user?.isModerator) {
      socket.emit('error', { message: 'Moderator privileges required' })
      return
    }

    try {
      const { reportId, moderatorId } = data

      if (!reportId || !moderatorId) {
        socket.emit('error', { message: 'Report ID and moderator ID are required' })
        return
      }

      const report = await reportsService.assignReport(reportId, moderatorId)

      // Broadcast assignment to report room and assigned moderator
      socket.to(`report:${reportId}`).emit('report:assigned', report)
      socket.to(`moderator:${moderatorId}`).emit('report:assigned', report)
      socket.to('moderation:updates').emit('report:assigned', report)

      socket.emit('report:assigned', report)
      logModerationEvent('report:assign')(socket, data)
    } catch (error) {
      logger.error('Assign report error:', error)
      socket.emit('error', { message: 'Failed to assign report' })
    }
  })

  /**
   * Resolve report
   */
  socket.on('report:resolve', async (data: any) => {
    if (!socket.user?.isModerator) {
      socket.emit('error', { message: 'Moderator privileges required' })
      return
    }

    try {
      const { reportId, resolution } = data

      if (!reportId || !resolution) {
        socket.emit('error', { message: 'Report ID and resolution are required' })
        return
      }

      const report = await reportsService.resolveReport(reportId, resolution, socket.user.id)

      // Broadcast resolution to report room and moderation updates
      socket.to(`report:${reportId}`).emit('report:resolved', report)
      socket.to('moderation:updates').emit('report:resolved', report)

      socket.emit('report:resolved', report)
      logModerationEvent('report:resolve')(socket, data)
    } catch (error) {
      logger.error('Resolve report error:', error)
      socket.emit('error', { message: 'Failed to resolve report' })
    }
  })

  /**
   * Delete report
   */
  socket.on('report:delete', async (data: any) => {
    if (!socket.user?.isModerator) {
      socket.emit('error', { message: 'Moderator privileges required' })
      return
    }

    try {
      const { reportId } = data

      if (!reportId) {
        socket.emit('error', { message: 'Report ID is required' })
        return
      }

      await reportsService.deleteReport(reportId)

      // Broadcast deletion to report room and moderation updates
      socket.to(`report:${reportId}`).emit('report:deleted', { reportId })
      socket.to('moderation:updates').emit('report:deleted', { reportId })

      socket.emit('report:deleted', { reportId })
      logModerationEvent('report:delete')(socket, data)
    } catch (error) {
      logger.error('Delete report error:', error)
      socket.emit('error', { message: 'Failed to delete report' })
    }
  })

  /**
   * Subscribe to report updates
   */
  socket.on('report:subscribe', (data: any) => {
    const { reportId } = data

    if (reportId) {
      joinReportRoom(socket, reportId)

      socket.emit('report:subscribed', {
        reportId,
        timestamp: new Date().toISOString(),
      })

      logModerationEvent('report:subscribe')(socket, data)
    }
  })

  /**
   * Unsubscribe from report updates
   */
  socket.on('report:unsubscribe', (data: any) => {
    const { reportId } = data

    if (reportId) {
      socket.leave(`report:${reportId}`)

      socket.emit('report:unsubscribed', {
        reportId,
        timestamp: new Date().toISOString(),
      })

      logModerationEvent('report:unsubscribe')(socket, data)
    }
  })

  /**
   * Get report statistics
   */
  socket.on('report:stats', async (data: any) => {
    if (!socket.user?.isModerator) {
      socket.emit('error', { message: 'Moderator privileges required' })
      return
    }

    try {
      const dateFrom = data.dateFrom ? new Date(data.dateFrom) : undefined
      const dateTo = data.dateTo ? new Date(data.dateTo) : undefined

      const stats = await reportsService.getReportStats(dateFrom, dateTo)

      socket.emit('report:stats:data', stats)
      logModerationEvent('report:stats')(socket, data)
    } catch (error) {
      logger.error('Get report stats error:', error)
      socket.emit('error', { message: 'Failed to get report statistics' })
    }
  })

  /**
   * Search reports
   */
  socket.on('report:search', async (data: any) => {
    try {
      const { query, filters, pagination } = data

      if (!query && !filters) {
        socket.emit('error', { message: 'Query or filters are required' })
        return
      }

      // This would implement search functionality
      // For now, we'll just get reports with filters
      const result = await reportsService.getReports(filters || {}, pagination || {})

      socket.emit('report:search:results', {
        query,
        filters,
        results: result,
        timestamp: new Date().toISOString(),
      })

      logModerationEvent('report:search')(socket, data)
    } catch (error) {
      logger.error('Search reports error:', error)
      socket.emit('error', { message: 'Failed to search reports' })
    }
  })

  /**
   * Bulk assign reports
   */
  socket.on('report:bulk:assign', async (data: any) => {
    if (!socket.user?.isModerator) {
      socket.emit('error', { message: 'Moderator privileges required' })
      return
    }

    try {
      const { reportIds, moderatorId } = data

      if (!reportIds || !Array.isArray(reportIds) || !moderatorId) {
        socket.emit('error', { message: 'Report IDs array and moderator ID are required' })
        return
      }

      // Assign each report
      const results = []
      for (const reportId of reportIds) {
        try {
          const report = await reportsService.assignReport(reportId, moderatorId)
          results.push({ reportId, success: true, report })

          // Broadcast assignment
          socket.to(`report:${reportId}`).emit('report:assigned', report)
          socket.to(`moderator:${moderatorId}`).emit('report:assigned', report)
        } catch (error) {
          results.push({ reportId, success: false, error: error.message })
        }
      }

      socket.to('moderation:updates').emit('report:bulk:assigned', {
        reportIds,
        moderatorId,
        results,
        timestamp: new Date().toISOString(),
      })

      socket.emit('report:bulk:assigned', {
        reportIds,
        moderatorId,
        results,
        timestamp: new Date().toISOString(),
      })

      logModerationEvent('report:bulk:assign')(socket, data)
    } catch (error) {
      logger.error('Bulk assign reports error:', error)
      socket.emit('error', { message: 'Failed to bulk assign reports' })
    }
  })
}
