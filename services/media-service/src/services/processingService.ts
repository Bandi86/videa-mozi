import sharp from 'sharp'
import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
import fs from 'fs/promises'
import { promisify } from 'util'
import prisma from '../config/database.js'
import logger from '../config/logger.js'
import storageService from '../config/storage.js'
import { ProcessingType, MediaType } from '@prisma/client'

export interface ProcessingConfig {
  // Image processing
  width?: number
  height?: number
  quality?: number
  format?: string
  crop?: {
    x: number
    y: number
    width: number
    height: number
  }
  resize?: {
    width?: number
    height?: number
    fit?: string
  }

  // Video processing
  timestamp?: number // For thumbnail extraction
  duration?: number
  bitrate?: number
  codec?: string
  watermark?: {
    text?: string
    image?: Buffer
    position?: string
    opacity?: number
  }
}

export class ProcessingService {
  /**
   * Process media based on job configuration
   */
  async processMedia(jobId: string): Promise<void> {
    try {
      const job = await prisma.processingJob.findUnique({
        where: { id: jobId },
        include: {
          media: true,
        },
      })

      if (!job || !job.media) {
        throw new Error('Processing job or media not found')
      }

      logger.logProcessingEvent(job.mediaId, 'started', {
        jobId,
        type: job.type,
      })

      // Update job status
      await prisma.processingJob.update({
        where: { id: jobId },
        data: {
          status: 'PROCESSING',
          startedAt: new Date(),
        },
      })

      let result: any = {}

      // Process based on type
      switch (job.type) {
        case ProcessingType.THUMBNAIL:
          result = await this.generateThumbnail(job.media, job.config as ProcessingConfig)
          break

        case ProcessingType.RESIZE:
          result = await this.resizeImage(job.media, job.config as ProcessingConfig)
          break

        case ProcessingType.COMPRESS:
          result = await this.compressMedia(job.media, job.config as ProcessingConfig)
          break

        case ProcessingType.CONVERT:
          result = await this.convertMedia(job.media, job.config as ProcessingConfig)
          break

        case ProcessingType.WATERMARK:
          result = await this.addWatermark(job.media, job.config as ProcessingConfig)
          break

        case ProcessingType.CROP:
          result = await this.cropImage(job.media, job.config as ProcessingConfig)
          break

        case ProcessingType.OPTIMIZE:
          result = await this.optimizeMedia(job.media, job.config as ProcessingConfig)
          break

        default:
          throw new Error(`Unknown processing type: ${job.type}`)
      }

      // Update job status
      await prisma.processingJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          result,
        },
      })

      // Update media with processing results
      if (result.thumbnailUrl) {
        await prisma.media.update({
          where: { id: job.mediaId },
          data: {
            thumbnailUrl: result.thumbnailUrl,
          },
        })
      }

      if (result.previewUrl) {
        await prisma.media.update({
          where: { id: job.mediaId },
          data: {
            previewUrl: result.previewUrl,
          },
        })
      }

      logger.logProcessingEvent(job.mediaId, 'completed', {
        jobId,
        type: job.type,
        result,
      })
    } catch (error) {
      logger.error('Process media error:', error)

      // Update job status to failed
      await prisma.processingJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          error: (error as Error).message,
        },
      })

      throw error
    }
  }

  /**
   * Generate thumbnail from media
   */
  private async generateThumbnail(media: any, config: ProcessingConfig) {
    try {
      if (media.type === MediaType.IMAGE) {
        return await this.generateImageThumbnail(media, config)
      } else if (media.type === MediaType.VIDEO) {
        return await this.generateVideoThumbnail(media, config)
      } else {
        throw new Error('Thumbnail generation not supported for this media type')
      }
    } catch (error) {
      logger.error('Generate thumbnail error:', error)
      throw error
    }
  }

  /**
   * Generate thumbnail from image
   */
  private async generateImageThumbnail(media: any, config: ProcessingConfig) {
    const sizes = config.sizes || [150, 300]
    const variants = []

    // Get original image buffer
    const originalBuffer = await this.getMediaBuffer(media.storageKey)

    for (const size of sizes) {
      const thumbnailBuffer = await sharp(originalBuffer)
        .resize(size, size, {
          fit: 'cover',
          position: 'center',
        })
        .jpeg({ quality: 80 })
        .toBuffer()

      // Upload thumbnail
      const thumbnailResult = await storageService.uploadFile(thumbnailBuffer, {
        filename: `thumbnail-${size}-${media.filename}`,
        contentType: 'image/jpeg',
        size: thumbnailBuffer.length,
        accessLevel: media.accessLevel,
      })

      variants.push({
        name: `thumbnail-${size}`,
        url: thumbnailResult.url,
        size,
      })
    }

    return {
      thumbnails: variants,
      thumbnailUrl: variants[0]?.url,
    }
  }

  /**
   * Generate thumbnail from video
   */
  private async generateVideoThumbnail(media: any, config: ProcessingConfig) {
    const timestamp = config.timestamp || 10
    const tempDir = path.join(process.cwd(), 'temp')

    // Ensure temp directory exists
    await fs.mkdir(tempDir, { recursive: true })

    const tempThumbnailPath = path.join(tempDir, `thumbnail-${media.id}.jpg`)

    try {
      // Use ffmpeg to extract thumbnail
      await new Promise<void>((resolve, reject) => {
        ffmpeg(media.url)
          .inputOptions([`-ss ${timestamp}`])
          .outputOptions(['-vframes 1', '-q:v 2'])
          .output(tempThumbnailPath)
          .on('end', () => resolve())
          .on('error', reject)
          .run()
      })

      // Read thumbnail file
      const thumbnailBuffer = await fs.readFile(tempThumbnailPath)

      // Upload thumbnail
      const thumbnailResult = await storageService.uploadFile(thumbnailBuffer, {
        filename: `thumbnail-${media.filename}.jpg`,
        contentType: 'image/jpeg',
        size: thumbnailBuffer.length,
        accessLevel: media.accessLevel,
      })

      // Clean up temp file
      await fs.unlink(tempThumbnailPath)

      return {
        thumbnailUrl: thumbnailResult.url,
        timestamp,
      }
    } catch (error) {
      // Clean up temp file if it exists
      try {
        await fs.unlink(tempThumbnailPath)
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      throw error
    }
  }

  /**
   * Resize image
   */
  private async resizeImage(media: any, config: ProcessingConfig) {
    if (media.type !== MediaType.IMAGE) {
      throw new Error('Resize only supported for images')
    }

    const originalBuffer = await this.getMediaBuffer(media.storageKey)

    const resizeOptions = {
      width: config.width,
      height: config.height,
      fit: config.resize?.fit || 'cover',
      ...config.resize,
    }

    const resizedBuffer = await sharp(originalBuffer)
      .resize(resizeOptions)
      .jpeg({ quality: config.quality || 80 })
      .toBuffer()

    // Upload resized image
    const resizedResult = await storageService.uploadFile(resizedBuffer, {
      filename: `resized-${config.width}x${config.height}-${media.filename}`,
      contentType: media.mimeType,
      size: resizedBuffer.length,
      accessLevel: media.accessLevel,
    })

    return {
      resizedUrl: resizedResult.url,
      originalSize: originalBuffer.length,
      newSize: resizedBuffer.length,
      dimensions: {
        width: config.width,
        height: config.height,
      },
    }
  }

  /**
   * Compress media
   */
  private async compressMedia(media: any, config: ProcessingConfig) {
    if (media.type === MediaType.IMAGE) {
      return await this.compressImage(media, config)
    } else if (media.type === MediaType.VIDEO) {
      return await this.compressVideo(media, config)
    } else {
      throw new Error('Compression not supported for this media type')
    }
  }

  /**
   * Compress image
   */
  private async compressImage(media: any, config: ProcessingConfig) {
    const originalBuffer = await this.getMediaBuffer(media.storageKey)
    const quality = config.quality || 80

    const compressedBuffer = await sharp(originalBuffer).jpeg({ quality }).toBuffer()

    const compressedResult = await storageService.uploadFile(compressedBuffer, {
      filename: `compressed-q${quality}-${media.filename}`,
      contentType: media.mimeType,
      size: compressedBuffer.length,
      accessLevel: media.accessLevel,
    })

    return {
      compressedUrl: compressedResult.url,
      originalSize: originalBuffer.length,
      compressedSize: compressedBuffer.length,
      compressionRatio: (
        ((originalBuffer.length - compressedBuffer.length) / originalBuffer.length) *
        100
      ).toFixed(2),
      quality,
    }
  }

  /**
   * Compress video
   */
  private async compressVideo(media: any, config: ProcessingConfig) {
    const tempDir = path.join(process.cwd(), 'temp')
    await fs.mkdir(tempDir, { recursive: true })

    const tempCompressedPath = path.join(tempDir, `compressed-${media.id}.mp4`)

    try {
      const bitrate = config.bitrate || '1000k'

      await new Promise<void>((resolve, reject) => {
        ffmpeg(media.url)
          .videoBitrate(bitrate)
          .audioBitrate('128k')
          .outputOptions(['-preset fast', '-crf 28'])
          .output(tempCompressedPath)
          .on('end', () => resolve())
          .on('error', reject)
          .run()
      })

      const compressedBuffer = await fs.readFile(tempCompressedPath)

      const compressedResult = await storageService.uploadFile(compressedBuffer, {
        filename: `compressed-${media.filename}`,
        contentType: media.mimeType,
        size: compressedBuffer.length,
        accessLevel: media.accessLevel,
      })

      // Clean up temp file
      await fs.unlink(tempCompressedPath)

      return {
        compressedUrl: compressedResult.url,
        originalSize: media.size,
        compressedSize: compressedBuffer.length,
        bitrate,
      }
    } catch (error) {
      // Clean up temp file if it exists
      try {
        await fs.unlink(tempCompressedPath)
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      throw error
    }
  }

  /**
   * Convert media format
   */
  private async convertMedia(media: any, config: ProcessingConfig) {
    const targetFormat = config.format || 'webp'
    const tempDir = path.join(process.cwd(), 'temp')
    await fs.mkdir(tempDir, { recursive: true })

    const tempConvertedPath = path.join(tempDir, `converted-${media.id}.${targetFormat}`)

    try {
      if (media.type === MediaType.IMAGE) {
        const originalBuffer = await this.getMediaBuffer(media.storageKey)

        let sharpInstance = sharp(originalBuffer)

        switch (targetFormat) {
          case 'webp':
            sharpInstance = sharpInstance.webp({ quality: config.quality || 80 })
            break
          case 'png':
            sharpInstance = sharpInstance.png({ quality: config.quality || 80 })
            break
          case 'jpeg':
          case 'jpg':
            sharpInstance = sharpInstance.jpeg({ quality: config.quality || 80 })
            break
          default:
            throw new Error(`Unsupported target format: ${targetFormat}`)
        }

        const convertedBuffer = await sharpInstance.toBuffer()

        const convertedResult = await storageService.uploadFile(convertedBuffer, {
          filename: `converted-${targetFormat}-${media.filename}`,
          contentType: `image/${targetFormat}`,
          size: convertedBuffer.length,
          accessLevel: media.accessLevel,
        })

        return {
          convertedUrl: convertedResult.url,
          originalFormat: media.mimeType,
          targetFormat,
          originalSize: originalBuffer.length,
          convertedSize: convertedBuffer.length,
        }
      } else if (media.type === MediaType.VIDEO) {
        // Video conversion would go here
        throw new Error('Video conversion not implemented yet')
      } else {
        throw new Error('Conversion not supported for this media type')
      }
    } catch (error) {
      // Clean up temp file if it exists
      try {
        await fs.unlink(tempConvertedPath)
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      throw error
    }
  }

  /**
   * Add watermark to media
   */
  private async addWatermark(media: any, config: ProcessingConfig) {
    if (!config.watermark) {
      throw new Error('Watermark configuration required')
    }

    if (media.type === MediaType.IMAGE) {
      return await this.addImageWatermark(media, config)
    } else if (media.type === MediaType.VIDEO) {
      return await this.addVideoWatermark(media, config)
    } else {
      throw new Error('Watermark not supported for this media type')
    }
  }

  /**
   * Add watermark to image
   */
  private async addImageWatermark(media: any, config: ProcessingConfig) {
    const originalBuffer = await this.getMediaBuffer(media.storageKey)
    const watermark = config.watermark!

    let sharpInstance = sharp(originalBuffer)

    if (watermark.text) {
      // Add text watermark
      sharpInstance = sharpInstance.composite([
        {
          input: Buffer.from(`
          <svg width="200" height="50">
            <text x="10" y="30" font-family="Arial" font-size="16" fill="white" stroke="black" stroke-width="1">
              ${watermark.text}
            </text>
          </svg>
        `),
          top: 10,
          left: 10,
        },
      ])
    } else if (watermark.image) {
      // Add image watermark
      sharpInstance = sharpInstance.composite([
        {
          input: watermark.image,
          top: 10,
          left: 10,
          opacity: watermark.opacity || 0.5,
        },
      ])
    }

    const watermarkedBuffer = await sharpInstance.jpeg().toBuffer()

    const watermarkedResult = await storageService.uploadFile(watermarkedBuffer, {
      filename: `watermarked-${media.filename}`,
      contentType: media.mimeType,
      size: watermarkedBuffer.length,
      accessLevel: media.accessLevel,
    })

    return {
      watermarkedUrl: watermarkedResult.url,
      watermark: config.watermark,
    }
  }

  /**
   * Add watermark to video
   */
  private async addVideoWatermark(media: any, config: ProcessingConfig) {
    // Video watermark implementation would go here
    throw new Error('Video watermark not implemented yet')
  }

  /**
   * Crop image
   */
  private async cropImage(media: any, config: ProcessingConfig) {
    if (media.type !== MediaType.IMAGE || !config.crop) {
      throw new Error('Crop only supported for images with crop configuration')
    }

    const originalBuffer = await this.getMediaBuffer(media.storageKey)
    const crop = config.crop

    const croppedBuffer = await sharp(originalBuffer)
      .extract({
        left: crop.x,
        top: crop.y,
        width: crop.width,
        height: crop.height,
      })
      .jpeg({ quality: config.quality || 80 })
      .toBuffer()

    const croppedResult = await storageService.uploadFile(croppedBuffer, {
      filename: `cropped-${media.filename}`,
      contentType: media.mimeType,
      size: croppedBuffer.length,
      accessLevel: media.accessLevel,
    })

    return {
      croppedUrl: croppedResult.url,
      crop: config.crop,
      originalSize: originalBuffer.length,
      croppedSize: croppedBuffer.length,
    }
  }

  /**
   * Optimize media
   */
  private async optimizeMedia(media: any, config: ProcessingConfig) {
    if (media.type === MediaType.IMAGE) {
      return await this.optimizeImage(media, config)
    } else {
      throw new Error('Optimization not supported for this media type')
    }
  }

  /**
   * Optimize image
   */
  private async optimizeImage(media: any, config: ProcessingConfig) {
    const originalBuffer = await this.getMediaBuffer(media.storageKey)

    const optimizedBuffer = await sharp(originalBuffer)
      .jpeg({
        quality: config.quality || 85,
        progressive: true,
        optimizeScans: true,
      })
      .toBuffer()

    const optimizedResult = await storageService.uploadFile(optimizedBuffer, {
      filename: `optimized-${media.filename}`,
      contentType: media.mimeType,
      size: optimizedBuffer.length,
      accessLevel: media.accessLevel,
    })

    return {
      optimizedUrl: optimizedResult.url,
      originalSize: originalBuffer.length,
      optimizedSize: optimizedBuffer.length,
      savings: `${(((originalBuffer.length - optimizedBuffer.length) / originalBuffer.length) * 100).toFixed(2)}%`,
    }
  }

  /**
   * Get media buffer from storage
   */
  private async getMediaBuffer(storageKey: string): Promise<Buffer> {
    // This would need to be implemented based on your storage service
    // For now, we'll assume it's available via a URL or direct access
    throw new Error('getMediaBuffer not implemented - depends on storage service implementation')
  }
}

export const processingService = new ProcessingService()
