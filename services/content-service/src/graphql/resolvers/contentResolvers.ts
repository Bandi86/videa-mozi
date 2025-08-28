import { MoviesService } from '../../services/moviesService.js'
import { SeriesService } from '../../services/seriesService.js'
import { CategoriesService } from '../../services/categoriesService.js'
import { redis } from '../../index.js'
import logger from '../../config/logger.js'
import { GraphQLError } from 'graphql'

// Helper function to create cursor for pagination
const encodeCursor = (id: string) => Buffer.from(id).toString('base64')
const decodeCursor = (cursor: string) => Buffer.from(cursor, 'base64').toString()

// Helper function to apply pagination
const applyPagination = (items: any[], first: number = 20, after?: string) => {
  let startIndex = 0

  if (after) {
    const afterId = decodeCursor(after)
    startIndex = items.findIndex(item => item.id === afterId) + 1
  }

  const nodes = items.slice(startIndex, startIndex + first)
  const edges = nodes.map(node => ({
    node,
    cursor: encodeCursor(node.id),
  }))

  const pageInfo = {
    hasNextPage: startIndex + first < items.length,
    hasPreviousPage: startIndex > 0,
    startCursor: edges.length > 0 ? edges[0].cursor : null,
    endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null,
  }

  return {
    edges,
    pageInfo,
    totalCount: items.length,
  }
}

export const contentResolvers = {
  Query: {
    // Movie queries
    movie: async (_: any, { id }: { id: string }) => {
      try {
        return await MoviesService.getMovieById(id)
      } catch (error) {
        logger.error('GraphQL movie query error:', error)
        throw new GraphQLError('Failed to fetch movie', {
          extensions: { code: 'MOVIE_FETCH_ERROR' },
        })
      }
    },

    movies: async (_: any, { filters = {} }: { filters: any }) => {
      try {
        const {
          categoryId,
          genre,
          search,
          featured,
          sortBy = 'popularity',
          sortDirection = 'DESC',
          page = 1,
          limit = 20,
        } = filters

        const result = await MoviesService.getMovies({
          category: categoryId,
          genre,
          search,
          featured,
          sortBy,
          sortOrder: sortDirection.toLowerCase(),
          page,
          limit,
        })

        return applyPagination(result.movies, limit)
      } catch (error) {
        logger.error('GraphQL movies query error:', error)
        throw new GraphQLError('Failed to fetch movies', {
          extensions: { code: 'MOVIES_FETCH_ERROR' },
        })
      }
    },

    featuredMovies: async (_: any, { limit = 10 }: { limit: number }) => {
      try {
        const cacheKey = `graphql:featuredMovies:${limit}`
        const cached = await redis.get(cacheKey)

        if (cached) {
          return JSON.parse(cached)
        }

        const movies = await MoviesService.getFeaturedMovies(limit)
        await redis.setex(cacheKey, 900, JSON.stringify(movies)) // Cache for 15 minutes

        return movies
      } catch (error) {
        logger.error('GraphQL featured movies query error:', error)
        throw new GraphQLError('Failed to fetch featured movies', {
          extensions: { code: 'FEATURED_MOVIES_FETCH_ERROR' },
        })
      }
    },

    trendingMovies: async (
      _: any,
      { limit = 10, period = 'week' }: { limit: number; period: string },
    ) => {
      try {
        const cacheKey = `graphql:trendingMovies:${period}:${limit}`
        const cached = await redis.get(cacheKey)

        if (cached) {
          return JSON.parse(cached)
        }

        const movies = await MoviesService.getTrendingMovies(limit, period as any)
        await redis.setex(cacheKey, 1800, JSON.stringify(movies)) // Cache for 30 minutes

        return movies
      } catch (error) {
        logger.error('GraphQL trending movies query error:', error)
        throw new GraphQLError('Failed to fetch trending movies', {
          extensions: { code: 'TRENDING_MOVIES_FETCH_ERROR' },
        })
      }
    },

    searchMovies: async (_: any, { query, limit = 20 }: { query: string; limit: number }) => {
      try {
        return await MoviesService.searchMovies(query, limit)
      } catch (error) {
        logger.error('GraphQL search movies query error:', error)
        throw new GraphQLError('Failed to search movies', {
          extensions: { code: 'MOVIES_SEARCH_ERROR' },
        })
      }
    },

    // Series queries
    series: async (_: any, { id }: { id: string }) => {
      try {
        return await SeriesService.getSeriesById(id)
      } catch (error) {
        logger.error('GraphQL series query error:', error)
        throw new GraphQLError('Failed to fetch series', {
          extensions: { code: 'SERIES_FETCH_ERROR' },
        })
      }
    },

    seriesList: async (_: any, { filters = {} }: { filters: any }) => {
      try {
        const {
          categoryId,
          genre,
          search,
          featured,
          status,
          sortBy = 'popularity',
          sortDirection = 'DESC',
          page = 1,
          limit = 20,
        } = filters

        const result = await SeriesService.getSeries({
          category: categoryId,
          genre,
          search,
          featured,
          status,
          sortBy,
          sortOrder: sortDirection.toLowerCase(),
          page,
          limit,
        })

        return applyPagination(result.series, limit)
      } catch (error) {
        logger.error('GraphQL series list query error:', error)
        throw new GraphQLError('Failed to fetch series', {
          extensions: { code: 'SERIES_LIST_FETCH_ERROR' },
        })
      }
    },

    featuredSeries: async (_: any, { limit = 10 }: { limit: number }) => {
      try {
        const cacheKey = `graphql:featuredSeries:${limit}`
        const cached = await redis.get(cacheKey)

        if (cached) {
          return JSON.parse(cached)
        }

        const series = await SeriesService.getFeaturedSeries(limit)
        await redis.setex(cacheKey, 900, JSON.stringify(series))

        return series
      } catch (error) {
        logger.error('GraphQL featured series query error:', error)
        throw new GraphQLError('Failed to fetch featured series', {
          extensions: { code: 'FEATURED_SERIES_FETCH_ERROR' },
        })
      }
    },

    trendingSeries: async (
      _: any,
      { limit = 10, period = 'week' }: { limit: number; period: string },
    ) => {
      try {
        const cacheKey = `graphql:trendingSeries:${period}:${limit}`
        const cached = await redis.get(cacheKey)

        if (cached) {
          return JSON.parse(cached)
        }

        const series = await SeriesService.getTrendingSeries(limit, period as any)
        await redis.setex(cacheKey, 1800, JSON.stringify(series))

        return series
      } catch (error) {
        logger.error('GraphQL trending series query error:', error)
        throw new GraphQLError('Failed to fetch trending series', {
          extensions: { code: 'TRENDING_SERIES_FETCH_ERROR' },
        })
      }
    },

    searchSeries: async (_: any, { query, limit = 20 }: { query: string; limit: number }) => {
      try {
        return await SeriesService.searchSeries(query, limit)
      } catch (error) {
        logger.error('GraphQL search series query error:', error)
        throw new GraphQLError('Failed to search series', {
          extensions: { code: 'SERIES_SEARCH_ERROR' },
        })
      }
    },

    // Category queries
    category: async (_: any, { id }: { id: string }) => {
      try {
        return await CategoriesService.getCategoryById(id)
      } catch (error) {
        logger.error('GraphQL category query error:', error)
        throw new GraphQLError('Failed to fetch category', {
          extensions: { code: 'CATEGORY_FETCH_ERROR' },
        })
      }
    },

    categoryBySlug: async (_: any, { slug }: { slug: string }) => {
      try {
        return await CategoriesService.getCategoryBySlug(slug)
      } catch (error) {
        logger.error('GraphQL category by slug query error:', error)
        throw new GraphQLError('Failed to fetch category', {
          extensions: { code: 'CATEGORY_BY_SLUG_FETCH_ERROR' },
        })
      }
    },

    categories: async (_: any, { filters = {} }: { filters: any }) => {
      try {
        const { type, active = true, search } = filters

        return await CategoriesService.getCategories({
          type,
          active,
          search,
        })
      } catch (error) {
        logger.error('GraphQL categories query error:', error)
        throw new GraphQLError('Failed to fetch categories', {
          extensions: { code: 'CATEGORIES_FETCH_ERROR' },
        })
      }
    },

    popularCategories: async (_: any, { limit = 10 }: { limit: number }) => {
      try {
        const cacheKey = `graphql:popularCategories:${limit}`
        const cached = await redis.get(cacheKey)

        if (cached) {
          return JSON.parse(cached)
        }

        const categories = await CategoriesService.getPopularCategories(limit)
        await redis.setex(cacheKey, 1800, JSON.stringify(categories))

        return categories
      } catch (error) {
        logger.error('GraphQL popular categories query error:', error)
        throw new GraphQLError('Failed to fetch popular categories', {
          extensions: { code: 'POPULAR_CATEGORIES_FETCH_ERROR' },
        })
      }
    },

    // General queries
    contentByCategory: async (
      _: any,
      { categoryId, limit = 20, offset = 0 }: { categoryId: string; limit: number; offset: number },
    ) => {
      try {
        const result = await CategoriesService.getCategoryContent(
          categoryId,
          Math.floor(offset / limit) + 1,
          limit,
        )

        const allContent = [...result.content.movies, ...result.content.series]
        return applyPagination(allContent, limit)
      } catch (error) {
        logger.error('GraphQL content by category query error:', error)
        throw new GraphQLError('Failed to fetch content by category', {
          extensions: { code: 'CONTENT_BY_CATEGORY_FETCH_ERROR' },
        })
      }
    },

    searchContent: async (
      _: any,
      { query, type, limit = 20 }: { query: string; type?: string; limit: number },
    ) => {
      try {
        const movies = await MoviesService.searchMovies(query, limit)
        const series = await SeriesService.searchSeries(query, limit)

        let content = [...movies, ...series]

        if (type === 'MOVIE') {
          content = movies
        } else if (type === 'SERIES') {
          content = series
        }

        return applyPagination(content, limit)
      } catch (error) {
        logger.error('GraphQL search content query error:', error)
        throw new GraphQLError('Failed to search content', {
          extensions: { code: 'CONTENT_SEARCH_ERROR' },
        })
      }
    },
  },

  Mutation: {
    // Movie mutations
    createMovie: async (_: any, { input }: { input: any }) => {
      try {
        return await MoviesService.createMovie(input)
      } catch (error) {
        logger.error('GraphQL create movie mutation error:', error)
        throw new GraphQLError('Failed to create movie', {
          extensions: { code: 'MOVIE_CREATE_ERROR' },
        })
      }
    },

    updateMovie: async (_: any, { id, input }: { id: string; input: any }) => {
      try {
        const movie = await MoviesService.updateMovie(id, input)
        if (!movie) {
          throw new GraphQLError('Movie not found', {
            extensions: { code: 'MOVIE_NOT_FOUND' },
          })
        }
        return movie
      } catch (error) {
        logger.error('GraphQL update movie mutation error:', error)
        throw new GraphQLError('Failed to update movie', {
          extensions: { code: 'MOVIE_UPDATE_ERROR' },
        })
      }
    },

    deleteMovie: async (_: any, { id }: { id: string }) => {
      try {
        return await MoviesService.deleteMovie(id)
      } catch (error) {
        logger.error('GraphQL delete movie mutation error:', error)
        throw new GraphQLError('Failed to delete movie', {
          extensions: { code: 'MOVIE_DELETE_ERROR' },
        })
      }
    },

    // Series mutations
    createSeries: async (_: any, { input }: { input: any }) => {
      try {
        return await SeriesService.createSeries(input)
      } catch (error) {
        logger.error('GraphQL create series mutation error:', error)
        throw new GraphQLError('Failed to create series', {
          extensions: { code: 'SERIES_CREATE_ERROR' },
        })
      }
    },

    updateSeries: async (_: any, { id, input }: { id: string; input: any }) => {
      try {
        const series = await SeriesService.updateSeries(id, input)
        if (!series) {
          throw new GraphQLError('Series not found', {
            extensions: { code: 'SERIES_NOT_FOUND' },
          })
        }
        return series
      } catch (error) {
        logger.error('GraphQL update series mutation error:', error)
        throw new GraphQLError('Failed to update series', {
          extensions: { code: 'SERIES_UPDATE_ERROR' },
        })
      }
    },

    deleteSeries: async (_: any, { id }: { id: string }) => {
      try {
        return await SeriesService.deleteSeries(id)
      } catch (error) {
        logger.error('GraphQL delete series mutation error:', error)
        throw new GraphQLError('Failed to delete series', {
          extensions: { code: 'SERIES_DELETE_ERROR' },
        })
      }
    },

    // Category mutations
    createCategory: async (_: any, { input }: { input: any }) => {
      try {
        return await CategoriesService.createCategory(input)
      } catch (error) {
        logger.error('GraphQL create category mutation error:', error)
        throw new GraphQLError('Failed to create category', {
          extensions: { code: 'CATEGORY_CREATE_ERROR' },
        })
      }
    },

    updateCategory: async (_: any, { id, input }: { id: string; input: any }) => {
      try {
        const category = await CategoriesService.updateCategory(id, input)
        if (!category) {
          throw new GraphQLError('Category not found', {
            extensions: { code: 'CATEGORY_NOT_FOUND' },
          })
        }
        return category
      } catch (error) {
        logger.error('GraphQL update category mutation error:', error)
        throw new GraphQLError('Failed to update category', {
          extensions: { code: 'CATEGORY_UPDATE_ERROR' },
        })
      }
    },

    deleteCategory: async (_: any, { id }: { id: string }) => {
      try {
        return await CategoriesService.deleteCategory(id)
      } catch (error) {
        logger.error('GraphQL delete category mutation error:', error)
        throw new GraphQLError('Failed to delete category', {
          extensions: { code: 'CATEGORY_DELETE_ERROR' },
        })
      }
    },
  },

  // Field resolvers for complex relationships
  Movie: {
    similarMovies: async (parent: any, { limit = 5 }: { limit: number }) => {
      try {
        // Find movies with similar genre and high rating
        const similarMovies = await MoviesService.getMovies({
          genre: parent.genre,
          sortBy: 'rating',
          sortOrder: 'desc',
          page: 1,
          limit: limit + 1, // +1 to exclude the current movie
        })

        return similarMovies.movies.filter((movie: any) => movie.id !== parent.id).slice(0, limit)
      } catch (error) {
        logger.error('GraphQL similar movies resolver error:', error)
        return []
      }
    },
  },

  Series: {
    seasons: async (parent: any) => {
      try {
        return await SeriesService.getSeriesSeasons(parent.id)
      } catch (error) {
        logger.error('GraphQL seasons resolver error:', error)
        return []
      }
    },

    episodes: async (parent: any, { season }: { season?: number }) => {
      try {
        return await SeriesService.getSeriesEpisodes(parent.id, season)
      } catch (error) {
        logger.error('GraphQL episodes resolver error:', error)
        return []
      }
    },

    similarSeries: async (parent: any, { limit = 5 }: { limit: number }) => {
      try {
        // Find series with similar genre and high rating
        const similarSeries = await SeriesService.getSeries({
          genre: parent.genre,
          sortBy: 'rating',
          sortOrder: 'desc',
          page: 1,
          limit: limit + 1,
        })

        return similarSeries.series.filter((series: any) => series.id !== parent.id).slice(0, limit)
      } catch (error) {
        logger.error('GraphQL similar series resolver error:', error)
        return []
      }
    },
  },

  Category: {
    movies: async (parent: any, { limit = 20, offset = 0 }: { limit: number; offset: number }) => {
      try {
        const result = await CategoriesService.getCategoryContent(
          parent.id,
          Math.floor(offset / limit) + 1,
          limit,
        )
        return result.content.movies
      } catch (error) {
        logger.error('GraphQL category movies resolver error:', error)
        return []
      }
    },

    series: async (parent: any, { limit = 20, offset = 0 }: { limit: number; offset: number }) => {
      try {
        const result = await CategoriesService.getCategoryContent(
          parent.id,
          Math.floor(offset / limit) + 1,
          limit,
        )
        return result.content.series
      } catch (error) {
        logger.error('GraphQL category series resolver error:', error)
        return []
      }
    },

    content: async (parent: any, { limit = 20, offset = 0 }: { limit: number; offset: number }) => {
      try {
        const result = await CategoriesService.getCategoryContent(
          parent.id,
          Math.floor(offset / limit) + 1,
          limit,
        )
        const content = [...result.content.movies, ...result.content.series]
        return applyPagination(content, limit)
      } catch (error) {
        logger.error('GraphQL category content resolver error:', error)
        return {
          edges: [],
          pageInfo: { hasNextPage: false, hasPreviousPage: false },
          totalCount: 0,
        }
      }
    },
  },

  Season: {
    episodes: async (parent: any) => {
      try {
        return await SeriesService.getSeriesEpisodes(parent.seriesId, parent.seasonNumber)
      } catch (error) {
        logger.error('GraphQL season episodes resolver error:', error)
        return []
      }
    },

    series: async (parent: any) => {
      try {
        return await SeriesService.getSeriesById(parent.seriesId)
      } catch (error) {
        logger.error('GraphQL season series resolver error:', error)
        return null
      }
    },
  },

  Episode: {
    season: async (parent: any) => {
      try {
        // This would need a SeasonService method to get season by ID
        // For now, return null
        return null
      } catch (error) {
        logger.error('GraphQL episode season resolver error:', error)
        return null
      }
    },

    series: async (parent: any) => {
      try {
        // This would need to traverse through season to get series
        // For now, return null
        return null
      } catch (error) {
        logger.error('GraphQL episode series resolver error:', error)
        return null
      }
    },
  },

  // Union resolvers
  Content: {
    __resolveType(obj: any) {
      if (obj.releaseDate) {
        return 'Movie'
      }
      if (obj.firstAirDate) {
        return 'Series'
      }
      return null
    },
  },
}
