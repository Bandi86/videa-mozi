import prisma from '../config/database.js'
import logger from '../config/logger.js'

export interface CreateAppealData {
  reportId: string
  appellantId: string
  reason: string
}

export interface UpdateAppealData {
  status?: string
  reviewedBy?: string
  reviewedAt?: Date
  reviewNotes?: string
}

export interface AppealFilters {
  appellantId?: string
  status?: string
  reviewedBy?: string
  dateFrom?: Date
  dateTo?: Date
}

export interface PaginationOptions {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export class AppealsService {
  /**
   * Create a new appeal
   */
  async createAppeal(data: CreateAppealData) {
    try {
      // Check if appeal already exists for this report
      const existingAppeal = await prisma.appeal.findUnique({
        where: {
          reportId: data.reportId,
        },
      })

      if (existingAppeal) {
        throw new Error('Appeal already exists for this report')
      }

      const appeal = await prisma.appeal.create({
        data: {
          reportId: data.reportId,
          appellantId: data.appellantId,
          reason: data.reason,
        },
        include: {
          report: {
            include: {
              reportedUser: {
                select: {
                  id: true,
                  username: true,
                  email: true,
                },
              },
            },
          },
          appellant: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
          reviewer: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
      })

      logger.info(
        `📄 Appeal created: ${appeal.id} for report ${data.reportId} by user ${data.appellantId}`,
      )
      return appeal
    } catch (error) {
      logger.error('Create appeal error:', error)
      throw error
    }
  }

  /**
   * Get appeal by ID
   */
  async getAppealById(id: string) {
    try {
      const appeal = await prisma.appeal.findUnique({
        where: { id },
        include: {
          report: {
            include: {
              reportedUser: {
                select: {
                  id: true,
                  username: true,
                  email: true,
                },
              },
            },
          },
          appellant: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
          reviewer: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
      })

      if (!appeal) {
        throw new Error('Appeal not found')
      }

      return appeal
    } catch (error) {
      logger.error('Get appeal by ID error:', error)
      throw error
    }
  }

  /**
   * Get appeals with filtering and pagination
   */
  async getAppeals(filters: AppealFilters = {}, pagination: PaginationOptions = {}) {
    try {
      const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = pagination

      const where: any = {}

      if (filters.appellantId) where.appellantId = filters.appellantId
      if (filters.status) where.status = filters.status
      if (filters.reviewedBy) where.reviewedBy = filters.reviewedBy

      if (filters.dateFrom || filters.dateTo) {
        where.createdAt = {}
        if (filters.dateFrom) where.createdAt.gte = filters.dateFrom
        if (filters.dateTo) where.createdAt.lte = filters.dateTo
      }

      const total = await prisma.appeal.count({ where })
      const appeals = await prisma.appeal.findMany({
        where,
        include: {
          report: {
            include: {
              reportedUser: {
                select: {
                  id: true,
                  username: true,
                  email: true,
                },
              },
            },
          },
          appellant: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
          reviewer: {
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
        data: appeals,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      }
    } catch (error) {
      logger.error('Get appeals error:', error)
      throw new Error('Failed to get appeals')
    }
  }

  /**
   * Update appeal
   */
  async updateAppeal(id: string, updateData: UpdateAppealData) {
    try {
      const data: any = { ...updateData }

      if (updateData.status && updateData.status !== 'PENDING') {
        data.reviewedAt = updateData.reviewedAt || new Date()
      }

      const appeal = await prisma.appeal.update({
        where: { id },
        data,
        include: {
          report: {
            include: {
              reportedUser: {
                select: {
                  id: true,
                  username: true,
                  email: true,
                },
              },
            },
          },
          appellant: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
          reviewer: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
      })

      logger.info(`📄 Appeal updated: ${id} status to ${updateData.status}`)
      return appeal
    } catch (error) {
      logger.error('Update appeal error:', error)
      throw new Error('Failed to update appeal')
    }
  }

  /**
   * Approve appeal
   */
  async approveAppeal(id: string, reviewerId: string, reviewNotes?: string) {
    try {
      const appeal = await prisma.appeal.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          reviewNotes,
        },
        include: {
          report: true,
          appellant: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
          reviewer: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
      })

      // Update the original report status
      await prisma.report.update({
        where: { id: appeal.reportId },
        data: {
          status: 'DISMISSED',
          resolution: `Appeal approved: ${reviewNotes || 'No notes provided'}`,
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
        },
      })

      logger.info(`✅ Appeal approved: ${id} by reviewer ${reviewerId}`)
      return appeal
    } catch (error) {
      logger.error('Approve appeal error:', error)
      throw new Error('Failed to approve appeal')
    }
  }

  /**
   * Reject appeal
   */
  async rejectAppeal(id: string, reviewerId: string, reviewNotes?: string) {
    try {
      const appeal = await prisma.appeal.update({
        where: { id },
        data: {
          status: 'REJECTED',
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          reviewNotes,
        },
        include: {
          report: true,
          appellant: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
          reviewer: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
      })

      logger.info(`❌ Appeal rejected: ${id} by reviewer ${reviewerId}`)
      return appeal
    } catch (error) {
      logger.error('Reject appeal error:', error)
      throw new Error('Failed to reject appeal')
    }
  }

  /**
   * Delete appeal
   */
  async deleteAppeal(id: string) {
    try {
      await prisma.appeal.delete({
        where: { id },
      })

      logger.info(`🗑️ Appeal deleted: ${id}`)
      return true
    } catch (error) {
      logger.error('Delete appeal error:', error)
      throw new Error('Failed to delete appeal')
    }
  }

  /**
   * Get appeals for a specific appellant
   */
  async getAppealsByAppellant(appellantId: string, pagination: PaginationOptions = {}) {
    try {
      return await this.getAppeals({ appellantId }, pagination)
    } catch (error) {
      logger.error('Get appeals by appellant error:', error)
      throw error
    }
  }

  /**
   * Get pending appeals
   */
  async getPendingAppeals(pagination: PaginationOptions = {}) {
    try {
      return await this.getAppeals({ status: 'PENDING' }, pagination)
    } catch (error) {
      logger.error('Get pending appeals error:', error)
      throw error
    }
  }

  /**
   * Get appeals reviewed by a specific moderator
   */
  async getAppealsByReviewer(reviewerId: string, pagination: PaginationOptions = {}) {
    try {
      return await this.getAppeals({ reviewedBy: reviewerId }, pagination)
    } catch (error) {
      logger.error('Get appeals by reviewer error:', error)
      throw error
    }
  }

  /**
   * Get appeal statistics
   */
  async getAppealStats(dateFrom?: Date, dateTo?: Date) {
    try {
      const where: any = {}

      if (dateFrom || dateTo) {
        where.createdAt = {}
        if (dateFrom) where.createdAt.gte = dateFrom
        if (dateTo) where.createdAt.lte = dateTo
      }

      const [totalAppeals, pendingAppeals, approvedAppeals, rejectedAppeals, appealsByStatus] =
        await Promise.all([
          prisma.appeal.count({ where }),
          prisma.appeal.count({ where: { ...where, status: 'PENDING' } }),
          prisma.appeal.count({ where: { ...where, status: 'APPROVED' } }),
          prisma.appeal.count({ where: { ...where, status: 'REJECTED' } }),
          prisma.appeal.groupBy({
            by: ['status'],
            where,
            _count: true,
          }),
        ])

      return {
        total: totalAppeals,
        pending: pendingAppeals,
        approved: approvedAppeals,
        rejected: rejectedAppeals,
        byStatus: appealsByStatus.reduce(
          (acc, item) => {
            acc[item.status] = item._count
            return acc
          },
          {} as Record<string, number>,
        ),
      }
    } catch (error) {
      logger.error('Get appeal stats error:', error)
      throw new Error('Failed to get appeal statistics')
    }
  }

  /**
   * Check if user can appeal a report
   */
  async canUserAppeal(reportId: string, userId: string): Promise<boolean> {
    try {
      const report = await prisma.report.findUnique({
        where: { id: reportId },
        select: {
          reportedUserId: true,
          status: true,
        },
      })

      if (!report) {
        return false
      }

      // Only the reported user can appeal
      if (report.reportedUserId !== userId) {
        return false
      }

      // Can only appeal resolved reports
      if (report.status !== 'RESOLVED') {
        return false
      }

      // Check if appeal already exists
      const existingAppeal = await prisma.appeal.findUnique({
        where: { reportId },
      })

      return !existingAppeal
    } catch (error) {
      logger.error('Check user appeal eligibility error:', error)
      return false
    }
  }

  /**
   * Get appeal timeline for a report
   */
  async getAppealTimeline(reportId: string) {
    try {
      const appeal = await prisma.appeal.findUnique({
        where: { reportId },
        include: {
          appellant: {
            select: {
              id: true,
              username: true,
            },
          },
          reviewer: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      })

      if (!appeal) {
        throw new Error('Appeal not found for this report')
      }

      const timeline = [
        {
          type: 'appeal_created',
          timestamp: appeal.createdAt,
          user: appeal.appellant,
          description: 'Appeal submitted',
          details: appeal.reason,
        },
      ]

      if (appeal.reviewedAt && appeal.reviewer) {
        timeline.push({
          type: appeal.status === 'APPROVED' ? 'appeal_approved' : 'appeal_rejected',
          timestamp: appeal.reviewedAt,
          user: appeal.reviewer,
          description: `Appeal ${appeal.status.toLowerCase()}`,
          details: appeal.reviewNotes || 'No review notes provided',
        })
      }

      return {
        appeal,
        timeline,
      }
    } catch (error) {
      logger.error('Get appeal timeline error:', error)
      throw error
    }
  }
}

export const appealsService = new AppealsService()
