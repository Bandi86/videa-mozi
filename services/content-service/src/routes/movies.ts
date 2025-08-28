import express, { Request, Response } from 'express'
import { body, param, query, validationResult } from 'express-validator'
// import { prisma } from '../index.js' // Not used in this route
import { redis } from '../index.js'
import logger, { logContentEvent } from '../config/logger.js'
import { MoviesService } from '../services/moviesService.js'

const router = express.Router()

/**
 * @swagger
 * /api/v1/movies:
 *   get:
 *     summary: Get all movies
 *     tags: [Movies]
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
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [title, releaseDate, rating, popularity, createdAt]
 *           default: popularity
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Movies retrieved successfully
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
    query('sortBy')
      .optional()
      .isIn(['title', 'releaseDate', 'rating', 'popularity', 'createdAt'])
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
        sortBy: (req.query.sortBy as string) || 'popularity',
        sortOrder: ((req.query.sortOrder as string) || 'desc') as 'asc' | 'desc',
      }

      const result = await MoviesService.getMovies(filters)

      // Cache popular movies for 5 minutes
      if (filters.page === 1 && !filters.search && !filters.category) {
        await redis.setex('movies:popular', 300, JSON.stringify(result))
      }

      res.json(result)
    } catch (error) {
      logger.error('Get movies error:', error)
      res.status(500).json({
        error: 'Movies retrieval failed',
        message: 'An error occurred while retrieving movies.',
      })
    }
  },
)

/**
 * @swagger
 * /api/v1/movies/{id}:
 *   get:
 *     summary: Get movie by ID
 *     tags: [Movies]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Movie retrieved successfully
 *       404:
 *         description: Movie not found
 */
router.get(
  '/:id',
  [param('id').isString().notEmpty().withMessage('Movie ID is required')],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation error',
          details: errors.array(),
        })
      }

      const movieId = req.params.id

      // Try cache first
      const cachedMovie = await redis.get(`movie:${movieId}`)
      if (cachedMovie) {
        return res.json(JSON.parse(cachedMovie))
      }

      const movie = await MoviesService.getMovieById(movieId)

      if (!movie) {
        return res.status(404).json({
          error: 'Movie not found',
          message: 'The requested movie could not be found.',
        })
      }

      // Cache for 10 minutes
      await redis.setex(`movie:${movieId}`, 600, JSON.stringify(movie))

      res.json(movie)
    } catch (error) {
      logger.error('Get movie error:', error)
      res.status(500).json({
        error: 'Movie retrieval failed',
        message: 'An error occurred while retrieving the movie.',
      })
    }
  },
)

/**
 * @swagger
 * /api/v1/movies:
 *   post:
 *     summary: Create a new movie
 *     tags: [Movies]
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
 *               releaseDate:
 *                 type: string
 *                 format: date
 *               duration:
 *                 type: integer
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
 *               videoUrl:
 *                 type: string
 *               genre:
 *                 type: string
 *               director:
 *                 type: string
 *               cast:
 *                 type: array
 *                 items:
 *                   type: string
 *               productionCompany:
 *                 type: string
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
 *         description: Movie created successfully
 *       400:
 *         description: Validation error
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
    body('releaseDate').optional().isISO8601().withMessage('Release date must be a valid ISO date'),
    body('duration')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Duration must be a positive integer'),
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
    body('videoUrl').optional().isURL().withMessage('Video URL must be a valid URL'),
    body('genre').optional().isString().withMessage('Genre must be a string'),
    body('director').optional().isString().withMessage('Director must be a string'),
    body('cast').optional().isArray().withMessage('Cast must be an array'),
    body('cast.*').optional().isString().withMessage('Cast members must be strings'),
    body('productionCompany')
      .optional()
      .isString()
      .withMessage('Production company must be a string'),
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

      const movieData = req.body

      const movie = await MoviesService.createMovie(movieData)

      // Clear popular movies cache
      await redis.del('movies:popular')

      logContentEvent('MOVIE_CREATED', 'movie', movie.id, {
        title: movie.title,
        createdBy: req.user?.id,
      })

      res.status(201).json({
        message: 'Movie created successfully',
        movie,
      })
    } catch (error) {
      logger.error('Create movie error:', error)
      res.status(500).json({
        error: 'Movie creation failed',
        message: 'An error occurred while creating the movie.',
      })
    }
  },
)

/**
 * @swagger
 * /api/v1/movies/{id}:
 *   put:
 *     summary: Update movie
 *     tags: [Movies]
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
 *               releaseDate:
 *                 type: string
 *                 format: date
 *               duration:
 *                 type: integer
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
 *               videoUrl:
 *                 type: string
 *               genre:
 *                 type: string
 *               director:
 *                 type: string
 *               cast:
 *                 type: array
 *                 items:
 *                   type: string
 *               productionCompany:
 *                 type: string
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
 *         description: Movie updated successfully
 *       404:
 *         description: Movie not found
 */
router.put(
  '/:id',
  [
    param('id').isString().notEmpty().withMessage('Movie ID is required'),
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
    body('releaseDate').optional().isISO8601().withMessage('Release date must be a valid ISO date'),
    body('duration')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Duration must be a positive integer'),
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
    body('videoUrl').optional().isURL().withMessage('Video URL must be a valid URL'),
    body('genre').optional().isString().withMessage('Genre must be a string'),
    body('director').optional().isString().withMessage('Director must be a string'),
    body('cast').optional().isArray().withMessage('Cast must be an array'),
    body('cast.*').optional().isString().withMessage('Cast members must be strings'),
    body('productionCompany')
      .optional()
      .isString()
      .withMessage('Production company must be a string'),
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

      const movieId = req.params.id
      const updateData = req.body

      const movie = await MoviesService.updateMovie(movieId, updateData)

      if (!movie) {
        return res.status(404).json({
          error: 'Movie not found',
          message: 'The requested movie could not be found.',
        })
      }

      // Clear caches
      await redis.del(`movie:${movieId}`)
      await redis.del('movies:popular')

      logContentEvent('MOVIE_UPDATED', 'movie', movie.id, {
        title: movie.title,
        updatedBy: req.user?.id,
      })

      res.json({
        message: 'Movie updated successfully',
        movie,
      })
    } catch (error) {
      logger.error('Update movie error:', error)
      res.status(500).json({
        error: 'Movie update failed',
        message: 'An error occurred while updating the movie.',
      })
    }
  },
)

/**
 * @swagger
 * /api/v1/movies/{id}:
 *   delete:
 *     summary: Delete movie
 *     tags: [Movies]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Movie deleted successfully
 *       404:
 *         description: Movie not found
 */
router.delete(
  '/:id',
  [param('id').isString().notEmpty().withMessage('Movie ID is required')],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation error',
          details: errors.array(),
        })
      }

      const movieId = req.params.id

      const success = await MoviesService.deleteMovie(movieId)

      if (!success) {
        return res.status(404).json({
          error: 'Movie not found',
          message: 'The requested movie could not be found.',
        })
      }

      // Clear caches
      await redis.del(`movie:${movieId}`)
      await redis.del('movies:popular')

      logContentEvent('MOVIE_DELETED', 'movie', movieId, {
        deletedBy: req.user?.id,
      })

      res.json({
        message: 'Movie deleted successfully',
      })
    } catch (error) {
      logger.error('Delete movie error:', error)
      res.status(500).json({
        error: 'Movie deletion failed',
        message: 'An error occurred while deleting the movie.',
      })
    }
  },
)

/**
 * @swagger
 * /api/v1/movies/featured:
 *   get:
 *     summary: Get featured movies
 *     tags: [Movies]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *     responses:
 *       200:
 *         description: Featured movies retrieved successfully
 */
router.get(
  '/featured',
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50'),
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

      // Try cache first
      const cachedFeatured = await redis.get('movies:featured')
      if (cachedFeatured) {
        return res.json(JSON.parse(cachedFeatured))
      }

      const movies = await MoviesService.getFeaturedMovies(limit)

      // Cache for 15 minutes
      await redis.setex('movies:featured', 900, JSON.stringify(movies))

      res.json(movies)
    } catch (error) {
      logger.error('Get featured movies error:', error)
      res.status(500).json({
        error: 'Featured movies retrieval failed',
        message: 'An error occurred while retrieving featured movies.',
      })
    }
  },
)

/**
 * @swagger
 * /api/v1/movies/trending:
 *   get:
 *     summary: Get trending movies
 *     tags: [Movies]
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
 *         description: Trending movies retrieved successfully
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

      const cacheKey = `movies:trending:${period}:${limit}`
      const cachedTrending = await redis.get(cacheKey)
      if (cachedTrending) {
        return res.json(JSON.parse(cachedTrending))
      }

      const movies = await MoviesService.getTrendingMovies(limit, period as any)

      // Cache for 30 minutes
      await redis.setex(cacheKey, 1800, JSON.stringify(movies))

      res.json(movies)
    } catch (error) {
      logger.error('Get trending movies error:', error)
      res.status(500).json({
        error: 'Trending movies retrieval failed',
        message: 'An error occurred while retrieving trending movies.',
      })
    }
  },
)

export { router as moviesRouter }
