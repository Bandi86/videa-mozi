import { Request, Response } from 'express'
import path from 'path'
import { ImageService } from '../services/imageService.js'
import { logBusinessEvent, logSecurityEvent } from '../config/logger.js'

// Upload post images (multiple)
const uploadPostImages = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' })
    }

    const files = req.files as Express.Multer.File[]
    const imageUrls: string[] = []

    for (const file of files) {
      try {
        ImageService.validateImageFile(file)
        const imageUrl = await ImageService.savePostImage(file, false)
        imageUrls.push(imageUrl)
      } catch (error) {
        logSecurityEvent('IMAGE_UPLOAD_FAILED', {
          error: error.message,
          filename: file.originalname,
          userId,
        })
        return res
          .status(400)
          .json({ error: `Failed to process ${file.originalname}: ${error.message}` })
      }
    }

    logBusinessEvent('POST_IMAGES_UPLOADED', 'image', userId, {
      count: imageUrls.length,
      images: imageUrls,
    })

    res.json({
      message: `${imageUrls.length} image(s) uploaded successfully`,
      images: imageUrls,
    })
  } catch (error) {
    logSecurityEvent('POST_IMAGES_UPLOAD_FAILED', 'medium', {
      error: (error as Error).message,
      userId: (req as any).user?.id,
    })
    res.status(500).json({ error: 'Failed to upload images' })
  }
}

// Upload single post image
const uploadPostImage = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const file = req.file!

    try {
      ImageService.validateImageFile(file)
      const imageUrl = await ImageService.savePostImage(file, true)

      logBusinessEvent('POST_IMAGE_UPLOADED', 'image', userId, {
        imageUrl,
      })

      res.json({
        message: 'Image uploaded successfully',
        imageUrl,
      })
    } catch (error) {
      logSecurityEvent('IMAGE_UPLOAD_FAILED', 'medium', {
        error: (error as Error).message,
        filename: file.originalname,
        userId,
      })
      return res.status(400).json({ error: error.message })
    }
  } catch (error) {
    logSecurityEvent('POST_IMAGE_UPLOAD_FAILED', 'medium', {
      error: (error as Error).message,
      userId: (req as any).user?.id,
    })
    res.status(500).json({ error: 'Failed to upload image' })
  }
}

// Upload profile picture
const uploadProfilePicture = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const file = req.file!

    try {
      ImageService.validateImageFile(file)
      const imageUrl = await ImageService.saveProfilePicture(file)

      logBusinessEvent('PROFILE_PICTURE_UPLOADED', {
        userId,
        imageUrl,
      })

      res.json({
        message: 'Profile picture uploaded successfully',
        imageUrl,
      })
    } catch (error) {
      logSecurityEvent('PROFILE_PICTURE_UPLOAD_FAILED', 'medium', {
        error: (error as Error).message,
        filename: file.originalname,
        userId,
      })
      return res.status(400).json({ error: error.message })
    }
  } catch (error) {
    logSecurityEvent('PROFILE_PICTURE_UPLOAD_FAILED', 'medium', {
      error: (error as Error).message,
      userId: (req as any).user?.id,
    })
    res.status(500).json({ error: 'Failed to upload profile picture' })
  }
}

// Upload comment image
const uploadCommentImage = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const file = req.file!

    try {
      ImageService.validateImageFile(file)
      const imageUrl = await ImageService.saveCommentImage(file)

      logBusinessEvent('COMMENT_IMAGE_UPLOADED', {
        userId,
        imageUrl,
      })

      res.json({
        message: 'Comment image uploaded successfully',
        imageUrl,
      })
    } catch (error) {
      logSecurityEvent('COMMENT_IMAGE_UPLOAD_FAILED', 'medium', {
        error: (error as Error).message,
        filename: file.originalname,
        userId,
      })
      return res.status(400).json({ error: error.message })
    }
  } catch (error) {
    logSecurityEvent('COMMENT_IMAGE_UPLOAD_FAILED', 'medium', {
      error: (error as Error).message,
      userId: (req as any).user?.id,
    })
    res.status(500).json({ error: 'Failed to upload comment image' })
  }
}

// Delete image
const deleteImage = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const { imageUrl } = req.body

    if (!imageUrl) {
      return res.status(400).json({ error: 'Image URL is required' })
    }

    await ImageService.deleteImage(imageUrl)

    logBusinessEvent('IMAGE_DELETED', 'image', userId, {
      imageUrl,
    })

    res.json({ message: 'Image deleted successfully' })
  } catch (error) {
    logSecurityEvent('IMAGE_DELETION_FAILED', 'medium', {
      error: (error as Error).message,
      userId: (req as any).user?.id,
    })
    res.status(500).json({ error: 'Failed to delete image' })
  }
}

// Get image metadata
const getImageMetadata = async (req: Request, res: Response) => {
  try {
    const { imageUrl } = req.query

    if (!imageUrl || typeof imageUrl !== 'string') {
      return res.status(400).json({ error: 'Image URL is required' })
    }

    // Extract filename and determine directory
    const urlParts = imageUrl.split('/')
    const filename = urlParts[urlParts.length - 1]

    let imageDir: string
    if (imageUrl.includes('/posts/')) {
      imageDir = ImageService.getUploadPath('post')
    } else if (imageUrl.includes('/profiles/')) {
      imageDir = ImageService.getUploadPath('profile')
    } else if (imageUrl.includes('/comments/')) {
      imageDir = ImageService.getUploadPath('comment')
    } else {
      return res.status(400).json({ error: 'Invalid image URL' })
    }

    const fullPath = path.join(imageDir, filename)
    const metadata = await ImageService.getImageMetadata(fullPath)

    res.json({ metadata })
  } catch (error) {
    logSecurityEvent('IMAGE_METADATA_FAILED', 'low', {
      error: (error as Error).message,
    })
    res.status(500).json({ error: 'Failed to get image metadata' })
  }
}

export {
  uploadPostImages,
  uploadPostImage,
  uploadProfilePicture,
  uploadCommentImage,
  deleteImage,
  getImageMetadata,
}
