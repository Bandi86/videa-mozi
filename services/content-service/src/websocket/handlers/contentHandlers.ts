import { redis } from '../../index.js'
import logger from '../../config/logger.js'
import { MoviesService } from '../../services/moviesService.js'
import { SeriesService } from '../../services/seriesService.js'
import { CategoriesService } from '../../services/categoriesService.js'
import { requireAuthentication } from '../middleware/auth.js'

/**
 * Content-related WebSocket event handlers
 * Handles real-time content updates, ratings, and user interactions
 */
export const contentHandlers = (socket: any, io: any) => {
  const user = socket.data.user
  const isAuthenticated = socket.data.authenticated

  // Movie rating updates
  socket.on('movie:rate', async (data: { movieId: string; rating: number }) => {
    try {
      if (!isAuthenticated) {
        socket.emit('error', { message: 'Authentication required' })
        return
      }

      const { movieId, rating } = data

      // Validate rating (1-10)
      if (rating < 1 || rating > 10) {
        socket.emit('error', { message: 'Rating must be between 1 and 10' })
        return
      }

      // Get current movie data
      const movie = await MoviesService.getMovieById(movieId)
      if (!movie) {
        socket.emit('error', { message: 'Movie not found' })
        return
      }

      // Calculate new rating (simple average for demo)
      const newVoteCount = (movie.voteCount || 0) + 1
      const currentRating = movie.rating || 0
      const newRating = (currentRating * (newVoteCount - 1) + rating) / newVoteCount

      // Update movie rating
      await MoviesService.updateMovieRating(movieId, newRating, newVoteCount)

      // Broadcast rating update to all clients viewing this movie
      io.to(`movie:${movieId}`).emit('movie:rating:updated', {
        movieId,
        newRating: Math.round(newRating * 10) / 10,
        newVoteCount,
        userId: user.id,
        timestamp: new Date().toISOString(),
      })

      // Send confirmation to user
      socket.emit('movie:rated', {
        movieId,
        rating,
        newRating: Math.round(newRating * 10) / 10,
        timestamp: new Date().toISOString(),
      })

      logger.info(`⭐ Movie rated: ${movieId} by ${user.username} - Rating: ${rating}`)
    } catch (error) {
      logger.error('Movie rating error:', error)
      socket.emit('error', { message: 'Failed to rate movie' })
    }
  })

  // Series rating updates
  socket.on('series:rate', async (data: { seriesId: string; rating: number }) => {
    try {
      if (!isAuthenticated) {
        socket.emit('error', { message: 'Authentication required' })
        return
      }

      const { seriesId, rating } = data

      if (rating < 1 || rating > 10) {
        socket.emit('error', { message: 'Rating must be between 1 and 10' })
        return
      }

      const series = await SeriesService.getSeriesById(seriesId)
      if (!series) {
        socket.emit('error', { message: 'Series not found' })
        return
      }

      const newVoteCount = (series.voteCount || 0) + 1
      const currentRating = series.rating || 0
      const newRating = (currentRating * (newVoteCount - 1) + rating) / newVoteCount

      await SeriesService.updateSeriesRating(seriesId, newRating, newVoteCount)

      io.to(`series:${seriesId}`).emit('series:rating:updated', {
        seriesId,
        newRating: Math.round(newRating * 10) / 10,
        newVoteCount,
        userId: user.id,
        timestamp: new Date().toISOString(),
      })

      socket.emit('series:rated', {
        seriesId,
        rating,
        newRating: Math.round(newRating * 10) / 10,
        timestamp: new Date().toISOString(),
      })

      logger.info(`⭐ Series rated: ${seriesId} by ${user.username} - Rating: ${rating}`)
    } catch (error) {
      logger.error('Series rating error:', error)
      socket.emit('error', { message: 'Failed to rate series' })
    }
  })

  // Join movie room for real-time updates
  socket.on('movie:join', (movieId: string) => {
    socket.join(`movie:${movieId}`)
    socket.emit('movie:joined', { movieId })

    // Send current viewers count
    const room = io.sockets.adapter.rooms.get(`movie:${movieId}`)
    const viewersCount = room ? room.size : 0

    io.to(`movie:${movieId}`).emit('movie:viewers', {
      movieId,
      count: viewersCount,
    })

    logger.info(`🎬 User joined movie room: ${movieId} (${viewersCount} viewers)`)
  })

  // Leave movie room
  socket.on('movie:leave', (movieId: string) => {
    socket.leave(`movie:${movieId}`)
    socket.emit('movie:left', { movieId })

    const room = io.sockets.adapter.rooms.get(`movie:${movieId}`)
    const viewersCount = room ? room.size : 0

    io.to(`movie:${movieId}`).emit('movie:viewers', {
      movieId,
      count: viewersCount,
    })

    logger.info(`🎬 User left movie room: ${movieId} (${viewersCount} viewers)`)
  })

  // Join series room
  socket.on('series:join', (seriesId: string) => {
    socket.join(`series:${seriesId}`)
    socket.emit('series:joined', { seriesId })

    const room = io.sockets.adapter.rooms.get(`series:${seriesId}`)
    const viewersCount = room ? room.size : 0

    io.to(`series:${seriesId}`).emit('series:viewers', {
      seriesId,
      count: viewersCount,
    })

    logger.info(`📺 User joined series room: ${seriesId} (${viewersCount} viewers)`)
  })

  // Leave series room
  socket.on('series:leave', (seriesId: string) => {
    socket.leave(`series:${seriesId}`)
    socket.emit('series:left', { seriesId })

    const room = io.sockets.adapter.rooms.get(`series:${seriesId}`)
    const viewersCount = room ? room.size : 0

    io.to(`series:${seriesId}`).emit('series:viewers', {
      seriesId,
      count: viewersCount,
    })

    logger.info(`📺 User left series room: ${seriesId} (${viewersCount} viewers)`)
  })

  // Join category room
  socket.on('category:join', (categoryId: string) => {
    socket.join(`category:${categoryId}`)
    socket.emit('category:joined', { categoryId })
    logger.info(`🏷️  User joined category room: ${categoryId}`)
  })

  // Leave category room
  socket.on('category:leave', (categoryId: string) => {
    socket.leave(`category:${categoryId}`)
    socket.emit('category:left', { categoryId })
    logger.info(`🏷️  User left category room: ${categoryId}`)
  })

  // Content search with real-time results
  socket.on('content:search', async (query: string) => {
    try {
      if (!query || query.length < 2) {
        socket.emit('content:search:results', { results: [] })
        return
      }

      // Search movies and series
      const [movies, series] = await Promise.all([
        MoviesService.searchMovies(query, 5),
        SeriesService.searchSeries(query, 5),
      ])

      const results = {
        movies,
        series,
        query,
        timestamp: new Date().toISOString(),
      }

      socket.emit('content:search:results', results)
    } catch (error) {
      logger.error('Content search error:', error)
      socket.emit('error', { message: 'Search failed' })
    }
  })

  // Real-time content updates (for admins)
  socket.on('content:subscribe', (contentType: string, contentId: string) => {
    if (!isAuthenticated || user.roles !== 'ADMIN') {
      socket.emit('error', { message: 'Admin access required' })
      return
    }

    const roomName = `${contentType}:${contentId}`
    socket.join(roomName)
    socket.emit('content:subscribed', { contentType, contentId })

    logger.info(`📡 Admin subscribed to ${contentType}: ${contentId}`)
  })

  // Content popularity tracking
  socket.on(
    'content:view',
    async (data: { contentType: string; contentId: string; progress?: number }) => {
      try {
        const { contentType, contentId, progress = 0 } = data

        // Track view in Redis for analytics
        const viewKey = `views:${contentType}:${contentId}`
        const userViewKey = `user_views:${user?.id || 'anonymous'}:${contentType}:${contentId}`

        // Only count unique views per user per day
        const today = new Date().toISOString().split('T')[0]
        const dailyViewKey = `daily_views:${today}:${contentType}:${contentId}:${user?.id || socket.id}`

        const alreadyViewed = await redis.exists(dailyViewKey)
        if (!alreadyViewed) {
          await redis.incr(viewKey)
          await redis.expire(dailyViewKey, 86400) // Expire in 24 hours
        }

        // Broadcast updated view count
        const viewCount = await redis.get(viewKey)
        io.to(`${contentType}:${contentId}`).emit('content:views:updated', {
          contentType,
          contentId,
          viewCount: parseInt(viewCount || '0'),
          timestamp: new Date().toISOString(),
        })
      } catch (error) {
        logger.error('Content view tracking error:', error)
      }
    },
  )

  // Live content creation notifications
  socket.on('content:watch:new', () => {
    if (!isAuthenticated || user.roles !== 'ADMIN') {
      socket.emit('error', { message: 'Admin access required' })
      return
    }

    socket.join('content:new')
    socket.emit('content:watch:started')

    logger.info(`👀 Admin watching for new content: ${user.username}`)
  })

  socket.on('content:stop:watch', () => {
    socket.leave('content:new')
    socket.emit('content:watch:stopped')
  })
}
