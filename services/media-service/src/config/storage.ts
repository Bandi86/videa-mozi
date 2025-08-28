import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront'
import path from 'path'
import fs from 'fs/promises'
import logger from './logger.js'
import prisma from './database.js'
import { StorageProvider, AccessLevel } from '@prisma/client'

interface StorageConfig {
  provider: StorageProvider
  bucket?: string
  region?: string
  accessKeyId?: string
  secretAccessKey?: string
  cloudfrontDomain?: string
  cloudfrontDistributionId?: string
  localPath?: string
}

interface UploadOptions {
  filename: string
  contentType: string
  size: number
  accessLevel: AccessLevel
  metadata?: Record<string, string>
}

interface UploadResult {
  key: string
  url: string
  thumbnailUrl?: string
  previewUrl?: string
}

class StorageService {
  private s3Client?: S3Client
  private cloudfrontClient?: CloudFrontClient
  private config: StorageConfig

  constructor() {
    this.config = {
      provider: (process.env.STORAGE_PROVIDER as StorageProvider) || StorageProvider.LOCAL,
      bucket: process.env.AWS_S3_BUCKET,
      region: process.env.AWS_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      cloudfrontDomain: process.env.CLOUDFRONT_DOMAIN,
      cloudfrontDistributionId: process.env.CLOUDFRONT_DISTRIBUTION_ID,
      localPath: process.env.LOCAL_STORAGE_PATH || path.join(process.cwd(), 'uploads'),
    }

    this.initializeClients()
  }

  private initializeClients(): void {
    if (
      this.config.provider === StorageProvider.S3 &&
      this.config.accessKeyId &&
      this.config.secretAccessKey
    ) {
      this.s3Client = new S3Client({
        region: this.config.region,
        credentials: {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey,
        },
      })

      if (this.config.cloudfrontDistributionId) {
        this.cloudfrontClient = new CloudFrontClient({
          region: this.config.region,
          credentials: {
            accessKeyId: this.config.accessKeyId,
            secretAccessKey: this.config.secretAccessKey,
          },
        })
      }
    }
  }

  /**
   * Upload file to storage
   */
  async uploadFile(fileBuffer: Buffer, options: UploadOptions): Promise<UploadResult> {
    const { filename, contentType, size, accessLevel, metadata } = options

    try {
      const key = this.generateKey(filename)

      switch (this.config.provider) {
        case StorageProvider.S3:
          return await this.uploadToS3(fileBuffer, key, options)

        case StorageProvider.LOCAL:
        default:
          return await this.uploadToLocal(fileBuffer, key, filename)
      }
    } catch (error) {
      logger.error('Upload file error:', error)
      throw new Error('Failed to upload file')
    }
  }

  /**
   * Upload to Amazon S3
   */
  private async uploadToS3(
    fileBuffer: Buffer,
    key: string,
    options: UploadOptions,
  ): Promise<UploadResult> {
    if (!this.s3Client || !this.config.bucket) {
      throw new Error('S3 client not configured')
    }

    const { contentType, accessLevel, metadata } = options

    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
      Metadata: metadata,
      ACL: accessLevel === AccessLevel.PUBLIC ? 'public-read' : 'private',
    })

    await this.s3Client.send(command)

    const url =
      accessLevel === AccessLevel.PUBLIC
        ? `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com/${key}`
        : await this.generateSignedUrl(key)

    logger.logStorageEvent('upload', 's3', { key, size: fileBuffer.length })

    return {
      key,
      url,
    }
  }

  /**
   * Upload to local storage
   */
  private async uploadToLocal(
    fileBuffer: Buffer,
    key: string,
    filename: string,
  ): Promise<UploadResult> {
    const uploadPath = path.join(this.config.localPath!, key)
    const uploadDir = path.dirname(uploadPath)

    // Ensure directory exists
    await fs.mkdir(uploadDir, { recursive: true })

    // Write file
    await fs.writeFile(uploadPath, fileBuffer)

    const url = `/uploads/${key}`

    logger.logStorageEvent('upload', 'local', { key, path: uploadPath, size: fileBuffer.length })

    return {
      key,
      url,
    }
  }

  /**
   * Delete file from storage
   */
  async deleteFile(key: string): Promise<void> {
    try {
      switch (this.config.provider) {
        case StorageProvider.S3:
          await this.deleteFromS3(key)
          break

        case StorageProvider.LOCAL:
        default:
          await this.deleteFromLocal(key)
          break
      }

      logger.logStorageEvent('delete', this.config.provider.toLowerCase(), { key })
    } catch (error) {
      logger.error('Delete file error:', error)
      throw new Error('Failed to delete file')
    }
  }

  /**
   * Delete from S3
   */
  private async deleteFromS3(key: string): Promise<void> {
    if (!this.s3Client || !this.config.bucket) {
      throw new Error('S3 client not configured')
    }

    const command = new DeleteObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
    })

    await this.s3Client.send(command)
  }

  /**
   * Delete from local storage
   */
  private async deleteFromLocal(key: string): Promise<void> {
    const filePath = path.join(this.config.localPath!, key)

    try {
      await fs.unlink(filePath)
    } catch (error) {
      // Ignore if file doesn't exist
      if ((error as any).code !== 'ENOENT') {
        throw error
      }
    }
  }

  /**
   * Generate signed URL for private files
   */
  async generateSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    if (!this.s3Client || !this.config.bucket) {
      throw new Error('S3 client not configured')
    }

    const command = new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
    })

    return await getSignedUrl(this.s3Client, command, { expiresIn })
  }

  /**
   * Invalidate CloudFront cache
   */
  async invalidateCloudFront(paths: string[]): Promise<void> {
    if (!this.cloudfrontClient || !this.config.cloudfrontDistributionId) {
      return
    }

    try {
      const command = new CreateInvalidationCommand({
        DistributionId: this.config.cloudfrontDistributionId,
        InvalidationBatch: {
          CallerReference: Date.now().toString(),
          Paths: {
            Quantity: paths.length,
            Items: paths,
          },
        },
      })

      await this.cloudfrontClient.send(command)
      logger.info(`Invalidated CloudFront cache for ${paths.length} paths`)
    } catch (error) {
      logger.error('CloudFront invalidation error:', error)
    }
  }

  /**
   * Generate unique storage key
   */
  private generateKey(filename: string): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 15)
    const extension = path.extname(filename)
    const basename = path.basename(filename, extension)

    return `uploads/${timestamp}-${random}-${basename}${extension}`
  }

  /**
   * Get file info
   */
  async getFileInfo(key: string): Promise<any> {
    try {
      switch (this.config.provider) {
        case StorageProvider.S3:
          return await this.getS3FileInfo(key)

        case StorageProvider.LOCAL:
        default:
          return await this.getLocalFileInfo(key)
      }
    } catch (error) {
      logger.error('Get file info error:', error)
      throw new Error('Failed to get file info')
    }
  }

  /**
   * Get S3 file info
   */
  private async getS3FileInfo(key: string): Promise<any> {
    if (!this.s3Client || !this.config.bucket) {
      throw new Error('S3 client not configured')
    }

    const command = new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
    })

    const response = await this.s3Client.send(command)
    return {
      size: response.ContentLength,
      contentType: response.ContentType,
      lastModified: response.LastModified,
      metadata: response.Metadata,
    }
  }

  /**
   * Get local file info
   */
  private async getLocalFileInfo(key: string): Promise<any> {
    const filePath = path.join(this.config.localPath!, key)

    try {
      const stats = await fs.stat(filePath)
      return {
        size: stats.size,
        lastModified: stats.mtime,
      }
    } catch (error) {
      throw new Error('File not found')
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      await this.getFileInfo(key)
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Get storage configuration
   */
  getConfig(): StorageConfig {
    return { ...this.config }
  }

  /**
   * Update storage configuration
   */
  async updateConfig(newConfig: Partial<StorageConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig }
    this.initializeClients()
    logger.info('Storage configuration updated')
  }
}

export const storageService = new StorageService()
export default storageService
