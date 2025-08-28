import { reportsService } from '../../services/reportsService.js'
import { contentFlagsService } from '../../services/contentFlagsService.js'
import { moderationQueueService } from '../../services/moderationQueueService.js'
import { appealsService } from '../../services/appealsService.js'
import logger from '../../config/logger.js'

export const moderationResolvers = {
  Query: {
    // Report queries
    report: async (_: any, { id }: { id: string }) => {
      try {
        return await reportsService.getReportById(id)
      } catch (error) {
        logger.error('GraphQL report query error:', error)
        throw error
      }
    },

    reports: async (_: any, args: any) => {
      try {
        const filters = {
          status: args.status,
          reportType: args.reportType,
          priority: args.priority,
          assignedTo: args.assignedTo,
          reporterId: args.reporterId,
          reportedUserId: args.reportedUserId,
          contentId: args.contentId,
          contentType: args.contentType,
        }
        const pagination = {
          page: args.page,
          limit: args.limit,
        }
        return await reportsService.getReports(filters, pagination)
      } catch (error) {
        logger.error('GraphQL reports query error:', error)
        throw error
      }
    },

    // Content flag queries
    contentFlag: async (_: any, { id }: { id: string }) => {
      try {
        return await contentFlagsService.getContentFlagById(id)
      } catch (error) {
        logger.error('GraphQL contentFlag query error:', error)
        throw error
      }
    },

    contentFlags: async (_: any, args: any) => {
      try {
        const filters = {
          contentId: args.contentId,
          contentType: args.contentType,
          flagType: args.flagType,
          isResolved: args.isResolved,
          confidence:
            args.confidenceMin || args.confidenceMax
              ? {
                  min: args.confidenceMin,
                  max: args.confidenceMax,
                }
              : undefined,
        }
        const pagination = {
          page: args.page,
          limit: args.limit,
        }
        return await contentFlagsService.getContentFlags(filters, pagination)
      } catch (error) {
        logger.error('GraphQL contentFlags query error:', error)
        throw error
      }
    },

    contentFlagsByContent: async (_: any, { contentId }: { contentId: string }) => {
      try {
        return await contentFlagsService.getContentFlagsByContentId(contentId)
      } catch (error) {
        logger.error('GraphQL contentFlagsByContent query error:', error)
        throw error
      }
    },

    // Moderation queue queries
    moderationQueueItem: async (_: any, { id }: { id: string }) => {
      try {
        return await moderationQueueService.getQueueItemById(id)
      } catch (error) {
        logger.error('GraphQL moderationQueueItem query error:', error)
        throw error
      }
    },

    moderationQueueItems: async (_: any, args: any) => {
      try {
        const filters = {
          contentType: args.contentType,
          priority: args.priority,
          assignedTo: args.assignedTo,
          isProcessed: args.isProcessed,
        }
        const pagination = {
          page: args.page,
          limit: args.limit,
        }
        return await moderationQueueService.getQueueItems(filters, pagination)
      } catch (error) {
        logger.error('GraphQL moderationQueueItems query error:', error)
        throw error
      }
    },

    unassignedQueueItems: async (_: any, { limit }: { limit: number }) => {
      try {
        return await moderationQueueService.getUnassignedItems(limit)
      } catch (error) {
        logger.error('GraphQL unassignedQueueItems query error:', error)
        throw error
      }
    },

    // Appeal queries
    appeal: async (_: any, { id }: { id: string }) => {
      try {
        return await appealsService.getAppealById(id)
      } catch (error) {
        logger.error('GraphQL appeal query error:', error)
        throw error
      }
    },

    appeals: async (_: any, args: any) => {
      try {
        const filters = {
          appellantId: args.appellantId,
          status: args.status,
          reviewedBy: args.reviewedBy,
        }
        const pagination = {
          page: args.page,
          limit: args.limit,
        }
        return await appealsService.getAppeals(filters, pagination)
      } catch (error) {
        logger.error('GraphQL appeals query error:', error)
        throw error
      }
    },

    pendingAppeals: async (_: any, args: any) => {
      try {
        const pagination = {
          page: args.page,
          limit: args.limit,
        }
        return await appealsService.getPendingAppeals(pagination)
      } catch (error) {
        logger.error('GraphQL pendingAppeals query error:', error)
        throw error
      }
    },

    appealTimeline: async (_: any, { reportId }: { reportId: string }) => {
      try {
        return await appealsService.getAppealTimeline(reportId)
      } catch (error) {
        logger.error('GraphQL appealTimeline query error:', error)
        throw error
      }
    },

    // Statistics queries
    reportStats: async (_: any, args: any) => {
      try {
        const dateFrom = args.dateFrom ? new Date(args.dateFrom) : undefined
        const dateTo = args.dateTo ? new Date(args.dateTo) : undefined
        return await reportsService.getReportStats(dateFrom, dateTo)
      } catch (error) {
        logger.error('GraphQL reportStats query error:', error)
        throw error
      }
    },

    contentFlagStats: async (_: any, args: any) => {
      try {
        const dateFrom = args.dateFrom ? new Date(args.dateFrom) : undefined
        const dateTo = args.dateTo ? new Date(args.dateTo) : undefined
        return await contentFlagsService.getContentFlagStats(dateFrom, dateTo)
      } catch (error) {
        logger.error('GraphQL contentFlagStats query error:', error)
        throw error
      }
    },

    moderationQueueStats: async (_: any, args: any) => {
      try {
        const dateFrom = args.dateFrom ? new Date(args.dateFrom) : undefined
        const dateTo = args.dateTo ? new Date(args.dateTo) : undefined
        return await moderationQueueService.getQueueStats(dateFrom, dateTo)
      } catch (error) {
        logger.error('GraphQL moderationQueueStats query error:', error)
        throw error
      }
    },

    appealStats: async (_: any, args: any) => {
      try {
        const dateFrom = args.dateFrom ? new Date(args.dateFrom) : undefined
        const dateTo = args.dateTo ? new Date(args.dateTo) : undefined
        return await appealsService.getAppealStats(dateFrom, dateTo)
      } catch (error) {
        logger.error('GraphQL appealStats query error:', error)
        throw error
      }
    },

    // Dashboard query
    moderationDashboard: async (_: any, args: any) => {
      try {
        const dateFrom = args.dateFrom ? new Date(args.dateFrom) : undefined
        const dateTo = args.dateTo ? new Date(args.dateTo) : undefined

        const [queueStats, reportStats, flagStats, appealStats] = await Promise.all([
          moderationQueueService.getQueueStats(dateFrom, dateTo),
          reportsService.getReportStats(dateFrom, dateTo),
          contentFlagsService.getContentFlagStats(dateFrom, dateTo),
          appealsService.getAppealStats(dateFrom, dateTo),
        ])

        return {
          queue: queueStats,
          reports: reportStats,
          contentFlags: flagStats,
          appeals: appealStats,
          timestamp: new Date().toISOString(),
        }
      } catch (error) {
        logger.error('GraphQL moderationDashboard query error:', error)
        throw error
      }
    },
  },

  Mutation: {
    // Report mutations
    createReport: async (_: any, { input }: { input: any }) => {
      try {
        return await reportsService.createReport(input)
      } catch (error) {
        logger.error('GraphQL createReport mutation error:', error)
        throw error
      }
    },

    updateReport: async (_: any, { id, input }: { id: string; input: any }) => {
      try {
        return await reportsService.updateReport(id, input)
      } catch (error) {
        logger.error('GraphQL updateReport mutation error:', error)
        throw error
      }
    },

    assignReport: async (_: any, { id, moderatorId }: { id: string; moderatorId: string }) => {
      try {
        return await reportsService.assignReport(id, moderatorId)
      } catch (error) {
        logger.error('GraphQL assignReport mutation error:', error)
        throw error
      }
    },

    resolveReport: async (_: any, { id, resolution }: { id: string; resolution: string }) => {
      try {
        return await reportsService.resolveReport(id, resolution, 'system')
      } catch (error) {
        logger.error('GraphQL resolveReport mutation error:', error)
        throw error
      }
    },

    deleteReport: async (_: any, { id }: { id: string }) => {
      try {
        return await reportsService.deleteReport(id)
      } catch (error) {
        logger.error('GraphQL deleteReport mutation error:', error)
        throw error
      }
    },

    // Content flag mutations
    createContentFlag: async (_: any, { input }: { input: any }) => {
      try {
        return await contentFlagsService.createContentFlag(input)
      } catch (error) {
        logger.error('GraphQL createContentFlag mutation error:', error)
        throw error
      }
    },

    updateContentFlag: async (_: any, { id, input }: { id: string; input: any }) => {
      try {
        return await contentFlagsService.updateContentFlag(id, input)
      } catch (error) {
        logger.error('GraphQL updateContentFlag mutation error:', error)
        throw error
      }
    },

    resolveContentFlag: async (_: any, { id, resolvedBy }: { id: string; resolvedBy: string }) => {
      try {
        return await contentFlagsService.resolveContentFlag(id, resolvedBy)
      } catch (error) {
        logger.error('GraphQL resolveContentFlag mutation error:', error)
        throw error
      }
    },

    deleteContentFlag: async (_: any, { id }: { id: string }) => {
      try {
        return await contentFlagsService.deleteContentFlag(id)
      } catch (error) {
        logger.error('GraphQL deleteContentFlag mutation error:', error)
        throw error
      }
    },

    bulkResolveContentFlags: async (
      _: any,
      { flagIds, resolvedBy }: { flagIds: string[]; resolvedBy: string },
    ) => {
      try {
        const result = await contentFlagsService.bulkResolveFlags(flagIds, resolvedBy)
        return { count: result.count }
      } catch (error) {
        logger.error('GraphQL bulkResolveContentFlags mutation error:', error)
        throw error
      }
    },

    // Moderation queue mutations
    addToModerationQueue: async (_: any, { input }: { input: any }) => {
      try {
        return await moderationQueueService.addToQueue(input)
      } catch (error) {
        logger.error('GraphQL addToModerationQueue mutation error:', error)
        throw error
      }
    },

    updateQueueItem: async (_: any, { id, input }: { id: string; input: any }) => {
      try {
        return await moderationQueueService.updateQueueItem(id, input)
      } catch (error) {
        logger.error('GraphQL updateQueueItem mutation error:', error)
        throw error
      }
    },

    assignQueueItem: async (_: any, { id, moderatorId }: { id: string; moderatorId: string }) => {
      try {
        return await moderationQueueService.assignQueueItem(id, moderatorId)
      } catch (error) {
        logger.error('GraphQL assignQueueItem mutation error:', error)
        throw error
      }
    },

    processQueueItem: async (
      _: any,
      { id, action, notes }: { id: string; action: string; notes?: string },
    ) => {
      try {
        return await moderationQueueService.processQueueItem(id, action as any, 'system', notes)
      } catch (error) {
        logger.error('GraphQL processQueueItem mutation error:', error)
        throw error
      }
    },

    deleteQueueItem: async (_: any, { id }: { id: string }) => {
      try {
        return await moderationQueueService.deleteQueueItem(id)
      } catch (error) {
        logger.error('GraphQL deleteQueueItem mutation error:', error)
        throw error
      }
    },

    bulkAssignQueueItems: async (
      _: any,
      { itemIds, moderatorId }: { itemIds: string[]; moderatorId: string },
    ) => {
      try {
        const result = await moderationQueueService.bulkAssignItems(itemIds, moderatorId)
        return { count: result.count }
      } catch (error) {
        logger.error('GraphQL bulkAssignQueueItems mutation error:', error)
        throw error
      }
    },

    // Appeal mutations
    createAppeal: async (_: any, { input }: { input: any }) => {
      try {
        return await appealsService.createAppeal(input)
      } catch (error) {
        logger.error('GraphQL createAppeal mutation error:', error)
        throw error
      }
    },

    updateAppeal: async (_: any, { id, input }: { id: string; input: any }) => {
      try {
        return await appealsService.updateAppeal(id, input)
      } catch (error) {
        logger.error('GraphQL updateAppeal mutation error:', error)
        throw error
      }
    },

    approveAppeal: async (
      _: any,
      { id, reviewerId, reviewNotes }: { id: string; reviewerId: string; reviewNotes?: string },
    ) => {
      try {
        return await appealsService.approveAppeal(id, reviewerId, reviewNotes)
      } catch (error) {
        logger.error('GraphQL approveAppeal mutation error:', error)
        throw error
      }
    },

    rejectAppeal: async (
      _: any,
      { id, reviewerId, reviewNotes }: { id: string; reviewerId: string; reviewNotes?: string },
    ) => {
      try {
        return await appealsService.rejectAppeal(id, reviewerId, reviewNotes)
      } catch (error) {
        logger.error('GraphQL rejectAppeal mutation error:', error)
        throw error
      }
    },

    deleteAppeal: async (_: any, { id }: { id: string }) => {
      try {
        return await appealsService.deleteAppeal(id)
      } catch (error) {
        logger.error('GraphQL deleteAppeal mutation error:', error)
        throw error
      }
    },

    canUserAppeal: async (_: any, { reportId, userId }: { reportId: string; userId: string }) => {
      try {
        return await appealsService.canUserAppeal(reportId, userId)
      } catch (error) {
        logger.error('GraphQL canUserAppeal query error:', error)
        throw error
      }
    },
  },

  // Field resolvers for relations
  Report: {
    reporter: async (parent: any) => {
      // This would typically fetch from a user service
      return parent.reporter
    },
    reportedUser: async (parent: any) => {
      return parent.reportedUser
    },
    assignedModerator: async (parent: any) => {
      return parent.assignedModerator
    },
    reviewer: async (parent: any) => {
      return parent.reviewer
    },
  },

  ContentFlag: {
    resolver: async (parent: any) => {
      return parent.resolver
    },
  },

  ModerationQueueItem: {
    assignedModerator: async (parent: any) => {
      return parent.assignedModerator
    },
  },

  Appeal: {
    report: async (parent: any) => {
      return parent.report
    },
    appellant: async (parent: any) => {
      return parent.appellant
    },
    reviewer: async (parent: any) => {
      return parent.reviewer
    },
  },
}
