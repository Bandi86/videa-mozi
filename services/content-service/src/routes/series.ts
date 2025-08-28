import express, { Request, Response } from 'express'
import { body, param, query, validationResult } from 'express-validator'
import { prisma } from '../index.js'
import { redis } from '../index.js'
import logger, { logContentEvent } from '../config/logger.js'
import { SeriesService } from '../services/seriesService.js'

const router = express.Router()

/**
 * @swagger
 * /api/v1/series:
 *   get:
 *     summary: Get all series
 *     tags: [Series]
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
 *           default: 20
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: genre
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: featured
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PLANNED, IN_PRODUCTION, PILOT, ENDED, CANCELLED, RETURNING_SERIES]
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [title, firstAirDate, rating, popularity, createdAt]
 *           default: popularity
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Series retrieved successfully
 */
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('category').optional().isString().withMessage('Category must be a string'),
    query('genre').optional().isString().withMessage('Genre must be a string'),
    query('search').optional().isString().withMessage('Search must be a string'),
    query('featured').optional().isBoolean().withMessage('Featured must be a boolean'),
    query('status')
      .optional()
      .isIn(['PLANNED', 'IN_PRODUCTION', 'PILOT', 'ENDED', 'CANCELLED', 'RETURNING_SERIES'])
      .withMessage('Invalid status'),
    query('sortBy')
      .optional()
      .isIn(['title', 'firstAirDate', 'rating', 'popularity', 'createdAt'])
      .withMessage('Invalid sort field'),
    query('sortOrder')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('Sort order must be asc or desc'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation error',
          details: errors.array(),
        })
      }

      const filters = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        category: req.query.category as string,
        genre: req.query.genre as string,
        search: req.query.search as string,
        featured: req.query.featured === 'true' ? true : undefined,
        status: req.query.status as any,
        sortBy: (req.query.sortBy as string) || 'popularity',
        sortOrder: ((req.query.sortOrder as string) || 'desc') as 'asc' | 'desc',
      }

      const result = await SeriesService.getSeries(filters)

      // Cache popular series for 5 minutes
      if (filters.page === 1 && !filters.search && !filters.category) {
        await redis.setex('series:popular', 300, JSON.stringify(result))
      }

      res.json(result)
    } catch (error) {
      logger.error('Get series error:', error)
      res.status(500).json({
        error: 'Series retrieval failed',
        message: 'An error occurred while retrieving series.',
      })
    }
  },
)

/**
 * @swagger
 * /api/v1/series/{id}:
 *   get:
 *     summary: Get series by ID
 *     tags: [Series]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Series retrieved successfully
 *       404:
 *         description: Series not found
 */
router.get(
  '/:id',
  [param('id').isString().notEmpty().withMessage('Series ID is required')],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation error',
          details: errors.array(),
        })
      }

      const seriesId = req.params.id

      // Try cache first
      const cachedSeries = await redis.get(`series:${seriesId}`)
      if (cachedSeries) {
        return res.json(JSON.parse(cachedSeries))
      }

      const series = await SeriesService.getSeriesById(seriesId)

      if (!series) {
        return res.status(404).json({
          error: 'Series not found',
          message: 'The requested series could not be found.',
        })
      }

      // Cache for 10 minutes
      await redis.setex(`series:${seriesId}`, 600, JSON.stringify(series))

      res.json(series)
    } catch (error) {
      logger.error('Get series error:', error)
      res.status(500).json({
        error: 'Series retrieval failed',
        message: 'An error occurred while retrieving the series.',
      })
    }
  },
)

/**
 * @swagger
 * /api/v1/series/{id}/seasons:
 *   get:
 *     summary: Get series seasons
 *     tags: [Series]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Seasons retrieved successfully
 */
router.get(
  '/:id/seasons',
  [param('id').isString().notEmpty().withMessage('Series ID is required')],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation error',
          details: errors.array(),
        })
      }

      const seriesId = req.params.id
      const seasons = await SeriesService.getSeriesSeasons(seriesId)

      res.json(seasons)
    } catch (error) {
      logger.error('Get series seasons error:', error)
      res.status(500).json({
        error: 'Series seasons retrieval failed',
        message: 'An error occurred while retrieving series seasons.',
      })
    }
  },
)

/**
 * @swagger
 * /api/v1/series/{id}/episodes:
 *   get:
 *     summary: Get series episodes
 *     tags: [Series]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: season
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Episodes retrieved successfully
 */
router.get(
  '/:id/episodes',
  [
    param('id').isString().notEmpty().withMessage('Series ID is required'),
    query('season').optional().isInt({ min: 1 }).withMessage('Season must be a positive integer'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation error',
          details: errors.array(),
        })
      }

      const seriesId = req.params.id
      const seasonNumber = req.query.season ? parseInt(req.query.season as string) : undefined

      const episodes = await SeriesService.getSeriesEpisodes(seriesId, seasonNumber)

      res.json(episodes)
    } catch (error) {
      logger.error('Get series episodes error:', error)
      res.status(500).json({
        error: 'Series episodes retrieval failed',
        message: 'An error occurred while retrieving series episodes.',
      })
    }
  },
)

/**
 * @swagger
 * /api/v1/series:
 *   post:
 *     summary: Create a new series
 *     tags: [Series]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               firstAirDate:
 *                 type: string
 *                 format: date
 *               language:
 *                 type: string
 *               country:
 *                 type: string
 *               posterUrl:
 *                 type: string
 *               backdropUrl:
 *                 type: string
 *               trailerUrl:
 *                 type: string
 *               genre:
 *                 type: string
 *               creator:
 *                 type: string
 *               network:
 *                 type: string
 *               productionCompany:
 *                 type: string
 *               numberOfSeasons:
 *                 type: integer
 *               numberOfEpisodes:
 *                 type: integer
 *               episodeRuntime:
 *                 type: array
 *                 items:
 *                   type: integer
 *               status:
 *                 type: string
 *                 enum: [PLANNED, IN_PRODUCTION, PILOT, ENDED, CANCELLED, RETURNING_SERIES]
 *               isAdult:
 *                 type: boolean
 *               isFeatured:
 *                 type: boolean
 *               categories:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Series created successfully
 */
router.post(
  '/',
  [
    body('title')
      .isString()
      .isLength({ min: 1, max: 500 })
      .withMessage('Title is required and must be less than 500 characters'),
    body('description')
      .optional()
      .isString()
      .isLength({ max: 2000 })
      .withMessage('Description must be less than 2000 characters'),
    body('firstAirDate')
      .optional()
      .isISO8601()
      .withMessage('First air date must be a valid ISO date'),
    body('language')
      .optional()
      .isString()
      .isLength({ min: 2, max: 2 })
      .withMessage('Language must be a 2-letter code'),
    body('country')
      .optional()
      .isString()
      .isLength({ min: 2, max: 2 })
      .withMessage('Country must be a 2-letter code'),
    body('posterUrl').optional().isURL().withMessage('Poster URL must be a valid URL'),
    body('backdropUrl').optional().isURL().withMessage('Backdrop URL must be a valid URL'),
    body('trailerUrl').optional().isURL().withMessage('Trailer URL must be a valid URL'),
    body('genre').optional().isString().withMessage('Genre must be a string'),
    body('creator').optional().isString().withMessage('Creator must be a string'),
    body('network').optional().isString().withMessage('Network must be a string'),
    body('productionCompany')
      .optional()
      .isString()
      .withMessage('Production company must be a string'),
    body('numberOfSeasons')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Number of seasons must be a positive integer'),
    body('numberOfEpisodes')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Number of episodes must be a positive integer'),
    body('episodeRuntime').optional().isArray().withMessage('Episode runtime must be an array'),
    body('episodeRuntime.*')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Episode runtime must be positive integers'),
    body('status')
      .optional()
      .isIn(['PLANNED', 'IN_PRODUCTION', 'PILOT', 'ENDED', 'CANCELLED', 'RETURNING_SERIES'])
      .withMessage('Invalid status'),
    body('isAdult').optional().isBoolean().withMessage('Is adult must be a boolean'),
    body('isFeatured').optional().isBoolean().withMessage('Is featured must be a boolean'),
    body('categories').optional().isArray().withMessage('Categories must be an array'),
    body('categories.*').optional().isString().withMessage('Category IDs must be strings'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation error',
          details: errors.array(),
        })
      }

      const seriesData = req.body

      const series = await SeriesService.createSeries(seriesData)

      // Clear popular series cache
      await redis.del('series:popular')

      logContentEvent('SERIES_CREATED', 'series', series.id, {
        title: series.title,
        createdBy: req.user?.id,
      })

      res.status(201).json({
        message: 'Series created successfully',
        series,
      })
    } catch (error) {
      logger.error('Create series error:', error)
      res.status(500).json({
        error: 'Series creation failed',
        message: 'An error occurred while creating the series.',
      })
    }
  },
)

/**
 * @swagger
 * /api/v1/series/{id}:
 *   put:
 *     summary: Update series
 *     tags: [Series]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               firstAirDate:
 *                 type: string
 *                 format: date
 *               language:
 *                 type: string
 *               country:
 *                 type: string
 *               posterUrl:
 *                 type: string
 *               backdropUrl:
 *                 type: string
 *               trailerUrl:
 *                 type: string
 *               genre:
 *                 type: string
 *               creator:
 *                 type: string
 *               network:
 *                 type: string
 *               productionCompany:
 *                 type: string
 *               numberOfSeasons:
 *                 type: integer
 *               numberOfEpisodes:
 *                 type: integer
 *               episodeRuntime:
 *                 type: array
 *                 items:
 *                   type: integer
 *               status:
 *                 type: string
 *                 enum: [PLANNED, IN_PRODUCTION, PILOT, ENDED, CANCELLED, RETURNING_SERIES]
 *               isAdult:
 *                 type: boolean
 *               isFeatured:
 *                 type: boolean
 *               categories:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Series updated successfully
 *       404:
 *         description: Series not found
 */
router.put(
  '/:id',
  [
    param('id').isString().notEmpty().withMessage('Series ID is required'),
    body('title')
      .optional()
      .isString()
      .isLength({ min: 1, max: 500 })
      .withMessage('Title must be less than 500 characters'),
    body('description')
      .optional()
      .isString()
      .isLength({ max: 2000 })
      .withMessage('Description must be less than 2000 characters'),
    body('firstAirDate')
      .optional()
      .isISO8601()
      .withMessage('First air date must be a valid ISO date'),
    body('language')
      .optional()
      .isString()
      .isLength({ min: 2, max: 2 })
      .withMessage('Language must be a 2-letter code'),
    body('country')
      .optional()
      .isString()
      .isLength({ min: 2, max: 2 })
      .withMessage('Country must be a 2-letter code'),
    body('posterUrl').optional().isURL().withMessage('Poster URL must be a valid URL'),
    body('backdropUrl').optional().isURL().withMessage('Backdrop URL must be a valid URL'),
    body('trailerUrl').optional().isURL().withMessage('Trailer URL must be a valid URL'),
    body('genre').optional().isString().withMessage('Genre must be a string'),
    body('creator').optional().isString().withMessage('Creator must be a string'),
    body('network').optional().isString().withMessage('Network must be a string'),
    body('productionCompany')
      .optional()
      .isString()
      .withMessage('Production company must be a string'),
    body('numberOfSeasons')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Number of seasons must be a positive integer'),
    body('numberOfEpisodes')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Number of episodes must be a positive integer'),
    body('episodeRuntime').optional().isArray().withMessage('Episode runtime must be an array'),
    body('episodeRuntime.*')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Episode runtime must be positive integers'),
    body('status')
      .optional()
      .isIn(['PLANNED', 'IN_PRODUCTION', 'PILOT', 'ENDED', 'CANCELLED', 'RETURNING_SERIES'])
      .withMessage('Invalid status'),
    body('isAdult').optional().isBoolean().withMessage('Is adult must be a boolean'),
    body('isFeatured').optional().isBoolean().withMessage('Is featured must be a boolean'),
    body('categories').optional().isArray().withMessage('Categories must be an array'),
    body('categories.*').optional().isString().withMessage('Category IDs must be strings'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation error',
          details: errors.array(),
        })
      }

      const seriesId = req.params.id
      const updateData = req.body

      const series = await SeriesService.updateSeries(seriesId, updateData)

      if (!series) {
        return res.status(404).json({
          error: 'Series not found',
          message: 'The requested series could not be found.',
        })
      }

      // Clear caches
      await redis.del(`series:${seriesId}`)
      await redis.del('series:popular')

      logContentEvent('SERIES_UPDATED', 'series', series.id, {
        title: series.title,
        updatedBy: req.user?.id,
      })

      res.json({
        message: 'Series updated successfully',
        series,
      })
    } catch (error) {
      logger.error('Update series error:', error)
      res.status(500).json({
        error: 'Series update failed',
        message: 'An error occurred while updating the series.',
      })
    }
  },
)

/**
 * @swagger
 * /api/v1/series/{id}:
 *   delete:
 *     summary: Delete series
 *     tags: [Series]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Series deleted successfully
 *       404:
 *         description: Series not found
 */
router.delete(
  '/:id',
  [param('id').isString().notEmpty().withMessage('Series ID is required')],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation error',
          details: errors.array(),
        })
      }

      const seriesId = req.params.id

      const success = await SeriesService.deleteSeries(seriesId)

      if (!success) {
        return res.status(404).json({
          error: 'Series not found',
          message: 'The requested series could not be found.',
        })
      }

      // Clear caches
      await redis.del(`series:${seriesId}`)
      await redis.del('series:popular')

      logContentEvent('SERIES_DELETED', 'series', seriesId, {
        deletedBy: req.user?.id,
      })

      res.json({
        message: 'Series deleted successfully',
      })
    } catch (error) {
      logger.error('Delete series error:', error)
      res.status(500).json({
        error: 'Series deletion failed',
        message: 'An error occurred while deleting the series.',
      })
    }
  },
)

/**
 * @swagger
 * /api/v1/series/trending:
 *   get:
 *     summary: Get trending series
 *     tags: [Series]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *           default: week
 *     responses:
 *       200:
 *         description: Trending series retrieved successfully
 */
router.get(
  '/trending',
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50'),
    query('period')
      .optional()
      .isIn(['day', 'week', 'month'])
      .withMessage('Period must be day, week, or month'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation error',
          details: errors.array(),
        })
      }

      const limit = parseInt(req.query.limit as string) || 10
      const period = (req.query.period as string) || 'week'

      const cacheKey = `series:trending:${period}:${limit}`
      const cachedTrending = await redis.get(cacheKey)
      if (cachedTrending) {
        return res.json(JSON.parse(cachedTrending))
      }

      const series = await SeriesService.getTrendingSeries(limit, period as any)

      // Cache for 30 minutes
      await redis.setex(cacheKey, 1800, JSON.stringify(series))

      res.json(series)
    } catch (error) {
      logger.error('Get trending series error:', error)
      res.status(500).json({
        error: 'Trending series retrieval failed',
        message: 'An error occurred while retrieving trending series.',
      })
    }
  },
)

export { router as seriesRouter }
