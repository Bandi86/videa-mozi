import prisma from '../config/database.js'
import logger from '../config/logger.js'
import { ReportStatus, ReportType, ContentType } from '@prisma/client'

export interface CreateReportData {
  reporterId: string
  reportedUserId?: string
  contentId?: string
  contentType?: ContentType
  reportType: ReportType
  reason?: string
  description?: string
  priority?: number
}

export interface UpdateReportData {
  status?: ReportStatus
  priority?: number
  assignedTo?: string
  resolution?: string
}

export interface ReportFilters {
  status?: ReportStatus
  reportType?: ReportType
  priority?: number
  assignedTo?: string
  reporterId?: string
  reportedUserId?: string
  contentId?: string
  contentType?: ContentType
  dateFrom?: Date
  dateTo?: Date
}

export interface PaginationOptions {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export class ReportsService {
  /**
   * Create a new report
   */
  async createReport(data: CreateReportData) {
    try {
      const report = await prisma.report.create({
        data: {
          reporterId: data.reporterId,
          reportedUserId: data.reportedUserId,
          contentId: data.contentId,
          contentType: data.contentType,
          reportType: data.reportType,
          reason: data.reason,
          description: data.description,
          priority: data.priority || this.calculatePriority(data.reportType),
        },
        include: {
          reporter: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
          reportedUser: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
      })

      logger.info(`📝 Report created: ${report.id} by user ${data.reporterId}`)
      return report
    } catch (error) {
      logger.error('Create report error:', error)
      throw new Error('Failed to create report')
    }
  }

  /**
   * Get report by ID
   */
  async getReportById(id: string) {
    try {
      const report = await prisma.report.findUnique({
        where: { id },
        include: {
          reporter: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
          reportedUser: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
          assignedModerator: {
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

      if (!report) {
        throw new Error('Report not found')
      }

      return report
    } catch (error) {
      logger.error('Get report by ID error:', error)
      throw error
    }
  }

  /**
   * Get reports with filtering and pagination
   */
  async getReports(filters: ReportFilters = {}, pagination: PaginationOptions = {}) {
    try {
      const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = pagination

      const where: any = {}

      if (filters.status) where.status = filters.status
      if (filters.reportType) where.reportType = filters.reportType
      if (filters.priority) where.priority = filters.priority
      if (filters.assignedTo) where.assignedTo = filters.assignedTo
      if (filters.reporterId) where.reporterId = filters.reporterId
      if (filters.reportedUserId) where.reportedUserId = filters.reportedUserId
      if (filters.contentId) where.contentId = filters.contentId
      if (filters.contentType) where.contentType = filters.contentType

      if (filters.dateFrom || filters.dateTo) {
        where.createdAt = {}
        if (filters.dateFrom) where.createdAt.gte = filters.dateFrom
        if (filters.dateTo) where.createdAt.lte = filters.dateTo
      }

      const total = await prisma.report.count({ where })
      const reports = await prisma.report.findMany({
        where,
        include: {
          reporter: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
          reportedUser: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
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
        data: reports,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      }
    } catch (error) {
      logger.error('Get reports error:', error)
      throw new Error('Failed to get reports')
    }
  }

  /**
   * Update report
   */
  async updateReport(id: string, updateData: UpdateReportData, updatedBy?: string) {
    try {
      const data: any = { ...updateData }

      if (updateData.status && updateData.status !== 'PENDING') {
        data.reviewedAt = new Date()
        data.reviewedBy = updatedBy
      }

      const report = await prisma.report.update({
        where: { id },
        data,
        include: {
          reporter: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
          reportedUser: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
          assignedModerator: {
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

      logger.info(`📝 Report updated: ${id} by user ${updatedBy}`)
      return report
    } catch (error) {
      logger.error('Update report error:', error)
      throw new Error('Failed to update report')
    }
  }

  /**
   * Delete report
   */
  async deleteReport(id: string) {
    try {
      await prisma.report.delete({
        where: { id },
      })

      logger.info(`🗑️ Report deleted: ${id}`)
      return true
    } catch (error) {
      logger.error('Delete report error:', error)
      throw new Error('Failed to delete report')
    }
  }

  /**
   * Assign report to moderator
   */
  async assignReport(id: string, moderatorId: string) {
    try {
      const report = await prisma.report.update({
        where: { id },
        data: {
          assignedTo: moderatorId,
          status: 'UNDER_REVIEW',
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

      logger.info(`👤 Report ${id} assigned to moderator ${moderatorId}`)
      return report
    } catch (error) {
      logger.error('Assign report error:', error)
      throw new Error('Failed to assign report')
    }
  }

  /**
   * Resolve report
   */
  async resolveReport(id: string, resolution: string, moderatorId: string) {
    try {
      const report = await prisma.report.update({
        where: { id },
        data: {
          status: 'RESOLVED',
          resolution,
          reviewedAt: new Date(),
          reviewedBy: moderatorId,
        },
        include: {
          reviewer: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
      })

      logger.info(`✅ Report ${id} resolved by moderator ${moderatorId}`)
      return report
    } catch (error) {
      logger.error('Resolve report error:', error)
      throw new Error('Failed to resolve report')
    }
  }

  /**
   * Get report statistics
   */
  async getReportStats(dateFrom?: Date, dateTo?: Date) {
    try {
      const where: any = {}

      if (dateFrom || dateTo) {
        where.createdAt = {}
        if (dateFrom) where.createdAt.gte = dateFrom
        if (dateTo) where.createdAt.lte = dateTo
      }

      const [
        totalReports,
        pendingReports,
        resolvedReports,
        dismissedReports,
        reportsByType,
        reportsByPriority,
      ] = await Promise.all([
        prisma.report.count({ where }),
        prisma.report.count({ where: { ...where, status: 'PENDING' } }),
        prisma.report.count({ where: { ...where, status: 'RESOLVED' } }),
        prisma.report.count({ where: { ...where, status: 'DISMISSED' } }),
        prisma.report.groupBy({
          by: ['reportType'],
          where,
          _count: true,
        }),
        prisma.report.groupBy({
          by: ['priority'],
          where,
          _count: true,
        }),
      ])

      return {
        total: totalReports,
        pending: pendingReports,
        resolved: resolvedReports,
        dismissed: dismissedReports,
        byType: reportsByType.reduce(
          (acc, item) => {
            acc[item.reportType] = item._count
            return acc
          },
          {} as Record<string, number>,
        ),
        byPriority: reportsByPriority.reduce(
          (acc, item) => {
            acc[item.priority] = item._count
            return acc
          },
          {} as Record<number, number>,
        ),
      }
    } catch (error) {
      logger.error('Get report stats error:', error)
      throw new Error('Failed to get report statistics')
    }
  }

  /**
   * Calculate priority based on report type
   */
  private calculatePriority(reportType: ReportType): number {
    const priorityMap = {
      [ReportType.THREAT]: 4,
      [ReportType.HATE_SPEECH]: 4,
      [ReportType.COPYRIGHT_VIOLATION]: 3,
      [ReportType.HARASSMENT]: 3,
      [ReportType.INAPPROPRIATE_CONTENT]: 2,
      [ReportType.SPAM]: 2,
      [ReportType.MISLEADING]: 2,
      [ReportType.OTHER]: 1,
    }

    return priorityMap[reportType] || 1
  }
}

export const reportsService = new ReportsService()
