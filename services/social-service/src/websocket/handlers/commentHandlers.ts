import { Socket } from 'socket.io'
import logger from '../../config/logger.js'
import { CommentsService } from '../../services/commentsService.js'
import { NotificationsService } from '../../services/notificationsService.js'

/**
 * Handle comment-related WebSocket events
 */
export const registerCommentHandlers = (socket: Socket) => {
  /**
   * Create a new comment
   */
  socket.on('comment:create', async (data: any) => {
    try {
      const { postId, content, parentId, userId, mentions } = data

      if (!postId || !content || !userId) {
        socket.emit('error', { message: 'Post ID, content, and user ID are required' })
        return
      }

      const newComment = await CommentsService.createComment({
        postId,
        content,
        parentId,
        authorId: userId,
        mentions: mentions || [],
      })

      // Join comment thread room
      socket.join(`comment:thread:${newComment.id}`)

      // Broadcast to post room
      socket.to(`post:${postId}`).emit('comment:created', newComment)

      // Broadcast to parent comment thread if it's a reply
      if (parentId) {
        socket.to(`comment:thread:${parentId}`).emit('comment:reply:created', newComment)
      }

      // Notify mentioned users
      if (mentions && mentions.length > 0) {
        for (const mentionedUserId of mentions) {
          if (mentionedUserId !== userId) {
            socket.to(`user:${mentionedUserId}`).emit('notification:new', {
              type: 'comment_mention',
              message: 'You were mentioned in a comment',
              data: { commentId: newComment.id, postId },
            })
          }
        }
      }

      // Notify post author if commenter is not the author
      try {
        const post = await CommentsService.getPostById(postId)
        if (post.authorId !== userId) {
          socket.to(`user:${post.authorId}`).emit('notification:new', {
            type: 'comment_created',
            message: 'Someone commented on your post',
            data: { commentId: newComment.id, postId },
          })
        }
      } catch (postError) {
        logger.error('Failed to get post for notification:', postError)
      }

      socket.emit('comment:created', newComment)
      logger.info(`💬 New comment created on post ${postId} by user ${userId}`)
    } catch (error) {
      logger.error('Comment creation error:', error)
      socket.emit('error', { message: 'Failed to create comment' })
    }
  })

  /**
   * Update an existing comment
   */
  socket.on('comment:update', async (data: any) => {
    try {
      const { commentId, content, userId } = data

      if (!commentId || !content || !userId) {
        socket.emit('error', { message: 'Comment ID, content, and user ID are required' })
        return
      }

      const updatedComment = await CommentsService.updateComment(commentId, userId, { content })

      // Broadcast update to post room and comment thread
      socket.to(`post:${updatedComment.postId}`).emit('comment:updated', updatedComment)
      socket.to(`comment:thread:${commentId}`).emit('comment:updated', updatedComment)

      socket.emit('comment:updated', updatedComment)
      logger.info(`✏️ Comment ${commentId} updated by user ${userId}`)
    } catch (error) {
      logger.error('Comment update error:', error)
      socket.emit('error', { message: 'Failed to update comment' })
    }
  })

  /**
   * Delete a comment
   */
  socket.on('comment:delete', async (data: any) => {
    try {
      const { commentId, userId } = data

      if (!commentId || !userId) {
        socket.emit('error', { message: 'Comment ID and user ID are required' })
        return
      }

      const deletedComment = await CommentsService.deleteComment(commentId, userId)

      // Broadcast deletion to post room and comment thread
      socket.to(`post:${deletedComment.postId}`).emit('comment:deleted', {
        commentId,
        postId: deletedComment.postId,
      })
      socket.to(`comment:thread:${commentId}`).emit('comment:deleted', {
        commentId,
        postId: deletedComment.postId,
      })

      socket.emit('comment:deleted', { commentId })
      logger.info(`🗑️ Comment ${commentId} deleted by user ${userId}`)
    } catch (error) {
      logger.error('Comment deletion error:', error)
      socket.emit('error', { message: 'Failed to delete comment' })
    }
  })

  /**
   * Like/unlike a comment
   */
  socket.on('comment:like', async (data: any) => {
    try {
      const { commentId, userId } = data

      if (!commentId || !userId) {
        socket.emit('error', { message: 'Comment ID and user ID are required' })
        return
      }

      const result = await CommentsService.toggleCommentLike(commentId, userId)

      // Broadcast like update to post room and comment thread
      socket.to(`post:${result.postId}`).emit('comment:liked', {
        commentId,
        userId,
        liked: result.liked,
        likeCount: result.likeCount,
      })
      socket.to(`comment:thread:${commentId}`).emit('comment:liked', {
        commentId,
        userId,
        liked: result.liked,
        likeCount: result.likeCount,
      })

      // Notify comment author if liked
      if (result.liked && result.authorId !== userId) {
        socket.to(`user:${result.authorId}`).emit('notification:new', {
          type: 'comment_liked',
          message: 'Someone liked your comment',
          data: { commentId, likerId: userId },
        })
      }

      socket.emit('comment:liked', result)
      logger.info(`❤️ Comment ${commentId} ${result.liked ? 'liked' : 'unliked'} by user ${userId}`)
    } catch (error) {
      logger.error('Comment like error:', error)
      socket.emit('error', { message: 'Failed to toggle comment like' })
    }
  })

  /**
   * Get comments for a post (real-time)
   */
  socket.on('comment:get', async (data: any) => {
    try {
      const { postId, page = 1, limit = 20 } = data

      if (!postId) {
        socket.emit('error', { message: 'Post ID is required' })
        return
      }

      const comments = await CommentsService.getCommentsByPost(postId, {
        page: Number(page),
        limit: Number(limit),
      })

      socket.emit('comment:list', {
        postId,
        comments: comments.data,
        pagination: comments.pagination,
      })
    } catch (error) {
      logger.error('Get comments error:', error)
      socket.emit('error', { message: 'Failed to get comments' })
    }
  })

  /**
   * Get comment replies (real-time)
   */
  socket.on('comment:replies:get', async (data: any) => {
    try {
      const { commentId, page = 1, limit = 10 } = data

      if (!commentId) {
        socket.emit('error', { message: 'Comment ID is required' })
        return
      }

      const replies = await CommentsService.getCommentReplies(commentId, {
        page: Number(page),
        limit: Number(limit),
      })

      socket.emit('comment:replies:list', {
        commentId,
        replies: replies.data,
        pagination: replies.pagination,
      })
    } catch (error) {
      logger.error('Get comment replies error:', error)
      socket.emit('error', { message: 'Failed to get comment replies' })
    }
  })

  /**
   * Join comment thread for real-time updates
   */
  socket.on('comment:thread:join', (data: any) => {
    const { commentId } = data

    if (commentId) {
      socket.join(`comment:thread:${commentId}`)
      logger.info(`👥 User joined comment thread: comment:thread:${commentId}`)
    }
  })

  /**
   * Leave comment thread
   */
  socket.on('comment:thread:leave', (data: any) => {
    const { commentId } = data

    if (commentId) {
      socket.leave(`comment:thread:${commentId}`)
      logger.info(`👋 User left comment thread: comment:thread:${commentId}`)
    }
  })

  /**
   * Start typing indicator
   */
  socket.on('comment:typing:start', (data: any) => {
    const { postId, userId, username } = data

    if (postId && userId) {
      socket.to(`post:${postId}`).emit('comment:typing:start', {
        userId,
        username,
        timestamp: new Date().toISOString(),
      })
    }
  })

  /**
   * Stop typing indicator
   */
  socket.on('comment:typing:stop', (data: any) => {
    const { postId, userId, username } = data

    if (postId && userId) {
      socket.to(`post:${postId}`).emit('comment:typing:stop', {
        userId,
        username,
        timestamp: new Date().toISOString(),
      })
    }
  })
}
