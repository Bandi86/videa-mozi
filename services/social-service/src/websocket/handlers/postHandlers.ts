import { Socket } from 'socket.io'
import logger from '../../config/logger.js'
import { PostsService } from '../../services/postsService.js'
import { NotificationsService } from '../../services/notificationsService.js'

/**
 * Handle post-related WebSocket events
 */
export const registerPostHandlers = (socket: Socket) => {
  /**
   * Create a new post
   */
  socket.on('post:create', async (data: any) => {
    try {
      const { content, media, visibility, userId } = data

      if (!userId || !content) {
        socket.emit('error', { message: 'User ID and content are required' })
        return
      }

      const newPost = await PostsService.createPost({
        content,
        media: media || [],
        visibility: visibility || 'public',
        authorId: userId,
      })

      // Broadcast to followers and user's room
      socket.to(`user:${userId}`).emit('post:created', newPost)
      socket.to(`user:followers:${userId}`).emit('post:created', newPost)

      // Send notification to followers
      try {
        await NotificationsService.createNotification({
          userId: userId, // This should be follower IDs in real implementation
          actorId: socket.data.user.id,
          type: 'MENTION', // Using existing type
          title: 'New Post',
          content: 'New post from user',
          postId: newPost.id,
        })
      } catch (notificationError) {
        logger.error('Failed to create notification:', notificationError)
      }

      socket.emit('post:created', newPost)
      logger.info(`📝 New post created by user ${userId}`)
    } catch (error) {
      logger.error('Post creation error:', error)
      socket.emit('error', { message: 'Failed to create post' })
    }
  })

  /**
   * Update an existing post
   */
  socket.on('post:update', async (data: any) => {
    try {
      const { postId, content, media, visibility, userId } = data

      if (!postId || !userId) {
        socket.emit('error', { message: 'Post ID and user ID are required' })
        return
      }

      const updatedPost = await PostsService.updatePost(postId, userId, {
        content,
        media,
        visibility,
      })

      // Broadcast update to post room and user's followers
      socket.to(`post:${postId}`).emit('post:updated', updatedPost)
      socket.to(`user:followers:${userId}`).emit('post:updated', updatedPost)

      socket.emit('post:updated', updatedPost)
      logger.info(`✏️ Post ${postId} updated by user ${userId}`)
    } catch (error) {
      logger.error('Post update error:', error)
      socket.emit('error', { message: 'Failed to update post' })
    }
  })

  /**
   * Delete a post
   */
  socket.on('post:delete', async (data: any) => {
    try {
      const { postId, userId } = data

      if (!postId || !userId) {
        socket.emit('error', { message: 'Post ID and user ID are required' })
        return
      }

      await PostsService.deletePost(postId, userId)

      // Broadcast deletion to post room and user's followers
      socket.to(`post:${postId}`).emit('post:deleted', { postId })
      socket.to(`user:followers:${userId}`).emit('post:deleted', { postId })

      socket.emit('post:deleted', { postId })
      logger.info(`🗑️ Post ${postId} deleted by user ${userId}`)
    } catch (error) {
      logger.error('Post deletion error:', error)
      socket.emit('error', { message: 'Failed to delete post' })
    }
  })

  /**
   * Like/unlike a post
   */
  socket.on('post:like', async (data: any) => {
    try {
      const { postId, userId, action = 'toggle' } = data

      if (!postId || !userId) {
        socket.emit('error', { message: 'Post ID and user ID are required' })
        return
      }

      const result = await PostsService.toggleLike(postId, userId)

      // Broadcast like update to post room
      socket.to(`post:${postId}`).emit('post:liked', {
        postId,
        userId,
        liked: result.liked,
        likeCount: result.likeCount,
      })

      // Notify post author if liked
      if (result.liked && result.authorId !== userId) {
        socket.to(`user:${result.authorId}`).emit('notification:new', {
          type: 'post_liked',
          message: 'Someone liked your post',
          data: { postId, likerId: userId },
        })
      }

      socket.emit('post:liked', result)
      logger.info(`❤️ Post ${postId} ${result.liked ? 'liked' : 'unliked'} by user ${userId}`)
    } catch (error) {
      logger.error('Post like error:', error)
      socket.emit('error', { message: 'Failed to toggle like' })
    }
  })

  /**
   * Share a post
   */
  socket.on('post:share', async (data: any) => {
    try {
      const { postId, userId, shareType = 'share', message } = data

      if (!postId || !userId) {
        socket.emit('error', { message: 'Post ID and user ID are required' })
        return
      }

      const share = await PostsService.sharePost(postId, userId, shareType, message)

      // Broadcast share to post room
      socket.to(`post:${postId}`).emit('post:shared', {
        postId,
        userId,
        shareType,
        shareCount: share.shareCount,
      })

      // Notify post author
      if (share.authorId !== userId) {
        socket.to(`user:${share.authorId}`).emit('notification:new', {
          type: 'post_shared',
          message: 'Someone shared your post',
          data: { postId, sharerId: userId, shareType },
        })
      }

      socket.emit('post:shared', share)
      logger.info(`📤 Post ${postId} shared by user ${userId}`)
    } catch (error) {
      logger.error('Post share error:', error)
      socket.emit('error', { message: 'Failed to share post' })
    }
  })

  /**
   * View post (for analytics)
   */
  socket.on('post:view', async (data: any) => {
    try {
      const { postId, userId, duration } = data

      if (!postId || !userId) {
        return // Silent fail for view tracking
      }

      await PostsService.trackView(postId, userId, duration)

      // Update view count in post room
      socket.to(`post:${postId}`).emit('post:view:update', {
        postId,
        viewCount: await PostsService.getViewCount(postId),
      })
    } catch (error) {
      logger.error('Post view tracking error:', error)
    }
  })

  /**
   * Join post room for real-time updates
   */
  socket.on('post:join', (data: any) => {
    const { postId } = data

    if (postId) {
      socket.join(`post:${postId}`)
      logger.info(`👥 User joined post room: post:${postId}`)
    }
  })

  /**
   * Leave post room
   */
  socket.on('post:leave', (data: any) => {
    const { postId } = data

    if (postId) {
      socket.leave(`post:${postId}`)
      logger.info(`👋 User left post room: post:${postId}`)
    }
  })
}
