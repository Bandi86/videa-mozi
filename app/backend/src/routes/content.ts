import express from 'express'
import {
  createContent,
  updateContent,
  getContent,
  getContentById,
  deleteContent,
  createContentComment,
  getContentComments,
  createContentLike,
  deleteContentLike,
  getContentLikes,
  createContentShare,
  getContentShares,
  createContentReport,
  updateContentReport,
  getContentReports,
} from '../controllers/contentController.js'
import { authenticateToken } from '../middlewares/auth.js'
import {
  generalRateLimit,
  createRateLimit,
  updateRateLimit,
  adminRateLimit,
} from '../middlewares/rateLimit.js'
import { requestSizeLimiter, sanitizeInput } from '../middlewares/security.js'
import { validationMiddleware } from '../middlewares/validation.js'
import {
  createContentSchema,
  updateContentSchema,
  getContentSchema,
  createContentCommentSchema,
  getContentCommentsSchema,
  createContentLikeSchema,
  createContentShareSchema,
  createContentReportSchema,
  updateContentReportSchema,
  getContentReportsSchema,
  contentIdParamSchema,
  contentCommentIdParamSchema,
} from '../validators/contentValidators.js'

/**
 * @swagger
 * tags:
 *   name: Content
 *   description: Content management endpoints for movies and series
 */

const router = express.Router()

// Public routes (no auth required)
router.get('/', generalRateLimit, validationMiddleware(getContentSchema), getContent)
router.get(
  '/:contentId',
  generalRateLimit,
  validationMiddleware(contentIdParamSchema),
  getContentById,
)
router.get(
  '/:contentId/comments',
  generalRateLimit,
  validationMiddleware(getContentCommentsSchema),
  getContentComments,
)
router.get(
  '/:contentId/likes',
  generalRateLimit,
  validationMiddleware(contentIdParamSchema),
  getContentLikes,
)
router.get(
  '/:contentId/shares',
  generalRateLimit,
  validationMiddleware(contentIdParamSchema),
  getContentShares,
)

// Apply auth middleware to protected routes
router.use(authenticateToken)
router.use(requestSizeLimiter)
router.use(sanitizeInput)

/**
 * @swagger
 * /api/v1/content:
 *   post:
 *     summary: Create new content (movie or series)
 *     description: Creates a new movie or series entry with comprehensive metadata
 *     tags: [Content]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - genre
 *               - type
 *               - language
 *               - country
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 255
 *               description:
 *                 type: string
 *                 maxLength: 2000
 *               image:
 *                 type: string
 *                 format: uri
 *               trailer:
 *                 type: string
 *                 format: uri
 *               rating:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 10
 *               releaseDate:
 *                 type: string
 *                 format: date-time
 *               genre:
 *                 type: string
 *                 maxLength: 100
 *               type:
 *                 type: string
 *                 enum: [MOVIE, SERIES]
 *               duration:
 *                 type: integer
 *                 minimum: 1
 *               language:
 *                 type: string
 *                 maxLength: 50
 *               country:
 *                 type: string
 *                 maxLength: 100
 *               seasons:
 *                 type: integer
 *                 minimum: 1
 *               episodes:
 *                 type: integer
 *                 minimum: 1
 *               episodeDuration:
 *                 type: integer
 *                 minimum: 1
 *               isFeatured:
 *                 type: boolean
 *               isTrending:
 *                 type: boolean
 *               isNew:
 *                 type: boolean
 *               isPopular:
 *                 type: boolean
 *               isTopRated:
 *                 type: boolean
 *               isUpcoming:
 *                 type: boolean
 *               isNowPlaying:
 *                 type: boolean
 *               isComingSoon:
 *                 type: boolean
 *               isInTheaters:
 *                 type: boolean
 *               streamingPlatforms:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [NETFLIX, HULU, AMAZON_PRIME, HBO_MAX, SHOWTIME, STARZ, HGTV, DISCOVERY_PLUS, PEACOCK, APPLE_TV, DISNEY_PLUS, YOUTUBE, OTHER]
 *     responses:
 *       201:
 *         description: Content created successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Authentication required
 */
router.post('/', createRateLimit, validationMiddleware(createContentSchema), createContent)

/**
 * @swagger
 * /api/v1/content/{contentId}:
 *   put:
 *     summary: Update content
 *     description: Updates an existing movie or series entry
 *     tags: [Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 255
 *               description:
 *                 type: string
 *                 maxLength: 2000
 *               image:
 *                 type: string
 *                 format: uri
 *               trailer:
 *                 type: string
 *                 format: uri
 *               rating:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 10
 *               releaseDate:
 *                 type: string
 *                 format: date-time
 *               genre:
 *                 type: string
 *                 maxLength: 100
 *               duration:
 *                 type: integer
 *                 minimum: 1
 *               language:
 *                 type: string
 *                 maxLength: 50
 *               country:
 *                 type: string
 *                 maxLength: 100
 *               seasons:
 *                 type: integer
 *                 minimum: 1
 *               episodes:
 *                 type: integer
 *                 minimum: 1
 *               episodeDuration:
 *                 type: integer
 *                 minimum: 1
 *               isFeatured:
 *                 type: boolean
 *               isTrending:
 *                 type: boolean
 *               isNew:
 *                 type: boolean
 *               isPopular:
 *                 type: boolean
 *               isTopRated:
 *                 type: boolean
 *               isUpcoming:
 *                 type: boolean
 *               isNowPlaying:
 *                 type: boolean
 *               isComingSoon:
 *                 type: boolean
 *               isInTheaters:
 *                 type: boolean
 *               streamingPlatforms:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [NETFLIX, HULU, AMAZON_PRIME, HBO_MAX, SHOWTIME, STARZ, HGTV, DISCOVERY_PLUS, PEACOCK, APPLE_TV, DISNEY_PLUS, YOUTUBE, OTHER]
 *     responses:
 *       200:
 *         description: Content updated successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient privileges
 *       404:
 *         description: Content not found
 */
router.put(
  '/:contentId',
  updateRateLimit,
  validationMiddleware(contentIdParamSchema),
  validationMiddleware(updateContentSchema),
  updateContent,
)

/**
 * @swagger
 * /api/v1/content/{contentId}:
 *   delete:
 *     summary: Delete content
 *     description: Soft deletes a movie or series entry (sets status to DELETED)
 *     tags: [Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Content deleted successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient privileges
 *       404:
 *         description: Content not found
 */
router.delete(
  '/:contentId',
  updateRateLimit,
  validationMiddleware(contentIdParamSchema),
  deleteContent,
)

/**
 * @swagger
 * /api/v1/content/{contentId}/comments:
 *   post:
 *     summary: Create a comment on content
 *     description: Creates a new comment on a movie or series
 *     tags: [Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *               - contentId
 *             properties:
 *               content:
 *                 type: string
 *                 maxLength: 2000
 *               contentId:
 *                 type: string
 *                 format: uuid
 *               parentId:
 *                 type: integer
 *               imageUrl:
 *                 type: string
 *                 format: uri
 *     responses:
 *       201:
 *         description: Comment created successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Content not found
 */
router.post(
  '/:contentId/comments',
  createRateLimit,
  validationMiddleware(contentIdParamSchema),
  validationMiddleware(createContentCommentSchema),
  createContentComment,
)

/**
 * @swagger
 * /api/v1/content/{contentId}/likes:
 *   post:
 *     summary: Like content
 *     description: Likes a movie or series
 *     tags: [Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - contentId
 *             properties:
 *               contentId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       201:
 *         description: Content liked successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Content not found
 *       409:
 *         description: Content already liked
 */
router.post(
  '/:contentId/likes',
  createRateLimit,
  validationMiddleware(contentIdParamSchema),
  validationMiddleware(createContentLikeSchema),
  createContentLike,
)

/**
 * @swagger
 * /api/v1/content/{contentId}/likes:
 *   delete:
 *     summary: Unlike content
 *     description: Removes a like from a movie or series
 *     tags: [Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Content unliked successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Like not found
 */
router.delete(
  '/:contentId/likes',
  updateRateLimit,
  validationMiddleware(contentIdParamSchema),
  deleteContentLike,
)

/**
 * @swagger
 * /api/v1/content/{contentId}/shares:
 *   post:
 *     summary: Share content
 *     description: Shares a movie or series
 *     tags: [Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - contentId
 *             properties:
 *               contentId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       201:
 *         description: Content shared successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Content not found
 *       409:
 *         description: Content already shared
 */
router.post(
  '/:contentId/shares',
  createRateLimit,
  validationMiddleware(contentIdParamSchema),
  validationMiddleware(createContentShareSchema),
  createContentShare,
)

/**
 * @swagger
 * /api/v1/content/{contentId}/reports:
 *   post:
 *     summary: Report content
 *     description: Reports inappropriate content or comments
 *     tags: [Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - reason
 *             properties:
 *               contentId:
 *                 type: string
 *                 format: uuid
 *               commentId:
 *                 type: integer
 *               type:
 *                 type: string
 *                 enum: [SPAM, HARASSMENT, INAPPROPRIATE_CONTENT, COPYRIGHT_VIOLATION, OTHER]
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *               description:
 *                 type: string
 *                 maxLength: 2000
 *     responses:
 *       201:
 *         description: Report created successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Content not found
 */
router.post(
  '/:contentId/reports',
  createRateLimit,
  validationMiddleware(contentIdParamSchema),
  validationMiddleware(createContentReportSchema),
  createContentReport,
)

/**
 * @swagger
 * /api/v1/content/reports:
 *   get:
 *     summary: Get content reports (Admin only)
 *     description: Retrieves content reports for moderation - Admin privileges required
 *     tags: [Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *       - in: query
 *         name: contentId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: commentId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [SPAM, HARASSMENT, INAPPROPRIATE_CONTENT, COPYRIGHT_VIOLATION, OTHER]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, REVIEWED, RESOLVED, DISMISSED]
 *     responses:
 *       200:
 *         description: Reports retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin privileges required
 */
router.get(
  '/reports',
  adminRateLimit,
  validationMiddleware(getContentReportsSchema),
  getContentReports,
)

/**
 * @swagger
 * /api/v1/content/reports/{id}:
 *   put:
 *     summary: Update content report (Admin only)
 *     description: Updates the status of a content report - Admin privileges required
 *     tags: [Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [PENDING, REVIEWED, RESOLVED, DISMISSED]
 *               description:
 *                 type: string
 *                 maxLength: 2000
 *     responses:
 *       200:
 *         description: Report updated successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin privileges required
 *       404:
 *         description: Report not found
 */
router.put(
  '/reports/:id',
  adminRateLimit,
  validationMiddleware(updateContentReportSchema),
  updateContentReport,
)

export default router
