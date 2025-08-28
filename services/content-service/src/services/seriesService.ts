import { prisma } from '../index.js'
import { redis } from '../index.js'
import logger from '../config/logger.js'

export interface SeriesFilters {
  page: number
  limit: number
  category?: string
  genre?: string
  search?: string
  featured?: boolean
  status?: 'PLANNED' | 'IN_PRODUCTION' | 'PILOT' | 'ENDED' | 'CANCELLED' | 'RETURNING_SERIES'
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

export interface CreateSeriesData {
  title: string
  description?: string
  firstAirDate?: string
  language?: string
  country?: string
  posterUrl?: string
  backdropUrl?: string
  trailerUrl?: string
  genre?: string
  creator?: string
  network?: string
  productionCompany?: string
  numberOfSeasons?: number
  numberOfEpisodes?: number
  episodeRuntime?: number[]
  status?: 'PLANNED' | 'IN_PRODUCTION' | 'PILOT' | 'ENDED' | 'CANCELLED' | 'RETURNING_SERIES'
  isAdult?: boolean
  isFeatured?: boolean
  categories?: string[]
}

export class SeriesService {
  /**
   * Get series with filtering, pagination, and sorting
   */
  static async getSeries(filters: SeriesFilters) {
    const { page, limit, category, genre, search, featured, status, sortBy, sortOrder } = filters

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {
      status: { not: 'CANCELLED' }, // Exclude cancelled series by default
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
        { creator: { contains: search, mode: 'insensitive' } },
        { network: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (featured !== undefined) {
      where.isFeatured = featured
    }

    if (status) {
      where.status = status
    }

    // Build order clause
    const orderBy: any = {}
    orderBy[sortBy] = sortOrder

    try {
      // Get series and total count
      const [series, total] = await Promise.all([
        prisma.series.findMany({
          where,
          select: {
            id: true,
            title: true,
            description: true,
            firstAirDate: true,
            lastAirDate: true,
            language: true,
            country: true,
            posterUrl: true,
            backdropUrl: true,
            trailerUrl: true,
            rating: true,
            voteCount: true,
            popularity: true,
            genre: true,
            creator: true,
            network: true,
            productionCompany: true,
            numberOfSeasons: true,
            numberOfEpisodes: true,
            episodeRuntime: true,
            status: true,
            isAdult: true,
            isFeatured: true,
            createdAt: true,
            updatedAt: true,
            categories: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            _count: {
              select: {
                seasons: true,
              },
            },
          },
          orderBy,
          skip,
          take: limit,
        }),
        prisma.series.count({ where }),
      ])

      return {
        series,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      }
    } catch (error) {
      logger.error('Error getting series:', error)
      throw new Error('Failed to retrieve series')
    }
  }

  /**
   * Get series by ID with full details
   */
  static async getSeriesById(id: string) {
    try {
      const series = await prisma.series.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          description: true,
          firstAirDate: true,
          lastAirDate: true,
          language: true,
          country: true,
          posterUrl: true,
          backdropUrl: true,
          trailerUrl: true,
          rating: true,
          voteCount: true,
          popularity: true,
          genre: true,
          creator: true,
          network: true,
          productionCompany: true,
          numberOfSeasons: true,
          numberOfEpisodes: true,
          episodeRuntime: true,
          status: true,
          isAdult: true,
          isFeatured: true,
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
          seasons: {
            select: {
              id: true,
              seasonNumber: true,
              title: true,
              description: true,
              airDate: true,
              posterUrl: true,
              episodeCount: true,
              createdAt: true,
            },
            orderBy: {
              seasonNumber: 'asc',
            },
          },
        },
      })

      return series
    } catch (error) {
      logger.error('Error getting series by ID:', error)
      throw new Error('Failed to retrieve series')
    }
  }

  /**
   * Get series seasons
   */
  static async getSeriesSeasons(seriesId: string) {
    try {
      const seasons = await prisma.seasons.findMany({
        where: { seriesId },
        select: {
          id: true,
          seasonNumber: true,
          title: true,
          description: true,
          airDate: true,
          posterUrl: true,
          episodeCount: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          seasonNumber: 'asc',
        },
      })

      return seasons
    } catch (error) {
      logger.error('Error getting series seasons:', error)
      throw new Error('Failed to retrieve series seasons')
    }
  }

  /**
   * Get series episodes (all or by season)
   */
  static async getSeriesEpisodes(seriesId: string, seasonNumber?: number) {
    try {
      const where: any = { season: { seriesId } }

      if (seasonNumber) {
        where.season = { seasonNumber }
      }

      const episodes = await prisma.episodes.findMany({
        where,
        select: {
          id: true,
          episodeNumber: true,
          title: true,
          description: true,
          airDate: true,
          duration: true,
          stillUrl: true,
          videoUrl: true,
          createdAt: true,
          updatedAt: true,
          season: {
            select: {
              id: true,
              seasonNumber: true,
              title: true,
            },
          },
        },
        orderBy: [{ season: { seasonNumber: 'asc' } }, { episodeNumber: 'asc' }],
      })

      return episodes
    } catch (error) {
      logger.error('Error getting series episodes:', error)
      throw new Error('Failed to retrieve series episodes')
    }
  }

  /**
   * Create a new series
   */
  static async createSeries(data: CreateSeriesData) {
    try {
      const {
        title,
        description,
        firstAirDate,
        language = 'en',
        country = 'US',
        posterUrl,
        backdropUrl,
        trailerUrl,
        genre,
        creator,
        network,
        productionCompany,
        numberOfSeasons = 1,
        numberOfEpisodes = 1,
        episodeRuntime = [],
        status = 'PLANNED',
        isAdult = false,
        isFeatured = false,
        categories = [],
      } = data

      // Calculate initial popularity based on various factors
      const popularity = this.calculateInitialPopularity({
        hasPoster: !!posterUrl,
        hasBackdrop: !!backdropUrl,
        hasTrailer: !!trailerUrl,
        isFeatured,
        categoryCount: categories.length,
        status,
      })

      const series = await prisma.series.create({
        data: {
          title,
          description,
          firstAirDate: firstAirDate ? new Date(firstAirDate) : null,
          language,
          country,
          posterUrl,
          backdropUrl,
          trailerUrl,
          genre,
          creator,
          network,
          productionCompany,
          numberOfSeasons,
          numberOfEpisodes,
          episodeRuntime,
          status,
          isAdult,
          isFeatured,
          popularity,
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
          firstAirDate: true,
          lastAirDate: true,
          language: true,
          country: true,
          posterUrl: true,
          backdropUrl: true,
          trailerUrl: true,
          rating: true,
          voteCount: true,
          popularity: true,
          genre: true,
          creator: true,
          network: true,
          productionCompany: true,
          numberOfSeasons: true,
          numberOfEpisodes: true,
          episodeRuntime: true,
          status: true,
          isAdult: true,
          isFeatured: true,
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

      return series
    } catch (error) {
      logger.error('Error creating series:', error)
      throw new Error('Failed to create series')
    }
  }

  /**
   * Update an existing series
   */
  static async updateSeries(id: string, data: Partial<CreateSeriesData>) {
    try {
      const {
        title,
        description,
        firstAirDate,
        language,
        country,
        posterUrl,
        backdropUrl,
        trailerUrl,
        genre,
        creator,
        network,
        productionCompany,
        numberOfSeasons,
        numberOfEpisodes,
        episodeRuntime,
        status,
        isAdult,
        isFeatured,
        categories,
      } = data

      // Check if series exists
      const existingSeries = await prisma.series.findUnique({
        where: { id },
        select: { id: true },
      })

      if (!existingSeries) {
        return null
      }

      const updateData: any = {}

      if (title !== undefined) updateData.title = title
      if (description !== undefined) updateData.description = description
      if (firstAirDate !== undefined)
        updateData.firstAirDate = firstAirDate ? new Date(firstAirDate) : null
      if (language !== undefined) updateData.language = language
      if (country !== undefined) updateData.country = country
      if (posterUrl !== undefined) updateData.posterUrl = posterUrl
      if (backdropUrl !== undefined) updateData.backdropUrl = backdropUrl
      if (trailerUrl !== undefined) updateData.trailerUrl = trailerUrl
      if (genre !== undefined) updateData.genre = genre
      if (creator !== undefined) updateData.creator = creator
      if (network !== undefined) updateData.network = network
      if (productionCompany !== undefined) updateData.productionCompany = productionCompany
      if (numberOfSeasons !== undefined) updateData.numberOfSeasons = numberOfSeasons
      if (numberOfEpisodes !== undefined) updateData.numberOfEpisodes = numberOfEpisodes
      if (episodeRuntime !== undefined) updateData.episodeRuntime = episodeRuntime
      if (status !== undefined) updateData.status = status
      if (isAdult !== undefined) updateData.isAdult = isAdult
      if (isFeatured !== undefined) updateData.isFeatured = isFeatured

      // Handle categories separately
      if (categories !== undefined) {
        updateData.categories = {
          set: [], // Clear existing categories
          connect: categories.map(id => ({ id })),
        }
      }

      const series = await prisma.series.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          title: true,
          description: true,
          firstAirDate: true,
          lastAirDate: true,
          language: true,
          country: true,
          posterUrl: true,
          backdropUrl: true,
          trailerUrl: true,
          rating: true,
          voteCount: true,
          popularity: true,
          genre: true,
          creator: true,
          network: true,
          productionCompany: true,
          numberOfSeasons: true,
          numberOfEpisodes: true,
          episodeRuntime: true,
          status: true,
          isAdult: true,
          isFeatured: true,
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

      return series
    } catch (error) {
      logger.error('Error updating series:', error)
      throw new Error('Failed to update series')
    }
  }

  /**
   * Delete a series
   */
  static async deleteSeries(id: string): Promise<boolean> {
    try {
      const result = await prisma.series.delete({
        where: { id },
      })

      return !!result
    } catch (error) {
      logger.error('Error deleting series:', error)
      throw new Error('Failed to delete series')
    }
  }

  /**
   * Get trending series based on popularity and recent activity
   */
  static async getTrendingSeries(limit: number = 10, period: 'day' | 'week' | 'month' = 'week') {
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

      const series = await prisma.series.findMany({
        where: {
          status: { in: ['IN_PRODUCTION', 'PILOT', 'RETURNING_SERIES'] },
          OR: [{ firstAirDate: { gte: startDate } }, { updatedAt: { gte: startDate } }],
        },
        select: {
          id: true,
          title: true,
          description: true,
          firstAirDate: true,
          posterUrl: true,
          backdropUrl: true,
          rating: true,
          popularity: true,
          genre: true,
          creator: true,
          network: true,
          status: true,
        },
        orderBy: [{ popularity: 'desc' }, { rating: 'desc' }],
        take: limit,
      })

      return series
    } catch (error) {
      logger.error('Error getting trending series:', error)
      throw new Error('Failed to retrieve trending series')
    }
  }

  /**
   * Update series rating and vote count
   */
  static async updateSeriesRating(id: string, newRating: number, voteCount: number) {
    try {
      const series = await prisma.series.update({
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

      // Clear series cache
      await redis.del(`series:${id}`)

      return series
    } catch (error) {
      logger.error('Error updating series rating:', error)
      throw new Error('Failed to update series rating')
    }
  }

  /**
   * Update series popularity
   */
  static async updateSeriesPopularity(id: string, popularity: number) {
    try {
      const series = await prisma.series.update({
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

      return series
    } catch (error) {
      logger.error('Error updating series popularity:', error)
      throw new Error('Failed to update series popularity')
    }
  }

  /**
   * Search series by query
   */
  static async searchSeries(query: string, limit: number = 20) {
    try {
      const series = await prisma.series.findMany({
        where: {
          status: { not: 'CANCELLED' },
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
            { creator: { contains: query, mode: 'insensitive' } },
            { network: { contains: query, mode: 'insensitive' } },
            { genre: { contains: query, mode: 'insensitive' } },
          ],
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
        orderBy: [{ popularity: 'desc' }, { rating: 'desc' }],
        take: limit,
      })

      return series
    } catch (error) {
      logger.error('Error searching series:', error)
      throw new Error('Failed to search series')
    }
  }

  /**
   * Calculate initial popularity score
   */
  private static calculateInitialPopularity(factors: {
    hasPoster: boolean
    hasBackdrop: boolean
    hasTrailer: boolean
    isFeatured: boolean
    categoryCount: number
    status: string
  }): number {
    let popularity = 0

    // Base popularity
    popularity += 10

    // Media factors
    if (factors.hasPoster) popularity += 5
    if (factors.hasBackdrop) popularity += 5
    if (factors.hasTrailer) popularity += 10

    // Featured bonus
    if (factors.isFeatured) popularity += 20

    // Category bonus
    popularity += factors.categoryCount * 2

    // Status bonus
    switch (factors.status) {
      case 'IN_PRODUCTION':
        popularity += 15
        break
      case 'PILOT':
        popularity += 25
        break
      case 'RETURNING_SERIES':
        popularity += 30
        break
    }

    return Math.max(0, Math.min(100, popularity))
  }

  /**
   * Get featured series
   */
  static async getFeaturedSeries(limit: number = 10) {
    try {
      const series = await prisma.series.findMany({
        where: {
          isFeatured: true,
          status: { not: 'CANCELLED' },
        },
        include: {
          categories: {
            include: {
              category: true,
            },
          },
        },
        orderBy: [{ popularityScore: 'desc' }, { firstAirDate: 'desc' }],
        take: limit,
      })

      // Cache the result
      const cacheKey = `featured_series_${limit}`
      await redis.setex(cacheKey, 3600, JSON.stringify(series)) // Cache for 1 hour

      logger.info(`Retrieved ${series.length} featured series`)
      return { series }
    } catch (error) {
      logger.error('Error fetching featured series:', error)
      throw error
    }
  }
}
