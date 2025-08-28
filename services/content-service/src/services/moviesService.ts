import { prisma } from '../index.js'
import { redis } from '../index.js'
import logger from '../config/logger.js'

export interface MovieFilters {
  page: number
  limit: number
  category?: string
  genre?: string
  search?: string
  featured?: boolean
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

export interface CreateMovieData {
  title: string
  description?: string
  releaseDate?: string
  duration?: number
  language?: string
  country?: string
  posterUrl?: string
  backdropUrl?: string
  trailerUrl?: string
  videoUrl?: string
  genre?: string
  director?: string
  cast?: string[]
  productionCompany?: string
  isAdult?: boolean
  isFeatured?: boolean
  categories?: string[]
}

export class MoviesService {
  /**
   * Get movies with filtering, pagination, and sorting
   */
  static async getMovies(filters: MovieFilters) {
    const { page, limit, category, genre, search, featured, sortBy, sortOrder } = filters

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {
      status: 'RELEASED', // Only show released movies by default
    }

    if (category) {
      where.categories = {
        some: {
          id: category,
        },
      }
    }

    if (genre) {
      where.genre = {
        contains: genre,
        mode: 'insensitive',
      }
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { director: { contains: search, mode: 'insensitive' } },
        { cast: { hasSome: [search] } },
      ]
    }

    if (featured !== undefined) {
      where.isFeatured = featured
    }

    // Build order clause
    const orderBy: any = {}
    orderBy[sortBy] = sortOrder

    try {
      // Get movies and total count
      const [movies, total] = await Promise.all([
        prisma.movies.findMany({
          where,
          select: {
            id: true,
            title: true,
            description: true,
            releaseDate: true,
            duration: true,
            language: true,
            country: true,
            posterUrl: true,
            backdropUrl: true,
            trailerUrl: true,
            rating: true,
            voteCount: true,
            popularity: true,
            genre: true,
            director: true,
            cast: true,
            productionCompany: true,
            isAdult: true,
            isFeatured: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            categories: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
          orderBy,
          skip,
          take: limit,
        }),
        prisma.movies.count({ where }),
      ])

      return {
        movies,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      }
    } catch (error) {
      logger.error('Error getting movies:', error)
      throw new Error('Failed to retrieve movies')
    }
  }

  /**
   * Get movie by ID with full details
   */
  static async getMovieById(id: string) {
    try {
      const movie = await prisma.movies.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          description: true,
          releaseDate: true,
          duration: true,
          language: true,
          country: true,
          posterUrl: true,
          backdropUrl: true,
          trailerUrl: true,
          videoUrl: true,
          rating: true,
          voteCount: true,
          popularity: true,
          genre: true,
          director: true,
          cast: true,
          productionCompany: true,
          isAdult: true,
          isFeatured: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          categories: {
            select: {
              id: true,
              name: true,
              slug: true,
              description: true,
            },
          },
        },
      })

      return movie
    } catch (error) {
      logger.error('Error getting movie by ID:', error)
      throw new Error('Failed to retrieve movie')
    }
  }

  /**
   * Create a new movie
   */
  static async createMovie(data: CreateMovieData) {
    try {
      const {
        title,
        description,
        releaseDate,
        duration,
        language = 'en',
        country = 'US',
        posterUrl,
        backdropUrl,
        trailerUrl,
        videoUrl,
        genre,
        director,
        cast = [],
        productionCompany,
        isAdult = false,
        isFeatured = false,
        categories = [],
      } = data

      // Calculate initial popularity based on various factors
      const popularity = this.calculateInitialPopularity({
        hasPoster: !!posterUrl,
        hasBackdrop: !!backdropUrl,
        hasTrailer: !!trailerUrl,
        hasVideo: !!videoUrl,
        isFeatured,
        categoryCount: categories.length,
      })

      const movie = await prisma.movies.create({
        data: {
          title,
          description,
          releaseDate: releaseDate ? new Date(releaseDate) : null,
          duration,
          language,
          country,
          posterUrl,
          backdropUrl,
          trailerUrl,
          videoUrl,
          genre,
          director,
          cast,
          productionCompany,
          isAdult,
          isFeatured,
          popularity,
          status: 'DRAFT',
          categories:
            categories.length > 0
              ? {
                  connect: categories.map(id => ({ id })),
                }
              : undefined,
        },
        select: {
          id: true,
          title: true,
          description: true,
          releaseDate: true,
          duration: true,
          language: true,
          country: true,
          posterUrl: true,
          backdropUrl: true,
          trailerUrl: true,
          videoUrl: true,
          rating: true,
          voteCount: true,
          popularity: true,
          genre: true,
          director: true,
          cast: true,
          productionCompany: true,
          isAdult: true,
          isFeatured: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          categories: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      })

      return movie
    } catch (error) {
      logger.error('Error creating movie:', error)
      throw new Error('Failed to create movie')
    }
  }

  /**
   * Update an existing movie
   */
  static async updateMovie(id: string, data: Partial<CreateMovieData>) {
    try {
      const {
        title,
        description,
        releaseDate,
        duration,
        language,
        country,
        posterUrl,
        backdropUrl,
        trailerUrl,
        videoUrl,
        genre,
        director,
        cast,
        productionCompany,
        isAdult,
        isFeatured,
        categories,
      } = data

      // Check if movie exists
      const existingMovie = await prisma.movies.findUnique({
        where: { id },
        select: { id: true },
      })

      if (!existingMovie) {
        return null
      }

      const updateData: any = {}

      if (title !== undefined) updateData.title = title
      if (description !== undefined) updateData.description = description
      if (releaseDate !== undefined)
        updateData.releaseDate = releaseDate ? new Date(releaseDate) : null
      if (duration !== undefined) updateData.duration = duration
      if (language !== undefined) updateData.language = language
      if (country !== undefined) updateData.country = country
      if (posterUrl !== undefined) updateData.posterUrl = posterUrl
      if (backdropUrl !== undefined) updateData.backdropUrl = backdropUrl
      if (trailerUrl !== undefined) updateData.trailerUrl = trailerUrl
      if (videoUrl !== undefined) updateData.videoUrl = videoUrl
      if (genre !== undefined) updateData.genre = genre
      if (director !== undefined) updateData.director = director
      if (cast !== undefined) updateData.cast = cast
      if (productionCompany !== undefined) updateData.productionCompany = productionCompany
      if (isAdult !== undefined) updateData.isAdult = isAdult
      if (isFeatured !== undefined) updateData.isFeatured = isFeatured

      // Handle categories separately
      if (categories !== undefined) {
        updateData.categories = {
          set: [], // Clear existing categories
          connect: categories.map(id => ({ id })),
        }
      }

      const movie = await prisma.movies.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          title: true,
          description: true,
          releaseDate: true,
          duration: true,
          language: true,
          country: true,
          posterUrl: true,
          backdropUrl: true,
          trailerUrl: true,
          videoUrl: true,
          rating: true,
          voteCount: true,
          popularity: true,
          genre: true,
          director: true,
          cast: true,
          productionCompany: true,
          isAdult: true,
          isFeatured: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          categories: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      })

      return movie
    } catch (error) {
      logger.error('Error updating movie:', error)
      throw new Error('Failed to update movie')
    }
  }

  /**
   * Delete a movie
   */
  static async deleteMovie(id: string): Promise<boolean> {
    try {
      const result = await prisma.movies.delete({
        where: { id },
      })

      return !!result
    } catch (error) {
      logger.error('Error deleting movie:', error)
      throw new Error('Failed to delete movie')
    }
  }

  /**
   * Get featured movies
   */
  static async getFeaturedMovies(limit: number = 10) {
    try {
      const movies = await prisma.movies.findMany({
        where: {
          isFeatured: true,
          status: 'RELEASED',
        },
        select: {
          id: true,
          title: true,
          description: true,
          releaseDate: true,
          posterUrl: true,
          backdropUrl: true,
          rating: true,
          popularity: true,
          genre: true,
          director: true,
        },
        orderBy: {
          popularity: 'desc',
        },
        take: limit,
      })

      return movies
    } catch (error) {
      logger.error('Error getting featured movies:', error)
      throw new Error('Failed to retrieve featured movies')
    }
  }

  /**
   * Get trending movies based on popularity and recent activity
   */
  static async getTrendingMovies(limit: number = 10, period: 'day' | 'week' | 'month' = 'week') {
    try {
      // Calculate date based on period
      const now = new Date()
      let startDate: Date

      switch (period) {
        case 'day':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
          break
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
      }

      const movies = await prisma.movies.findMany({
        where: {
          status: 'RELEASED',
          OR: [{ releaseDate: { gte: startDate } }, { updatedAt: { gte: startDate } }],
        },
        select: {
          id: true,
          title: true,
          description: true,
          releaseDate: true,
          posterUrl: true,
          backdropUrl: true,
          rating: true,
          popularity: true,
          genre: true,
          director: true,
        },
        orderBy: [{ popularity: 'desc' }, { rating: 'desc' }],
        take: limit,
      })

      return movies
    } catch (error) {
      logger.error('Error getting trending movies:', error)
      throw new Error('Failed to retrieve trending movies')
    }
  }

  /**
   * Update movie rating and vote count
   */
  static async updateMovieRating(id: string, newRating: number, voteCount: number) {
    try {
      const movie = await prisma.movies.update({
        where: { id },
        data: {
          rating: newRating,
          voteCount: voteCount,
        },
        select: {
          id: true,
          title: true,
          rating: true,
          voteCount: true,
        },
      })

      // Clear movie cache
      await redis.del(`movie:${id}`)

      return movie
    } catch (error) {
      logger.error('Error updating movie rating:', error)
      throw new Error('Failed to update movie rating')
    }
  }

  /**
   * Update movie popularity
   */
  static async updateMoviePopularity(id: string, popularity: number) {
    try {
      const movie = await prisma.movies.update({
        where: { id },
        data: {
          popularity,
        },
        select: {
          id: true,
          title: true,
          popularity: true,
        },
      })

      return movie
    } catch (error) {
      logger.error('Error updating movie popularity:', error)
      throw new Error('Failed to update movie popularity')
    }
  }

  /**
   * Search movies by query
   */
  static async searchMovies(query: string, limit: number = 20) {
    try {
      const movies = await prisma.movies.findMany({
        where: {
          status: 'RELEASED',
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
            { director: { contains: query, mode: 'insensitive' } },
            { cast: { hasSome: [query] } },
            { genre: { contains: query, mode: 'insensitive' } },
          ],
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
        orderBy: [{ popularity: 'desc' }, { rating: 'desc' }],
        take: limit,
      })

      return movies
    } catch (error) {
      logger.error('Error searching movies:', error)
      throw new Error('Failed to search movies')
    }
  }

  /**
   * Calculate initial popularity score
   */
  private static calculateInitialPopularity(factors: {
    hasPoster: boolean
    hasBackdrop: boolean
    hasTrailer: boolean
    hasVideo: boolean
    isFeatured: boolean
    categoryCount: number
  }): number {
    let popularity = 0

    // Base popularity
    popularity += 10

    // Media factors
    if (factors.hasPoster) popularity += 5
    if (factors.hasBackdrop) popularity += 5
    if (factors.hasTrailer) popularity += 10
    if (factors.hasVideo) popularity += 15

    // Featured bonus
    if (factors.isFeatured) popularity += 20

    // Category bonus
    popularity += factors.categoryCount * 2

    return Math.max(0, Math.min(100, popularity))
  }
}
