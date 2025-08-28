import prisma from '../config/database.js'
import logger from '../config/logger.js'
import { ModerationAction, ContentType } from '@prisma/client'

export interface CreateQueueItemData {
  contentId: string
  contentType: ContentType
  priority?: number
  reason?: string
  flags?: string[] // Array of ContentFlag IDs
}

export interface UpdateQueueItemData {
  assignedTo?: string
  isProcessed?: boolean
  processedAt?: Date
  action?: ModerationAction
  notes?: string
}

export interface QueueFilters {
  contentType?: ContentType
  priority?: number
  assignedTo?: string
  isProcessed?: boolean
  dateFrom?: Date
  dateTo?: Date
}

export interface PaginationOptions {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export class ModerationQueueService {
  /**
   * Add item to moderation queue
   */
  async addToQueue(data: CreateQueueItemData) {
    try {
      // Check if item already exists in queue
      const existingItem = await prisma.moderationQueue.findUnique({
        where: {
          contentId: data.contentId,
        },
      })

      if (existingItem) {
        // Update existing item if new priority is higher
        if ((data.priority || 1) > existingItem.priority) {
          return await this.updateQueueItem(existingItem.id, {
            priority: data.priority,
            reason: data.reason,
            flags: data.flags,
          })
        }
        return existingItem
      }

      const queueItem = await prisma.moderationQueue.create({
        data: {
          contentId: data.contentId,
          contentType: data.contentType,
          priority: data.priority || this.calculatePriority(data.contentType, data.flags),
          reason: data.reason,
          flags: data.flags,
        },
        include: {
          assignedModerator: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
      })

      logger.info(`📋 Added to moderation queue: ${queueItem.id} for content ${data.contentId}`)
      return queueItem
    } catch (error) {
      logger.error('Add to moderation queue error:', error)
      throw new Error('Failed to add item to moderation queue')
    }
  }

  /**
   * Get queue item by ID
   */
  async getQueueItemById(id: string) {
    try {
      const item = await prisma.moderationQueue.findUnique({
        where: { id },
        include: {
          assignedModerator: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
      })

      if (!item) {
        throw new Error('Queue item not found')
      }

      return item
    } catch (error) {
      logger.error('Get queue item by ID error:', error)
      throw error
    }
  }

  /**
   * Get queue items with filtering and pagination
   */
  async getQueueItems(filters: QueueFilters = {}, pagination: PaginationOptions = {}) {
    try {
      const { page = 1, limit = 20, sortBy = 'priority', sortOrder = 'desc' } = pagination

      const where: any = {}

      if (filters.contentType) where.contentType = filters.contentType
      if (filters.priority) where.priority = filters.priority
      if (filters.assignedTo) where.assignedTo = filters.assignedTo
      if (filters.isProcessed !== undefined) where.isProcessed = filters.isProcessed

      if (filters.dateFrom || filters.dateTo) {
        where.createdAt = {}
        if (filters.dateFrom) where.createdAt.gte = filters.dateFrom
        if (filters.dateTo) where.createdAt.lte = filters.dateTo
      }

      const total = await prisma.moderationQueue.count({ where })
      const items = await prisma.moderationQueue.findMany({
        where,
        include: {
          assignedModerator: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
        orderBy: [
          { [sortBy]: sortOrder },
          { createdAt: 'asc' }, // Secondary sort by creation time
        ],
        skip: (page - 1) * limit,
        take: limit,
      })

      return {
        data: items,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      }
    } catch (error) {
      logger.error('Get queue items error:', error)
      throw new Error('Failed to get queue items')
    }
  }

  /**
   * Update queue item
   */
  async updateQueueItem(id: string, updateData: UpdateQueueItemData) {
    try {
      const data: any = { ...updateData }

      if (updateData.isProcessed) {
        data.processedAt = updateData.processedAt || new Date()
      }

      const item = await prisma.moderationQueue.update({
        where: { id },
        data,
        include: {
          assignedModerator: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
      })

      logger.info(`📋 Queue item updated: ${id}`)
      return item
    } catch (error) {
      logger.error('Update queue item error:', error)
      throw new Error('Failed to update queue item')
    }
  }

  /**
   * Assign queue item to moderator
   */
  async assignQueueItem(id: string, moderatorId: string) {
    try {
      const item = await prisma.moderationQueue.update({
        where: { id },
        data: {
          assignedTo: moderatorId,
        },
        include: {
          assignedModerator: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
      })

      logger.info(`👤 Queue item ${id} assigned to moderator ${moderatorId}`)
      return item
    } catch (error) {
      logger.error('Assign queue item error:', error)
      throw new Error('Failed to assign queue item')
    }
  }

  /**
   * Process queue item
   */
  async processQueueItem(
    id: string,
    action: ModerationAction,
    moderatorId: string,
    notes?: string,
  ) {
    try {
      const item = await prisma.moderationQueue.update({
        where: { id },
        data: {
          isProcessed: true,
          processedAt: new Date(),
          action,
          notes,
        },
        include: {
          assignedModerator: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
      })

      // Log the moderation action
      await prisma.moderationActionLog.create({
        data: {
          moderatorId,
          action,
          targetId: item.contentId,
          targetType: item.contentType.toLowerCase(),
          reason: notes,
          metadata: {
            queueItemId: id,
            originalPriority: item.priority,
            flags: item.flags,
          },
        },
      })

      logger.info(
        `✅ Queue item processed: ${id} with action ${action} by moderator ${moderatorId}`,
      )
      return item
    } catch (error) {
      logger.error('Process queue item error:', error)
      throw new Error('Failed to process queue item')
    }
  }

  /**
   * Delete queue item
   */
  async deleteQueueItem(id: string) {
    try {
      await prisma.moderationQueue.delete({
        where: { id },
      })

      logger.info(`🗑️ Queue item deleted: ${id}`)
      return true
    } catch (error) {
      logger.error('Delete queue item error:', error)
      throw new Error('Failed to delete queue item')
    }
  }

  /**
   * Get unassigned queue items
   */
  async getUnassignedItems(limit: number = 10) {
    try {
      const items = await prisma.moderationQueue.findMany({
        where: {
          assignedTo: null,
          isProcessed: false,
        },
        include: {
          assignedModerator: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
        take: limit,
      })

      return items
    } catch (error) {
      logger.error('Get unassigned items error:', error)
      throw new Error('Failed to get unassigned items')
    }
  }

  /**
   * Get assigned items for a moderator
   */
  async getAssignedItems(moderatorId: string, pagination: PaginationOptions = {}) {
    try {
      const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = pagination

      const where = {
        assignedTo: moderatorId,
        isProcessed: false,
      }

      const total = await prisma.moderationQueue.count({ where })
      const items = await prisma.moderationQueue.findMany({
        where,
        include: {
          assignedModerator: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
        orderBy: {
          [sortBy]: sortOrder,
        },
        skip: (page - 1) * limit,
        take: limit,
      })

      return {
        data: items,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      }
    } catch (error) {
      logger.error('Get assigned items error:', error)
      throw new Error('Failed to get assigned items')
    }
  }

  /**
   * Bulk assign items to moderator
   */
  async bulkAssignItems(itemIds: string[], moderatorId: string) {
    try {
      const result = await prisma.moderationQueue.updateMany({
        where: {
          id: { in: itemIds },
          assignedTo: null,
          isProcessed: false,
        },
        data: {
          assignedTo: moderatorId,
        },
      })

      logger.info(`👥 Bulk assigned ${result.count} queue items to moderator ${moderatorId}`)
      return result
    } catch (error) {
      logger.error('Bulk assign items error:', error)
      throw new Error('Failed to bulk assign items')
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(dateFrom?: Date, dateTo?: Date) {
    try {
      const where: any = {}

      if (dateFrom || dateTo) {
        where.createdAt = {}
        if (dateFrom) where.createdAt.gte = dateFrom
        if (dateTo) where.createdAt.lte = dateTo
      }

      const [
        totalItems,
        processedItems,
        unprocessedItems,
        assignedItems,
        unassignedItems,
        itemsByType,
        itemsByPriority,
      ] = await Promise.all([
        prisma.moderationQueue.count({ where }),
        prisma.moderationQueue.count({ where: { ...where, isProcessed: true } }),
        prisma.moderationQueue.count({ where: { ...where, isProcessed: false } }),
        prisma.moderationQueue.count({ where: { ...where, assignedTo: { not: null } } }),
        prisma.moderationQueue.count({ where: { ...where, assignedTo: null } }),
        prisma.moderationQueue.groupBy({
          by: ['contentType'],
          where,
          _count: true,
        }),
        prisma.moderationQueue.groupBy({
          by: ['priority'],
          where,
          _count: true,
        }),
      ])

      return {
        total: totalItems,
        processed: processedItems,
        unprocessed: unprocessedItems,
        assigned: assignedItems,
        unassigned: unassignedItems,
        byType: itemsByType.reduce(
          (acc, item) => {
            acc[item.contentType] = item._count
            return acc
          },
          {} as Record<string, number>,
        ),
        byPriority: itemsByPriority.reduce(
          (acc, item) => {
            acc[item.priority] = item._count
            return acc
          },
          {} as Record<number, number>,
        ),
      }
    } catch (error) {
      logger.error('Get queue stats error:', error)
      throw new Error('Failed to get queue statistics')
    }
  }

  /**
   * Calculate priority based on content type and flags
   */
  private calculatePriority(contentType: ContentType, flags?: string[]): number {
    let priority = 1

    // Base priority by content type
    const typePriority = {
      [ContentType.POST]: 2,
      [ContentType.COMMENT]: 1,
      [ContentType.USER_PROFILE]: 3,
      [ContentType.MEDIA]: 2,
      [ContentType.MESSAGE]: 1,
    }

    priority = typePriority[contentType] || 1

    // Increase priority based on number of flags
    if (flags && flags.length > 0) {
      priority += Math.min(flags.length, 2) // Max +2 for multiple flags
    }

    return Math.min(priority, 4) // Cap at 4
  }

  /**
   * Clean up old processed items
   */
  async cleanupOldItems(daysOld: number = 30) {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysOld)

      const result = await prisma.moderationQueue.deleteMany({
        where: {
          isProcessed: true,
          processedAt: {
            lt: cutoffDate,
          },
        },
      })

      logger.info(`🧹 Cleaned up ${result.count} old processed queue items`)
      return result
    } catch (error) {
      logger.error('Cleanup old items error:', error)
      throw new Error('Failed to cleanup old items')
    }
  }
}

export const moderationQueueService = new ModerationQueueService()
