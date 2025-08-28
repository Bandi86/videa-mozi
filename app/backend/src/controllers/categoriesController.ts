import { Request, Response } from 'express'
import { createCategorySchema, updateCategorySchema } from '../validators/socialValidators.js'
import { CategoriesService } from '../services/categoriesService.js'
import { getUserId, handleControllerError } from '../utils/common.js'

// ============================================================================
// CATEGORY CRUD OPERATIONS (ADMIN ONLY)
// ============================================================================

// Create a new category
const createCategory = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const validatedData = createCategorySchema.parse(req.body)

    const category = await CategoriesService.createCategory(userId, validatedData)

    res.status(201).json({
      message: 'Category created successfully',
      category,
    })
  } catch (error) {
    handleControllerError(error, res, 'create category', getUserId(req))
  }
}

// Update a category
const updateCategory = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const categoryId = parseInt(req.params.id)
    const validatedData = updateCategorySchema.parse(req.body)

    const category = await CategoriesService.updateCategory(userId, categoryId, validatedData)

    res.json({
      message: 'Category updated successfully',
      category,
    })
  } catch (error) {
    handleControllerError(error, res, 'update category', getUserId(req))
  }
}

// Delete a category
const deleteCategory = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const categoryId = parseInt(req.params.id)

    const result = await CategoriesService.deleteCategory(userId, categoryId)

    res.json(result)
  } catch (error) {
    handleControllerError(error, res, 'delete category', getUserId(req))
  }
}

// ============================================================================
// CATEGORY READ OPERATIONS (PUBLIC)
// ============================================================================

// Get all categories
const getCategories = async (req: Request, res: Response) => {
  try {
    const categories = await CategoriesService.getCategories()

    res.json({ categories })
  } catch (error) {
    handleControllerError(error, res, 'get categories')
  }
}

// Get a single category by ID
const getCategoryById = async (req: Request, res: Response) => {
  try {
    const categoryId = parseInt(req.params.id)
    const category = await CategoriesService.getCategoryById(categoryId)

    res.json({ category })
  } catch (error) {
    handleControllerError(error, res, 'get category by ID')
  }
}

// ============================================================================
// CATEGORY ADDITIONAL OPERATIONS
// ============================================================================

// Get categories with pagination and filtering
const getCategoriesPaginated = async (req: Request, res: Response) => {
  try {
    const filters = req.query
    const result = await CategoriesService.getCategoriesPaginated(filters)

    res.json(result)
  } catch (error) {
    handleControllerError(error, res, 'get categories paginated')
  }
}

// Get category statistics
const getCategoryStats = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const stats = await CategoriesService.getCategoryStats()

    res.json({ stats })
  } catch (error) {
    handleControllerError(error, res, 'get category stats', getUserId(req))
  }
}

// Search categories
const searchCategories = async (req: Request, res: Response) => {
  try {
    const { q: query, limit = 10 } = req.query
    const categories = await CategoriesService.searchCategories(
      query as string,
      parseInt(limit as string),
    )

    res.json({ categories })
  } catch (error) {
    handleControllerError(error, res, 'search categories')
  }
}

export {
  createCategory,
  updateCategory,
  deleteCategory,
  getCategories,
  getCategoryById,
  getCategoriesPaginated,
  getCategoryStats,
  searchCategories,
}
