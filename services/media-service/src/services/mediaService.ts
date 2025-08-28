import prisma from '../config/database.js'
import logger from '../config/logger.js'
import storageService from '../config/storage.js'
import { MediaType, MediaStatus, ProcessingType, AccessLevel } from '@prisma/client'
import { fileTypeFromBuffer } from 'file-type'
import sizeOf from 'image-size'
import path from 'path'

export interface UploadMediaData {
  filename: string
  buffer: Buffer
  mimeType?: string
  uploadedBy?: string
  accessLevel?: AccessLevel
  metadata?: any
}

export interface CreateProcessingJobData {
  mediaId: string
  type: ProcessingType
  config: any
  priority?: number
}

export interface MediaFilters {
  type?: MediaType
  status?: MediaStatus
  uploadedBy?: string
  accessLevel?: AccessLevel
  dateFrom?: Date
  dateTo?: Date
}

export interface PaginationOptions {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export class MediaService {
  /**
   * Upload and process media file
   */
  async uploadMedia(data: UploadMediaData) {
    try {
      const {
        filename,
        buffer,
        mimeType,
        uploadedBy,
        accessLevel = AccessLevel.PUBLIC,
        metadata,
      } = data

      // Detect file type if not provided
      const detectedType = mimeType ? { mime: mimeType } : await fileTypeFromBuffer(buffer)
      if (!detectedType) {
        throw new Error('Unable to detect file type')
      }

      const fileMimeType = detectedType.mime
      const mediaType = this.detectMediaType(fileMimeType)

      // Upload to storage
      const uploadResult = await storageService.uploadFile(buffer, {
        filename,
        contentType: fileMimeType,
        size: buffer.length,
        accessLevel,
        metadata,
      })

      // Get image dimensions if applicable
      let width, height
      if (mediaType === MediaType.IMAGE && this.isImageBuffer(buffer)) {
        try {
          const dimensions = sizeOf(buffer)
          width = dimensions.width
          height = dimensions.height
        } catch (error) {
          logger.warn('Failed to get image dimensions:', error)
        }
      }

      // Create media record
      const media = await prisma.media.create({
        data: {
          filename,
          originalName: filename,
          mimeType: fileMimeType,
          size: buffer.length,
          type: mediaType,
          status: MediaStatus.COMPLETED,
          url: uploadResult.url,
          thumbnailUrl: uploadResult.thumbnailUrl,
          previewUrl: uploadResult.previewUrl,
          storageKey: uploadResult.key,
          storageProvider: storageService.getConfig().provider,
          accessLevel,
          uploadedBy,
          metadata,
          width,
          height,
        },
      })

      logger.logMediaEvent('upload', {
        mediaId: media.id,
        filename,
        size: buffer.length,
        type: mediaType,
        uploadedBy,
      })

      // Queue processing jobs
      if (mediaType === MediaType.IMAGE) {
        await this.createProcessingJob({
          mediaId: media.id,
          type: ProcessingType.THUMBNAIL,
          config: { sizes: [150, 300, 600] },
        })
      } else if (mediaType === MediaType.VIDEO) {
        await this.createProcessingJob({
          mediaId: media.id,
          type: ProcessingType.THUMBNAIL,
          config: { timestamp: 10 },
        })
      }

      return media
    } catch (error) {
      logger.error('Upload media error:', error)
      throw error
    }
  }

  /**
   * Get media by ID
   */
  async getMediaById(id: string) {
    try {
      const media = await prisma.media.findUnique({
        where: { id },
        include: {
          variants: true,
          processingJobs: {
            where: {
              status: 'PENDING',
            },
          },
          uploader: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
      })

      if (!media) {
        throw new Error('Media not found')
      }

      return media
    } catch (error) {
      logger.error('Get media by ID error:', error)
      throw error
    }
  }

  /**
   * Get media with filtering and pagination
   */
  async getMedia(filters: MediaFilters = {}, pagination: PaginationOptions = {}) {
    try {
      const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = pagination

      const where: any = {}

      if (filters.type) where.type = filters.type
      if (filters.status) where.status = filters.status
      if (filters.uploadedBy) where.uploadedBy = filters.uploadedBy
      if (filters.accessLevel) where.accessLevel = filters.accessLevel

      if (filters.dateFrom || filters.dateTo) {
        where.createdAt = {}
        if (filters.dateFrom) where.createdAt.gte = filters.dateFrom
        if (filters.dateTo) where.createdAt.lte = filters.dateTo
      }

      const total = await prisma.media.count({ where })
      const media = await prisma.media.findMany({
        where,
        include: {
          variants: true,
          uploader: {
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
        data: media,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      }
    } catch (error) {
      logger.error('Get media error:', error)
      throw new Error('Failed to get media')
    }
  }

  /**
   * Update media
   */
  async updateMedia(id: string, updateData: Partial<any>) {
    try {
      const media = await prisma.media.update({
        where: { id },
        data: updateData,
        include: {
          variants: true,
          uploader: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
      })

      logger.logMediaEvent('update', {
        mediaId: id,
        updates: Object.keys(updateData),
      })

      return media
    } catch (error) {
      logger.error('Update media error:', error)
      throw new Error('Failed to update media')
    }
  }

  /**
   * Delete media
   */
  async deleteMedia(id: string) {
    try {
      // Get media info first
      const media = await prisma.media.findUnique({
        where: { id },
        select: {
          storageKey: true,
          variants: {
            select: {
              storageKey: true,
            },
          },
        },
      })

      if (!media) {
        throw new Error('Media not found')
      }

      // Delete from storage
      await storageService.deleteFile(media.storageKey)

      // Delete variants from storage
      for (const variant of media.variants) {
        try {
          await storageService.deleteFile(variant.storageKey)
        } catch (error) {
          logger.warn(`Failed to delete variant ${variant.storageKey}:`, error)
        }
      }

      // Delete from database
      await prisma.media.delete({
        where: { id },
      })

      logger.logMediaEvent('delete', { mediaId: id })
      return true
    } catch (error) {
      logger.error('Delete media error:', error)
      throw new Error('Failed to delete media')
    }
  }

  /**
   * Create processing job
   */
  async createProcessingJob(data: CreateProcessingJobData) {
    try {
      const job = await prisma.processingJob.create({
        data: {
          mediaId: data.mediaId,
          type: data.type,
          config: data.config,
          priority: data.priority || 1,
        },
      })

      logger.logProcessingEvent(data.mediaId, 'job_created', {
        jobId: job.id,
        type: data.type,
      })

      return job
    } catch (error) {
      logger.error('Create processing job error:', error)
      throw new Error('Failed to create processing job')
    }
  }

  /**
   * Get user's media
   */
  async getUserMedia(userId: string, pagination: PaginationOptions = {}) {
    try {
      return await this.getMedia({ uploadedBy: userId }, pagination)
    } catch (error) {
      logger.error('Get user media error:', error)
      throw error
    }
  }

  /**
   * Get media statistics
   */
  async getMediaStats(dateFrom?: Date, dateTo?: Date) {
    try {
      const where: any = {}

      if (dateFrom || dateTo) {
        where.createdAt = {}
        if (dateFrom) where.createdAt.gte = dateFrom
        if (dateTo) where.createdAt.lte = dateTo
      }

      const [totalMedia, totalSize, mediaByType, mediaByStatus] = await Promise.all([
        prisma.media.count({ where }),
        prisma.media.aggregate({
          where,
          _sum: {
            size: true,
          },
        }),
        prisma.media.groupBy({
          by: ['type'],
          where,
          _count: true,
        }),
        prisma.media.groupBy({
          by: ['status'],
          where,
          _count: true,
        }),
      ])

      return {
        total: totalMedia,
        totalSize: totalSize._sum.size || 0,
        byType: mediaByType.reduce(
          (acc, item) => {
            acc[item.type] = item._count
            return acc
          },
          {} as Record<string, number>,
        ),
        byStatus: mediaByStatus.reduce(
          (acc, item) => {
            acc[item.status] = item._count
            return acc
          },
          {} as Record<string, number>,
        ),
      }
    } catch (error) {
      logger.error('Get media stats error:', error)
      throw new Error('Failed to get media statistics')
    }
  }

  /**
   * Detect media type from MIME type
   */
  private detectMediaType(mimeType: string): MediaType {
    if (mimeType.startsWith('image/')) {
      return MediaType.IMAGE
    } else if (mimeType.startsWith('video/')) {
      return MediaType.VIDEO
    } else if (mimeType.startsWith('audio/')) {
      return MediaType.AUDIO
    } else if (
      mimeType.includes('pdf') ||
      mimeType.includes('document') ||
      mimeType.includes('text')
    ) {
      return MediaType.DOCUMENT
    } else if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar')) {
      return MediaType.ARCHIVE
    } else {
      return MediaType.OTHER
    }
  }

  /**
   * Check if buffer is an image
   */
  private isImageBuffer(buffer: Buffer): boolean {
    try {
      sizeOf(buffer)
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Log media access
   */
  async logMediaAccess(
    mediaId: string,
    accessedBy?: string,
    ipAddress?: string,
    userAgent?: string,
    referrer?: string,
  ) {
    try {
      await prisma.mediaAccessLog.create({
        data: {
          mediaId,
          accessedBy,
          ipAddress,
          userAgent,
          referrer,
        },
      })

      // Update analytics
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      await prisma.mediaAnalytics.upsert({
        where: {
          mediaId_date: {
            mediaId,
            date: today,
          },
        },
        update: {
          views: {
            increment: 1,
          },
        },
        create: {
          mediaId,
          date: today,
          views: 1,
        },
      })
    } catch (error) {
      logger.error('Log media access error:', error)
    }
  }

  /**
   * Get media variants
   */
  async getMediaVariants(mediaId: string) {
    try {
      const variants = await prisma.mediaVariant.findMany({
        where: {
          mediaId,
        },
        orderBy: {
          createdAt: 'asc',
        },
      })

      return variants
    } catch (error) {
      logger.error('Get media variants error:', error)
      throw new Error('Failed to get media variants')
    }
  }

  /**
   * Create media variant
   */
  async createMediaVariant(mediaId: string, name: string, buffer: Buffer, options: any = {}) {
    try {
      const media = await prisma.media.findUnique({
        where: { id: mediaId },
      })

      if (!media) {
        throw new Error('Media not found')
      }

      const variantKey = `${media.storageKey}/variants/${name}${path.extname(media.filename || '')}`

      const uploadResult = await storageService.uploadFile(buffer, {
        filename: `${name}-${media.filename}`,
        contentType: media.mimeType || 'application/octet-stream',
        size: buffer.length,
        accessLevel: media.accessLevel,
      })

      const variant = await prisma.mediaVariant.create({
        data: {
          mediaId,
          name,
          type: media.type,
          format: options.format || path.extname(media.filename || '').slice(1),
          width: options.width,
          height: options.height,
          size: buffer.length,
          url: uploadResult.url,
          storageKey: uploadResult.key,
          storageProvider: storageService.getConfig().provider,
        },
      })

      logger.logMediaEvent('variant_created', {
        mediaId,
        variantId: variant.id,
        name,
      })

      return variant
    } catch (error) {
      logger.error('Create media variant error:', error)
      throw new Error('Failed to create media variant')
    }
  }
}

export const mediaService = new MediaService()
