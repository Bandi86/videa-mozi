import express, { Request, Response } from 'express'
import { body, param, query, validationResult } from 'express-validator'
// import { prisma } from '../index.js' // Not used in this route
import { redis } from '../index.js'
import logger, { logCategoryEvent } from '../config/logger.js'
import { CategoriesService } from '../services/categoriesService.js'

const router = express.Router()

/**
 * @swagger
 * /api/v1/categories:
 *   get:
 *     summary: Get all categories
 *     tags: [Categories]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [MOVIE, SERIES, BOTH]
 *       - in: query
 *         name: active
 *         schema:
 *           type: boolean
 *           default: true
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Categories retrieved successfully
 */
router.get(
  '/',
  [
    query('type')
      .optional()
      .isIn(['MOVIE', 'SERIES', 'BOTH'])
      .withMessage('Type must be MOVIE, SERIES, or BOTH'),
    query('active').optional().isBoolean().withMessage('Active must be a boolean'),
    query('search').optional().isString().withMessage('Search must be a string'),
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
        type: req.query.type as 'MOVIE' | 'SERIES' | 'BOTH',
        active: req.query.active === undefined ? true : req.query.active === 'true',
        search: req.query.search as string,
      }

      const categories = await CategoriesService.getCategories(filters)

      res.json(categories)
    } catch (error) {
      logger.error('Get categories error:', error)
      res.status(500).json({
        error: 'Categories retrieval failed',
        message: 'An error occurred while retrieving categories.',
      })
    }
  },
)

/**
 * @swagger
 * /api/v1/categories/{id}:
 *   get:
 *     summary: Get category by ID
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Category retrieved successfully
 *       404:
 *         description: Category not found
 */
router.get(
  '/:id',
  [param('id').isString().notEmpty().withMessage('Category ID is required')],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation error',
          details: errors.array(),
        })
      }

      const categoryId = req.params.id

      const category = await CategoriesService.getCategoryById(categoryId)

      if (!category) {
        return res.status(404).json({
          error: 'Category not found',
          message: 'The requested category could not be found.',
        })
      }

      res.json(category)
    } catch (error) {
      logger.error('Get category error:', error)
      res.status(500).json({
        error: 'Category retrieval failed',
        message: 'An error occurred while retrieving the category.',
      })
    }
  },
)

/**
 * @swagger
 * /api/v1/categories/{id}/content:
 *   get:
 *     summary: Get content by category
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
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
 *     responses:
 *       200:
 *         description: Content retrieved successfully
 */
router.get(
  '/:id/content',
  [
    param('id').isString().notEmpty().withMessage('Category ID is required'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
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

      const categoryId = req.params.id
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 20

      const result = await CategoriesService.getCategoryContent(categoryId, page, limit)

      res.json(result)
    } catch (error) {
      logger.error('Get category content error:', error)
      res.status(500).json({
        error: 'Category content retrieval failed',
        message: 'An error occurred while retrieving category content.',
      })
    }
  },
)

/**
 * @swagger
 * /api/v1/categories:
 *   post:
 *     summary: Create a new category
 *     tags: [Categories]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - type
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [MOVIE, SERIES, BOTH]
 *               posterUrl:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Category created successfully
 *       400:
 *         description: Validation error
 */
router.post(
  '/',
  [
    body('name')
      .isString()
      .isLength({ min: 1, max: 100 })
      .withMessage('Name is required and must be less than 100 characters'),
    body('description')
      .optional()
      .isString()
      .isLength({ max: 500 })
      .withMessage('Description must be less than 500 characters'),
    body('type')
      .isIn(['MOVIE', 'SERIES', 'BOTH'])
      .withMessage('Type must be MOVIE, SERIES, or BOTH'),
    body('posterUrl').optional().isURL().withMessage('Poster URL must be a valid URL'),
    body('isActive').optional().isBoolean().withMessage('Is active must be a boolean'),
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

      const categoryData = req.body

      const category = await CategoriesService.createCategory(categoryData)

      logCategoryEvent('CATEGORY_CREATED', category.id, {
        name: category.name,
        type: category.type,
        createdBy: req.user?.id,
      })

      res.status(201).json({
        message: 'Category created successfully',
        category,
      })
    } catch (error) {
      logger.error('Create category error:', error)
      res.status(500).json({
        error: 'Category creation failed',
        message: 'An error occurred while creating the category.',
      })
    }
  },
)

/**
 * @swagger
 * /api/v1/categories/{id}:
 *   put:
 *     summary: Update category
 *     tags: [Categories]
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
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               posterUrl:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Category updated successfully
 *       404:
 *         description: Category not found
 */
router.put(
  '/:id',
  [
    param('id').isString().notEmpty().withMessage('Category ID is required'),
    body('name')
      .optional()
      .isString()
      .isLength({ min: 1, max: 100 })
      .withMessage('Name must be less than 100 characters'),
    body('description')
      .optional()
      .isString()
      .isLength({ max: 500 })
      .withMessage('Description must be less than 500 characters'),
    body('posterUrl').optional().isURL().withMessage('Poster URL must be a valid URL'),
    body('isActive').optional().isBoolean().withMessage('Is active must be a boolean'),
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

      const categoryId = req.params.id
      const updateData = req.body

      const category = await CategoriesService.updateCategory(categoryId, updateData)

      if (!category) {
        return res.status(404).json({
          error: 'Category not found',
          message: 'The requested category could not be found.',
        })
      }

      logCategoryEvent('CATEGORY_UPDATED', category.id, {
        name: category.name,
        updatedBy: req.user?.id,
      })

      res.json({
        message: 'Category updated successfully',
        category,
      })
    } catch (error) {
      logger.error('Update category error:', error)
      res.status(500).json({
        error: 'Category update failed',
        message: 'An error occurred while updating the category.',
      })
    }
  },
)

/**
 * @swagger
 * /api/v1/categories/{id}:
 *   delete:
 *     summary: Delete category
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Category deleted successfully
 *       404:
 *         description: Category not found
 */
router.delete(
  '/:id',
  [param('id').isString().notEmpty().withMessage('Category ID is required')],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation error',
          details: errors.array(),
        })
      }

      const categoryId = req.params.id

      const success = await CategoriesService.deleteCategory(categoryId)

      if (!success) {
        return res.status(404).json({
          error: 'Category not found',
          message: 'The requested category could not be found.',
        })
      }

      logCategoryEvent('CATEGORY_DELETED', categoryId, {
        deletedBy: req.user?.id,
      })

      res.json({
        message: 'Category deleted successfully',
      })
    } catch (error) {
      logger.error('Delete category error:', error)
      res.status(500).json({
        error: 'Category deletion failed',
        message: 'An error occurred while deleting the category.',
      })
    }
  },
)

/**
 * @swagger
 * /api/v1/categories/popular:
 *   get:
 *     summary: Get popular categories
 *     tags: [Categories]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 20
 *           default: 10
 *     responses:
 *       200:
 *         description: Popular categories retrieved successfully
 */
router.get(
  '/popular',
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 20 })
      .withMessage('Limit must be between 1 and 20'),
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

      const cacheKey = `categories:popular:${limit}`
      const cachedCategories = await redis.get(cacheKey)
      if (cachedCategories) {
        return res.json(JSON.parse(cachedCategories))
      }

      const categories = await CategoriesService.getPopularCategories(limit)

      // Cache for 30 minutes
      await redis.setex(cacheKey, 1800, JSON.stringify(categories))

      res.json(categories)
    } catch (error) {
      logger.error('Get popular categories error:', error)
      res.status(500).json({
        error: 'Popular categories retrieval failed',
        message: 'An error occurred while retrieving popular categories.',
      })
    }
  },
)

export { router as categoriesRouter }
