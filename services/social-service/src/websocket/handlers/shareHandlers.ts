import { Socket } from 'socket.io'
import logger from '../../config/logger.js'
import { SharesService } from '../../services/sharesService.js'
import { NotificationsService } from '../../services/notificationsService.js'

/**
 * Handle share-related WebSocket events
 */
export const registerShareHandlers = (socket: Socket) => {
  /**
   * Share a post
   */
  socket.on('share:create', async (data: any) => {
    try {
      const { postId, userId, shareType = 'share', message } = data

      if (!postId || !userId) {
        socket.emit('error', { message: 'Post ID and user ID are required' })
        return
      }

      const share = await SharesService.createShare({
        postId,
        userId,
        shareType,
        message,
      })

      // Broadcast to post room
      socket.to(`post:${postId}`).emit('share:created', {
        share,
        timestamp: new Date().toISOString(),
      })

      // Notify post author if sharer is not the author
      if (share.post.author.id !== userId) {
        try {
          await NotificationsService.createNotification({
            recipientId: share.post.author.id,
            type: 'post_shared',
            message: 'Someone shared your post',
            data: { postId, sharerId: userId, shareType },
          })

          socket.to(`user:${share.post.author.id}`).emit('notification:new', {
            type: 'post_shared',
            message: 'Someone shared your post',
            data: { postId, sharerId: userId, shareType },
          })
        } catch (notificationError) {
          logger.error('Failed to create share notification:', notificationError)
        }
      }

      socket.emit('share:created', share)
      logger.info(`📤 Post ${postId} shared by user ${userId} (${shareType})`)
    } catch (error) {
      logger.error('Share creation error:', error)
      socket.emit('error', { message: 'Failed to share post' })
    }
  })

  /**
   * Delete a share
   */
  socket.on('share:delete', async (data: any) => {
    try {
      const { shareId, userId } = data

      if (!shareId || !userId) {
        socket.emit('error', { message: 'Share ID and user ID are required' })
        return
      }

      const deletedShare = await SharesService.deleteShare(shareId, userId)

      // Broadcast to post room
      socket.to(`post:${deletedShare.postId}`).emit('share:deleted', {
        shareId,
        postId: deletedShare.postId,
        timestamp: new Date().toISOString(),
      })

      socket.emit('share:deleted', { shareId })
      logger.info(`🗑️ Share ${shareId} deleted by user ${userId}`)
    } catch (error) {
      logger.error('Share deletion error:', error)
      socket.emit('error', { message: 'Failed to delete share' })
    }
  })

  /**
   * Get shares for a post
   */
  socket.on('share:post:get', async (data: any) => {
    try {
      const { postId, page = 1, limit = 20 } = data

      if (!postId) {
        socket.emit('error', { message: 'Post ID is required' })
        return
      }

      const shares = await SharesService.getPostShares(postId, {
        page: Number(page),
        limit: Number(limit),
      })

      socket.emit('share:post:list', {
        postId,
        shares: shares.data,
        pagination: shares.pagination,
      })
    } catch (error) {
      logger.error('Get post shares error:', error)
      socket.emit('error', { message: 'Failed to get post shares' })
    }
  })

  /**
   * Get user's shares
   */
  socket.on('share:user:get', async (data: any) => {
    try {
      const { userId, page = 1, limit = 20 } = data

      if (!userId) {
        socket.emit('error', { message: 'User ID is required' })
        return
      }

      const shares = await SharesService.getUserShares(userId, {
        page: Number(page),
        limit: Number(limit),
      })

      socket.emit('share:user:list', {
        userId,
        shares: shares.data,
        pagination: shares.pagination,
      })
    } catch (error) {
      logger.error('Get user shares error:', error)
      socket.emit('error', { message: 'Failed to get user shares' })
    }
  })

  /**
   * Get share statistics for a post
   */
  socket.on('share:post:stats', async (data: any) => {
    try {
      const { postId } = data

      if (!postId) {
        socket.emit('error', { message: 'Post ID is required' })
        return
      }

      const stats = await SharesService.getPostShareStats(postId)

      socket.emit('share:post:stats', {
        postId,
        stats,
      })
    } catch (error) {
      logger.error('Get post share stats error:', error)
      socket.emit('error', { message: 'Failed to get share statistics' })
    }
  })

  /**
   * Check if user shared a post
   */
  socket.on('share:post:check', async (data: any) => {
    try {
      const { postId, userId } = data

      if (!postId || !userId) {
        socket.emit('error', { message: 'Post ID and user ID are required' })
        return
      }

      const shared = await SharesService.hasUserSharedPost(postId, userId)

      socket.emit('share:post:status', {
        postId,
        userId,
        shared,
      })
    } catch (error) {
      logger.error('Check post share status error:', error)
      socket.emit('error', { message: 'Failed to check share status' })
    }
  })

  /**
   * Get share count for a post
   */
  socket.on('share:post:count', async (data: any) => {
    try {
      const { postId } = data

      if (!postId) {
        socket.emit('error', { message: 'Post ID is required' })
        return
      }

      const count = await SharesService.getPostShareCount(postId)

      socket.emit('share:post:count', {
        postId,
        count,
      })
    } catch (error) {
      logger.error('Get post share count error:', error)
      socket.emit('error', { message: 'Failed to get share count' })
    }
  })

  /**
   * Reshare a post (share of share)
   */
  socket.on('share:reshare', async (data: any) => {
    try {
      const { originalPostId, userId, shareType = 'reshare', message } = data

      if (!originalPostId || !userId) {
        socket.emit('error', { message: 'Original post ID and user ID are required' })
        return
      }

      const reshare = await SharesService.resharePost(originalPostId, userId, shareType, message)

      // Broadcast to original post room
      socket.to(`post:${originalPostId}`).emit('share:reshared', {
        reshare,
        timestamp: new Date().toISOString(),
      })

      // Notify original post author
      if (reshare.originalPost.author.id !== userId) {
        try {
          await NotificationsService.createNotification({
            recipientId: reshare.originalPost.author.id,
            type: 'post_reshared',
            message: 'Someone reshared your post',
            data: { originalPostId, resharerId: userId, shareType },
          })

          socket.to(`user:${reshare.originalPost.author.id}`).emit('notification:new', {
            type: 'post_reshared',
            message: 'Someone reshared your post',
            data: { originalPostId, resharerId: userId, shareType },
          })
        } catch (notificationError) {
          logger.error('Failed to create reshare notification:', notificationError)
        }
      }

      socket.emit('share:reshared', reshare)
      logger.info(`🔄 Post ${originalPostId} reshared by user ${userId} (${shareType})`)
    } catch (error) {
      logger.error('Reshare error:', error)
      socket.emit('error', { message: 'Failed to reshare post' })
    }
  })
}
