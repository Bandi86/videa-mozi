import { Socket } from 'socket.io'
import logger from '../../config/logger.js'
import { LikesService } from '../../services/likesService.js'
import { NotificationsService } from '../../services/notificationsService.js'

/**
 * Handle like-related WebSocket events
 */
export const registerLikeHandlers = (socket: Socket) => {
  /**
   * Like/unlike a post
   */
  socket.on('like:post', async (data: any) => {
    try {
      const { postId, userId } = data

      if (!postId || !userId) {
        socket.emit('error', { message: 'Post ID and user ID are required' })
        return
      }

      const result = await LikesService.togglePostLike(postId, userId)

      // Broadcast to post room
      socket.to(`post:${postId}`).emit('like:post:updated', {
        postId,
        userId,
        liked: result.liked,
        likeCount: result.likeCount,
        timestamp: new Date().toISOString(),
      })

      // Notify post author if liked (and not self-like)
      if (result.liked && result.authorId !== userId) {
        try {
          await NotificationsService.createNotification({
            recipientId: result.authorId,
            type: 'post_liked',
            message: 'Someone liked your post',
            data: { postId, likerId: userId },
          })

          socket.to(`user:${result.authorId}`).emit('notification:new', {
            type: 'post_liked',
            message: 'Someone liked your post',
            data: { postId, likerId: userId },
          })
        } catch (notificationError) {
          logger.error('Failed to create like notification:', notificationError)
        }
      }

      socket.emit('like:post:updated', result)
      logger.info(`❤️ Post ${postId} ${result.liked ? 'liked' : 'unliked'} by user ${userId}`)
    } catch (error) {
      logger.error('Post like error:', error)
      socket.emit('error', { message: 'Failed to toggle post like' })
    }
  })

  /**
   * Like/unlike a comment
   */
  socket.on('like:comment', async (data: any) => {
    try {
      const { commentId, userId } = data

      if (!commentId || !userId) {
        socket.emit('error', { message: 'Comment ID and user ID are required' })
        return
      }

      const result = await LikesService.toggleCommentLike(commentId, userId)

      // Broadcast to comment thread and post room
      socket.to(`comment:thread:${commentId}`).emit('like:comment:updated', {
        commentId,
        userId,
        liked: result.liked,
        likeCount: result.likeCount,
        timestamp: new Date().toISOString(),
      })

      socket.to(`post:${result.postId}`).emit('like:comment:updated', {
        commentId,
        userId,
        liked: result.liked,
        likeCount: result.likeCount,
        timestamp: new Date().toISOString(),
      })

      // Notify comment author if liked (and not self-like)
      if (result.liked && result.authorId !== userId) {
        try {
          await NotificationsService.createNotification({
            recipientId: result.authorId,
            type: 'comment_liked',
            message: 'Someone liked your comment',
            data: { commentId, likerId: userId },
          })

          socket.to(`user:${result.authorId}`).emit('notification:new', {
            type: 'comment_liked',
            message: 'Someone liked your comment',
            data: { commentId, likerId: userId },
          })
        } catch (notificationError) {
          logger.error('Failed to create comment like notification:', notificationError)
        }
      }

      socket.emit('like:comment:updated', result)
      logger.info(`💖 Comment ${commentId} ${result.liked ? 'liked' : 'unliked'} by user ${userId}`)
    } catch (error) {
      logger.error('Comment like error:', error)
      socket.emit('error', { message: 'Failed to toggle comment like' })
    }
  })

  /**
   * Get likes for a post
   */
  socket.on('like:post:get', async (data: any) => {
    try {
      const { postId, page = 1, limit = 20 } = data

      if (!postId) {
        socket.emit('error', { message: 'Post ID is required' })
        return
      }

      const likes = await LikesService.getPostLikes(postId, {
        page: Number(page),
        limit: Number(limit),
      })

      socket.emit('like:post:list', {
        postId,
        likes: likes.data,
        pagination: likes.pagination,
      })
    } catch (error) {
      logger.error('Get post likes error:', error)
      socket.emit('error', { message: 'Failed to get post likes' })
    }
  })

  /**
   * Get likes for a comment
   */
  socket.on('like:comment:get', async (data: any) => {
    try {
      const { commentId, page = 1, limit = 20 } = data

      if (!commentId) {
        socket.emit('error', { message: 'Comment ID is required' })
        return
      }

      const likes = await LikesService.getCommentLikes(commentId, {
        page: Number(page),
        limit: Number(limit),
      })

      socket.emit('like:comment:list', {
        commentId,
        likes: likes.data,
        pagination: likes.pagination,
      })
    } catch (error) {
      logger.error('Get comment likes error:', error)
      socket.emit('error', { message: 'Failed to get comment likes' })
    }
  })

  /**
   * Check if user liked a post
   */
  socket.on('like:post:check', async (data: any) => {
    try {
      const { postId, userId } = data

      if (!postId || !userId) {
        socket.emit('error', { message: 'Post ID and user ID are required' })
        return
      }

      const liked = await LikesService.hasUserLikedPost(postId, userId)

      socket.emit('like:post:status', {
        postId,
        userId,
        liked,
      })
    } catch (error) {
      logger.error('Check post like status error:', error)
      socket.emit('error', { message: 'Failed to check like status' })
    }
  })

  /**
   * Check if user liked a comment
   */
  socket.on('like:comment:check', async (data: any) => {
    try {
      const { commentId, userId } = data

      if (!commentId || !userId) {
        socket.emit('error', { message: 'Comment ID and user ID are required' })
        return
      }

      const liked = await LikesService.hasUserLikedComment(commentId, userId)

      socket.emit('like:comment:status', {
        commentId,
        userId,
        liked,
      })
    } catch (error) {
      logger.error('Check comment like status error:', error)
      socket.emit('error', { message: 'Failed to check like status' })
    }
  })

  /**
   * Get user's liked posts
   */
  socket.on('like:user:posts', async (data: any) => {
    try {
      const { userId, page = 1, limit = 20 } = data

      if (!userId) {
        socket.emit('error', { message: 'User ID is required' })
        return
      }

      const likedPosts = await LikesService.getUserLikedPosts(userId, {
        page: Number(page),
        limit: Number(limit),
      })

      socket.emit('like:user:posts:list', {
        userId,
        posts: likedPosts.data,
        pagination: likedPosts.pagination,
      })
    } catch (error) {
      logger.error('Get user liked posts error:', error)
      socket.emit('error', { message: 'Failed to get liked posts' })
    }
  })

  /**
   * Get like statistics for a post
   */
  socket.on('like:post:stats', async (data: any) => {
    try {
      const { postId } = data

      if (!postId) {
        socket.emit('error', { message: 'Post ID is required' })
        return
      }

      const stats = await LikesService.getPostLikeStats(postId)

      socket.emit('like:post:stats', {
        postId,
        stats,
      })
    } catch (error) {
      logger.error('Get post like stats error:', error)
      socket.emit('error', { message: 'Failed to get like statistics' })
    }
  })

  /**
   * Get like statistics for a comment
   */
  socket.on('like:comment:stats', async (data: any) => {
    try {
      const { commentId } = data

      if (!commentId) {
        socket.emit('error', { message: 'Comment ID is required' })
        return
      }

      const stats = await LikesService.getCommentLikeStats(commentId)

      socket.emit('like:comment:stats', {
        commentId,
        stats,
      })
    } catch (error) {
      logger.error('Get comment like stats error:', error)
      socket.emit('error', { message: 'Failed to get like statistics' })
    }
  })
}
