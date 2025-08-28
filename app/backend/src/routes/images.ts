import express from 'express'
import {
  uploadPostImages,
  uploadPostImage,
  uploadProfilePicture,
  uploadCommentImage,
  deleteImage,
  getImageMetadata,
} from '../controllers/imageController.js'
import { authenticateToken } from '../middlewares/auth.js'
import { generalRateLimit, createRateLimit } from '../middlewares/rateLimit.js'
import { requestSizeLimiter, sanitizeInput } from '../middlewares/security.js'
import {
  uploadMultiplePostImages,
  uploadSinglePostImage,
  uploadProfileImage,
  uploadCommentImageSingle,
} from '../config/multer.js'

/**
 * @swagger
 * tags:
 *   name: Images
 *   description: Image upload and management endpoints
 */

const router = express.Router()

// Apply common middleware to all routes
router.use(authenticateToken)
router.use(generalRateLimit)
router.use(requestSizeLimiter)
router.use(sanitizeInput)

/**
 * @swagger
 * /api/v1/images/posts:
 *   post:
 *     summary: Upload multiple post images
 *     description: Upload multiple images for a post (up to 10 images)
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Image files (JPEG, PNG, GIF, WebP)
 *     responses:
 *       200:
 *         description: Images uploaded successfully
 *       400:
 *         description: Invalid file or no files uploaded
 *       401:
 *         description: Authentication required
 */
router.post('/posts', uploadMultiplePostImages, uploadPostImages)

/**
 * @swagger
 * /api/v1/images/post:
 *   post:
 *     summary: Upload single post image
 *     description: Upload a single image for a post
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Image file (JPEG, PNG, GIF, WebP)
 *     responses:
 *       200:
 *         description: Image uploaded successfully
 *       400:
 *         description: Invalid file or no file uploaded
 *       401:
 *         description: Authentication required
 */
router.post('/post', uploadSinglePostImage, uploadPostImage)

/**
 * @swagger
 * /api/v1/images/profile:
 *   post:
 *     summary: Upload profile picture
 *     description: Upload a profile picture for the authenticated user
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               profilePicture:
 *                 type: string
 *                 format: binary
 *                 description: Profile picture file (JPEG, PNG, GIF, WebP)
 *     responses:
 *       200:
 *         description: Profile picture uploaded successfully
 *       400:
 *         description: Invalid file or no file uploaded
 *       401:
 *         description: Authentication required
 */
router.post('/profile', uploadProfileImage, uploadProfilePicture)

/**
 * @swagger
 * /api/v1/images/comment:
 *   post:
 *     summary: Upload comment image
 *     description: Upload an image for a comment
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Comment image file (JPEG, PNG, GIF, WebP)
 *     responses:
 *       200:
 *         description: Comment image uploaded successfully
 *       400:
 *         description: Invalid file or no file uploaded
 *       401:
 *         description: Authentication required
 */
router.post('/comment', uploadCommentImageSingle, uploadCommentImage)

/**
 * @swagger
 * /api/v1/images/delete:
 *   delete:
 *     summary: Delete image
 *     description: Delete an uploaded image file
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - imageUrl
 *             properties:
 *               imageUrl:
 *                 type: string
 *                 description: URL of the image to delete
 *     responses:
 *       200:
 *         description: Image deleted successfully
 *       400:
 *         description: Invalid image URL
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Image not found
 */
router.delete('/delete', deleteImage)

/**
 * @swagger
 * /api/v1/images/metadata:
 *   get:
 *     summary: Get image metadata
 *     description: Get metadata information about an uploaded image
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: imageUrl
 *         required: true
 *         schema:
 *           type: string
 *         description: URL of the image to get metadata for
 *     responses:
 *       200:
 *         description: Image metadata retrieved successfully
 *       400:
 *         description: Invalid image URL
 *       404:
 *         description: Image not found
 */
router.get('/metadata', getImageMetadata)

export default router
