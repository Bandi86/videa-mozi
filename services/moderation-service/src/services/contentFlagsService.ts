import prisma from '../config/database.js'
import logger from '../config/logger.js'
import { ContentFlagType, ContentType } from '@prisma/client'

export interface CreateContentFlagData {
  contentId: string
  contentType: ContentType
  flagType: ContentFlagType
  confidence: number
  flaggedBy?: string
  reason?: string
  metadata?: any
}

export interface UpdateContentFlagData {
  isResolved?: boolean
  resolvedAt?: Date
  resolvedBy?: string
}

export interface ContentFlagFilters {
  contentId?: string
  contentType?: ContentType
  flagType?: ContentFlagType
  confidence?: {
    min?: number
    max?: number
  }
  isResolved?: boolean
  flaggedBy?: string
  dateFrom?: Date
  dateTo?: Date
}

export interface PaginationOptions {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export class ContentFlagsService {
  /**
   * Create a new content flag
   */
  async createContentFlag(data: CreateContentFlagData) {
    try {
      // Check if flag already exists for this content and type
      const existingFlag = await prisma.contentFlag.findUnique({
        where: {
          contentId_flagType: {
            contentId: data.contentId,
            flagType: data.flagType,
          },
        },
      })

      if (existingFlag) {
        // Update existing flag if new confidence is higher
        if (data.confidence > existingFlag.confidence) {
          return await this.updateContentFlag(existingFlag.id, {
            ...data,
            isResolved: false,
            resolvedAt: undefined,
            resolvedBy: undefined,
          })
        }
        return existingFlag
      }

      const flag = await prisma.contentFlag.create({
        data: {
          contentId: data.contentId,
          contentType: data.contentType,
          flagType: data.flagType,
          confidence: data.confidence,
          flaggedBy: data.flaggedBy,
          reason: data.reason,
          metadata: data.metadata,
        },
        include: {
          resolver: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
      })

      logger.info(`🚩 Content flag created: ${flag.id} for content ${data.contentId}`)
      return flag
    } catch (error) {
      logger.error('Create content flag error:', error)
      throw new Error('Failed to create content flag')
    }
  }

  /**
   * Get content flag by ID
   */
  async getContentFlagById(id: string) {
    try {
      const flag = await prisma.contentFlag.findUnique({
        where: { id },
        include: {
          resolver: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
      })

      if (!flag) {
        throw new Error('Content flag not found')
      }

      return flag
    } catch (error) {
      logger.error('Get content flag by ID error:', error)
      throw error
    }
  }

  /**
   * Get content flags with filtering and pagination
   */
  async getContentFlags(filters: ContentFlagFilters = {}, pagination: PaginationOptions = {}) {
    try {
      const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = pagination

      const where: any = {}

      if (filters.contentId) where.contentId = filters.contentId
      if (filters.contentType) where.contentType = filters.contentType
      if (filters.flagType) where.flagType = filters.flagType
      if (filters.isResolved !== undefined) where.isResolved = filters.isResolved
      if (filters.flaggedBy) where.flaggedBy = filters.flaggedBy

      if (filters.confidence) {
        where.confidence = {}
        if (filters.confidence.min !== undefined) where.confidence.gte = filters.confidence.min
        if (filters.confidence.max !== undefined) where.confidence.lte = filters.confidence.max
      }

      if (filters.dateFrom || filters.dateTo) {
        where.createdAt = {}
        if (filters.dateFrom) where.createdAt.gte = filters.dateFrom
        if (filters.dateTo) where.createdAt.lte = filters.dateTo
      }

      const total = await prisma.contentFlag.count({ where })
      const flags = await prisma.contentFlag.findMany({
        where,
        include: {
          resolver: {
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
        data: flags,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      }
    } catch (error) {
      logger.error('Get content flags error:', error)
      throw new Error('Failed to get content flags')
    }
  }

  /**
   * Update content flag
   */
  async updateContentFlag(
    id: string,
    updateData: UpdateContentFlagData & Partial<CreateContentFlagData>,
  ) {
    try {
      const data: any = {}

      if (updateData.isResolved !== undefined) {
        data.isResolved = updateData.isResolved
        if (updateData.isResolved) {
          data.resolvedAt = updateData.resolvedAt || new Date()
          data.resolvedBy = updateData.resolvedBy
        } else {
          data.resolvedAt = null
          data.resolvedBy = null
        }
      }

      if (updateData.confidence !== undefined) data.confidence = updateData.confidence
      if (updateData.reason !== undefined) data.reason = updateData.reason
      if (updateData.metadata !== undefined) data.metadata = updateData.metadata

      const flag = await prisma.contentFlag.update({
        where: { id },
        data,
        include: {
          resolver: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
      })

      logger.info(`🚩 Content flag updated: ${id}`)
      return flag
    } catch (error) {
      logger.error('Update content flag error:', error)
      throw new Error('Failed to update content flag')
    }
  }

  /**
   * Resolve content flag
   */
  async resolveContentFlag(id: string, resolvedBy: string) {
    try {
      const flag = await prisma.contentFlag.update({
        where: { id },
        data: {
          isResolved: true,
          resolvedAt: new Date(),
          resolvedBy,
        },
        include: {
          resolver: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
      })

      logger.info(`✅ Content flag resolved: ${id} by user ${resolvedBy}`)
      return flag
    } catch (error) {
      logger.error('Resolve content flag error:', error)
      throw new Error('Failed to resolve content flag')
    }
  }

  /**
   * Delete content flag
   */
  async deleteContentFlag(id: string) {
    try {
      await prisma.contentFlag.delete({
        where: { id },
      })

      logger.info(`🗑️ Content flag deleted: ${id}`)
      return true
    } catch (error) {
      logger.error('Delete content flag error:', error)
      throw new Error('Failed to delete content flag')
    }
  }

  /**
   * Get flags for specific content
   */
  async getContentFlagsByContentId(contentId: string) {
    try {
      const flags = await prisma.contentFlag.findMany({
        where: {
          contentId,
          isResolved: false,
        },
        include: {
          resolver: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
        orderBy: {
          confidence: 'desc',
        },
      })

      return flags
    } catch (error) {
      logger.error('Get content flags by content ID error:', error)
      throw new Error('Failed to get content flags')
    }
  }

  /**
   * Bulk resolve flags
   */
  async bulkResolveFlags(flagIds: string[], resolvedBy: string) {
    try {
      const result = await prisma.contentFlag.updateMany({
        where: {
          id: { in: flagIds },
          isResolved: false,
        },
        data: {
          isResolved: true,
          resolvedAt: new Date(),
          resolvedBy,
        },
      })

      logger.info(`✅ Bulk resolved ${result.count} content flags by user ${resolvedBy}`)
      return result
    } catch (error) {
      logger.error('Bulk resolve flags error:', error)
      throw new Error('Failed to bulk resolve flags')
    }
  }

  /**
   * Get content flag statistics
   */
  async getContentFlagStats(dateFrom?: Date, dateTo?: Date) {
    try {
      const where: any = {}

      if (dateFrom || dateTo) {
        where.createdAt = {}
        if (dateFrom) where.createdAt.gte = dateFrom
        if (dateTo) where.createdAt.lte = dateTo
      }

      const [
        totalFlags,
        resolvedFlags,
        unresolvedFlags,
        flagsByType,
        flagsByContentType,
        averageConfidence,
      ] = await Promise.all([
        prisma.contentFlag.count({ where }),
        prisma.contentFlag.count({ where: { ...where, isResolved: true } }),
        prisma.contentFlag.count({ where: { ...where, isResolved: false } }),
        prisma.contentFlag.groupBy({
          by: ['flagType'],
          where,
          _count: true,
        }),
        prisma.contentFlag.groupBy({
          by: ['contentType'],
          where,
          _count: true,
        }),
        prisma.contentFlag.aggregate({
          where,
          _avg: {
            confidence: true,
          },
        }),
      ])

      return {
        total: totalFlags,
        resolved: resolvedFlags,
        unresolved: unresolvedFlags,
        byType: flagsByType.reduce(
          (acc, item) => {
            acc[item.flagType] = item._count
            return acc
          },
          {} as Record<string, number>,
        ),
        byContentType: flagsByContentType.reduce(
          (acc, item) => {
            acc[item.contentType] = item._count
            return acc
          },
          {} as Record<string, number>,
        ),
        averageConfidence: averageConfidence._avg.confidence || 0,
      }
    } catch (error) {
      logger.error('Get content flag stats error:', error)
      throw new Error('Failed to get content flag statistics')
    }
  }

  /**
   * Check if content should be flagged based on confidence threshold
   */
  shouldFlagContent(confidence: number, threshold: number = 0.7): boolean {
    return confidence >= threshold
  }

  /**
   * Get high-confidence unresolved flags
   */
  async getHighConfidenceFlags(threshold: number = 0.8, limit: number = 50) {
    try {
      const flags = await prisma.contentFlag.findMany({
        where: {
          confidence: { gte: threshold },
          isResolved: false,
        },
        include: {
          resolver: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
        orderBy: {
          confidence: 'desc',
        },
        take: limit,
      })

      return flags
    } catch (error) {
      logger.error('Get high confidence flags error:', error)
      throw new Error('Failed to get high confidence flags')
    }
  }
}

export const contentFlagsService = new ContentFlagsService()
