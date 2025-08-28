import { prisma } from '../index.js'
import { redis } from '../index.js'
import logger from '../config/logger.js'

export interface CategoryFilters {
  type?: 'MOVIE' | 'SERIES' | 'BOTH'
  active: boolean
  search?: string
}

export interface CreateCategoryData {
  name: string
  description?: string
  type: 'MOVIE' | 'SERIES' | 'BOTH'
  posterUrl?: string
  isActive?: boolean
}

export class CategoriesService {
  /**
   * Get categories with filtering
   */
  static async getCategories(filters: CategoryFilters) {
    const { type, active, search } = filters

    const where: any = {}

    if (type) {
      where.type = type
    }

    if (active !== undefined) {
      where.isActive = active
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    try {
      const categories = await prisma.categories.findMany({
        where,
        select: {
          id: true,
          name: true,
          description: true,
          slug: true,
          type: true,
          posterUrl: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              movies: true,
              series: true,
            },
          },
        },
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      })

      return categories
    } catch (error) {
      logger.error('Error getting categories:', error)
      throw new Error('Failed to retrieve categories')
    }
  }

  /**
   * Get category by ID with full details
   */
  static async getCategoryById(id: string) {
    try {
      const category = await prisma.categories.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          description: true,
          slug: true,
          type: true,
          posterUrl: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              movies: true,
              series: true,
            },
          },
        },
      })

      return category
    } catch (error) {
      logger.error('Error getting category by ID:', error)
      throw new Error('Failed to retrieve category')
    }
  }

  /**
   * Get category by slug
   */
  static async getCategoryBySlug(slug: string) {
    try {
      const category = await prisma.categories.findUnique({
        where: { slug },
        select: {
          id: true,
          name: true,
          description: true,
          slug: true,
          type: true,
          posterUrl: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              movies: true,
              series: true,
            },
          },
        },
      })

      return category
    } catch (error) {
      logger.error('Error getting category by slug:', error)
      throw new Error('Failed to retrieve category')
    }
  }

  /**
   * Get content by category with pagination
   */
  static async getCategoryContent(categoryId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit

    try {
      // Get category info first
      const category = await prisma.categories.findUnique({
        where: { id: categoryId },
        select: {
          id: true,
          name: true,
          type: true,
        },
      })

      if (!category) {
        throw new Error('Category not found')
      }

      let movies = []
      let series = []
      let totalMovies = 0
      let totalSeries = 0

      // Get movies if category type allows
      if (category.type === 'MOVIE' || category.type === 'BOTH') {
        const [moviesData, moviesCount] = await Promise.all([
          prisma.movies.findMany({
            where: {
              categories: {
                some: { id: categoryId },
              },
              status: 'RELEASED',
            },
            select: {
              id: true,
              title: true,
              description: true,
              releaseDate: true,
              posterUrl: true,
              rating: true,
              popularity: true,
              genre: true,
              director: true,
            },
            orderBy: {
              popularity: 'desc',
            },
            skip,
            take: limit,
          }),
          prisma.movies.count({
            where: {
              categories: {
                some: { id: categoryId },
              },
              status: 'RELEASED',
            },
          }),
        ])

        movies = moviesData
        totalMovies = moviesCount
      }

      // Get series if category type allows
      if (category.type === 'SERIES' || category.type === 'BOTH') {
        const [seriesData, seriesCount] = await Promise.all([
          prisma.series.findMany({
            where: {
              categories: {
                some: { id: categoryId },
              },
              status: { not: 'CANCELLED' },
            },
            select: {
              id: true,
              title: true,
              description: true,
              firstAirDate: true,
              posterUrl: true,
              rating: true,
              popularity: true,
              genre: true,
              creator: true,
              network: true,
              status: true,
            },
            orderBy: {
              popularity: 'desc',
            },
            skip,
            take: limit,
          }),
          prisma.series.count({
            where: {
              categories: {
                some: { id: categoryId },
              },
              status: { not: 'CANCELLED' },
            },
          }),
        ])

        series = seriesData
        totalSeries = seriesCount
      }

      return {
        category,
        content: {
          movies,
          series,
        },
        pagination: {
          page,
          limit,
          totalMovies,
          totalSeries,
          totalContent: totalMovies + totalSeries,
          pages: Math.ceil((totalMovies + totalSeries) / limit),
        },
      }
    } catch (error) {
      logger.error('Error getting category content:', error)
      throw new Error('Failed to retrieve category content')
    }
  }

  /**
   * Create a new category
   */
  static async createCategory(data: CreateCategoryData) {
    try {
      const { name, description, type, posterUrl, isActive = true } = data

      // Generate slug from name
      const slug = this.generateSlug(name)

      // Check if slug already exists
      const existingCategory = await prisma.categories.findUnique({
        where: { slug },
      })

      if (existingCategory) {
        throw new Error('Category with this name already exists')
      }

      const category = await prisma.categories.create({
        data: {
          name,
          description,
          slug,
          type,
          posterUrl,
          isActive,
        },
        select: {
          id: true,
          name: true,
          description: true,
          slug: true,
          type: true,
          posterUrl: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              movies: true,
              series: true,
            },
          },
        },
      })

      return category
    } catch (error) {
      logger.error('Error creating category:', error)
      throw new Error('Failed to create category')
    }
  }

  /**
   * Update an existing category
   */
  static async updateCategory(id: string, data: Partial<CreateCategoryData>) {
    try {
      const { name, description, posterUrl, isActive } = data

      const updateData: any = {}

      if (name !== undefined) {
        updateData.name = name
        updateData.slug = this.generateSlug(name)
      }
      if (description !== undefined) updateData.description = description
      if (posterUrl !== undefined) updateData.posterUrl = posterUrl
      if (isActive !== undefined) updateData.isActive = isActive

      const category = await prisma.categories.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          name: true,
          description: true,
          slug: true,
          type: true,
          posterUrl: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              movies: true,
              series: true,
            },
          },
        },
      })

      return category
    } catch (error) {
      logger.error('Error updating category:', error)
      throw new Error('Failed to update category')
    }
  }

  /**
   * Delete a category
   */
  static async deleteCategory(id: string): Promise<boolean> {
    try {
      // Check if category has associated content
      const category = await prisma.categories.findUnique({
        where: { id },
        select: {
          _count: {
            select: {
              movies: true,
              series: true,
            },
          },
        },
      })

      if (!category) {
        return false
      }

      // Don't allow deletion if category has content
      if (category._count.movies > 0 || category._count.series > 0) {
        throw new Error('Cannot delete category with associated content')
      }

      await prisma.categories.delete({
        where: { id },
      })

      return true
    } catch (error) {
      logger.error('Error deleting category:', error)
      throw new Error('Failed to delete category')
    }
  }

  /**
   * Get popular categories based on content count and engagement
   */
  static async getPopularCategories(limit: number = 10) {
    try {
      const categories = await prisma.categories.findMany({
        where: {
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          description: true,
          slug: true,
          type: true,
          posterUrl: true,
          _count: {
            select: {
              movies: true,
              series: true,
            },
          },
        },
        orderBy: [{ movies: { _count: 'desc' } }, { series: { _count: 'desc' } }],
        take: limit,
      })

      // Calculate popularity score for each category
      const categoriesWithScore = categories.map(category => ({
        ...category,
        popularityScore: category._count.movies * 2 + category._count.series * 3,
        totalContent: category._count.movies + category._count.series,
      }))

      // Sort by popularity score
      categoriesWithScore.sort((a, b) => b.popularityScore - a.popularityScore)

      return categoriesWithScore
    } catch (error) {
      logger.error('Error getting popular categories:', error)
      throw new Error('Failed to retrieve popular categories')
    }
  }

  /**
   * Get category statistics
   */
  static async getCategoryStats() {
    try {
      const [totalCategories, activeCategories, movieCategories, seriesCategories, bothCategories] =
        await Promise.all([
          prisma.categories.count(),
          prisma.categories.count({ where: { isActive: true } }),
          prisma.categories.count({ where: { type: 'MOVIE' } }),
          prisma.categories.count({ where: { type: 'SERIES' } }),
          prisma.categories.count({ where: { type: 'BOTH' } }),
        ])

      return {
        totalCategories,
        activeCategories,
        inactiveCategories: totalCategories - activeCategories,
        byType: {
          movie: movieCategories,
          series: seriesCategories,
          both: bothCategories,
        },
      }
    } catch (error) {
      logger.error('Error getting category stats:', error)
      throw new Error('Failed to retrieve category statistics')
    }
  }

  /**
   * Generate URL-friendly slug from category name
   */
  private static generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
      .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
  }
}
