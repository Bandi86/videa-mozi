import { Socket } from 'socket.io'
import logger from '../../config/logger.js'
import { FollowersService } from '../../services/followersService.js'
import { NotificationsService } from '../../services/notificationsService.js'

/**
 * Handle follower-related WebSocket events
 */
export const registerFollowerHandlers = (socket: Socket) => {
  /**
   * Follow a user
   */
  socket.on('follow:create', async (data: any) => {
    try {
      const { followerId, followingId } = data

      if (!followerId || !followingId) {
        socket.emit('error', { message: 'Follower ID and following ID are required' })
        return
      }

      if (followerId === followingId) {
        socket.emit('error', { message: 'Users cannot follow themselves' })
        return
      }

      const follow = await FollowersService.followUser(followerId, followingId)

      // Join follower's room for the following user
      socket.join(`user:followers:${followingId}`)

      // Broadcast to following user's room
      socket.to(`user:${followingId}`).emit('follow:new', {
        follower: follow.follower,
        following: follow.following,
        timestamp: new Date().toISOString(),
      })

      // Notify the followed user
      try {
        await NotificationsService.createNotification({
          recipientId: followingId,
          type: 'user_followed',
          message: 'Someone started following you',
          data: { followerId },
        })

        socket.to(`user:${followingId}`).emit('notification:new', {
          type: 'user_followed',
          message: 'Someone started following you',
          data: { followerId },
        })
      } catch (notificationError) {
        logger.error('Failed to create follow notification:', notificationError)
      }

      socket.emit('follow:created', follow)
      logger.info(`👥 User ${followerId} started following user ${followingId}`)
    } catch (error) {
      logger.error('Follow creation error:', error)
      socket.emit('error', { message: 'Failed to follow user' })
    }
  })

  /**
   * Unfollow a user
   */
  socket.on('follow:delete', async (data: any) => {
    try {
      const { followerId, followingId } = data

      if (!followerId || !followingId) {
        socket.emit('error', { message: 'Follower ID and following ID are required' })
        return
      }

      await FollowersService.unfollowUser(followerId, followingId)

      // Leave follower's room for the following user
      socket.leave(`user:followers:${followingId}`)

      // Broadcast to following user's room
      socket.to(`user:${followingId}`).emit('follow:removed', {
        followerId,
        followingId,
        timestamp: new Date().toISOString(),
      })

      socket.emit('follow:deleted', { followerId, followingId })
      logger.info(`👋 User ${followerId} unfollowed user ${followingId}`)
    } catch (error) {
      logger.error('Unfollow error:', error)
      socket.emit('error', { message: 'Failed to unfollow user' })
    }
  })

  /**
   * Accept follow request (for private accounts)
   */
  socket.on('follow:accept', async (data: any) => {
    try {
      const { followerId, followingId } = data

      if (!followerId || !followingId) {
        socket.emit('error', { message: 'Follower ID and following ID are required' })
        return
      }

      const follow = await FollowersService.acceptFollowRequest(followerId, followingId)

      // Broadcast to follower
      socket.to(`user:${followerId}`).emit('follow:accepted', {
        follower: follow.follower,
        following: follow.following,
        timestamp: new Date().toISOString(),
      })

      // Notify the follower
      try {
        await NotificationsService.createNotification({
          recipientId: followerId,
          type: 'follow_accepted',
          message: 'Your follow request was accepted',
          data: { followingId },
        })

        socket.to(`user:${followerId}`).emit('notification:new', {
          type: 'follow_accepted',
          message: 'Your follow request was accepted',
          data: { followingId },
        })
      } catch (notificationError) {
        logger.error('Failed to create follow accepted notification:', notificationError)
      }

      socket.emit('follow:accepted', follow)
      logger.info(`✅ User ${followingId} accepted follow request from user ${followerId}`)
    } catch (error) {
      logger.error('Accept follow error:', error)
      socket.emit('error', { message: 'Failed to accept follow request' })
    }
  })

  /**
   * Reject follow request (for private accounts)
   */
  socket.on('follow:reject', async (data: any) => {
    try {
      const { followerId, followingId } = data

      if (!followerId || !followingId) {
        socket.emit('error', { message: 'Follower ID and following ID are required' })
        return
      }

      await FollowersService.rejectFollowRequest(followerId, followingId)

      // Broadcast to follower
      socket.to(`user:${followerId}`).emit('follow:rejected', {
        followerId,
        followingId,
        timestamp: new Date().toISOString(),
      })

      socket.emit('follow:rejected', { followerId, followingId })
      logger.info(`❌ User ${followingId} rejected follow request from user ${followerId}`)
    } catch (error) {
      logger.error('Reject follow error:', error)
      socket.emit('error', { message: 'Failed to reject follow request' })
    }
  })

  /**
   * Get followers list
   */
  socket.on('follow:followers:get', async (data: any) => {
    try {
      const { userId, page = 1, limit = 20 } = data

      if (!userId) {
        socket.emit('error', { message: 'User ID is required' })
        return
      }

      const followers = await FollowersService.getFollowers(userId, {
        page: Number(page),
        limit: Number(limit),
      })

      socket.emit('follow:followers:list', {
        userId,
        followers: followers.data,
        pagination: followers.pagination,
      })
    } catch (error) {
      logger.error('Get followers error:', error)
      socket.emit('error', { message: 'Failed to get followers' })
    }
  })

  /**
   * Get following list
   */
  socket.on('follow:following:get', async (data: any) => {
    try {
      const { userId, page = 1, limit = 20 } = data

      if (!userId) {
        socket.emit('error', { message: 'User ID is required' })
        return
      }

      const following = await FollowersService.getFollowing(userId, {
        page: Number(page),
        limit: Number(limit),
      })

      socket.emit('follow:following:list', {
        userId,
        following: following.data,
        pagination: following.pagination,
      })
    } catch (error) {
      logger.error('Get following error:', error)
      socket.emit('error', { message: 'Failed to get following' })
    }
  })

  /**
   * Get follower statistics
   */
  socket.on('follow:stats', async (data: any) => {
    try {
      const { userId } = data

      if (!userId) {
        socket.emit('error', { message: 'User ID is required' })
        return
      }

      const stats = await FollowersService.getFollowerStats(userId)

      socket.emit('follow:stats', {
        userId,
        stats,
      })
    } catch (error) {
      logger.error('Get follower stats error:', error)
      socket.emit('error', { message: 'Failed to get follower statistics' })
    }
  })

  /**
   * Check follow status
   */
  socket.on('follow:status', async (data: any) => {
    try {
      const { followerId, followingId } = data

      if (!followerId || !followingId) {
        socket.emit('error', { message: 'Follower ID and following ID are required' })
        return
      }

      const status = await FollowersService.getFollowStatus(followerId, followingId)

      socket.emit('follow:status', {
        followerId,
        followingId,
        status,
      })
    } catch (error) {
      logger.error('Get follow status error:', error)
      socket.emit('error', { message: 'Failed to get follow status' })
    }
  })

  /**
   * Get mutual followers
   */
  socket.on('follow:mutual', async (data: any) => {
    try {
      const { userId1, userId2, page = 1, limit = 20 } = data

      if (!userId1 || !userId2) {
        socket.emit('error', { message: 'Both user IDs are required' })
        return
      }

      const mutual = await FollowersService.getMutualFollowers(userId1, userId2, {
        page: Number(page),
        limit: Number(limit),
      })

      socket.emit('follow:mutual:list', {
        userId1,
        userId2,
        mutual: mutual.data,
        pagination: mutual.pagination,
      })
    } catch (error) {
      logger.error('Get mutual followers error:', error)
      socket.emit('error', { message: 'Failed to get mutual followers' })
    }
  })

  /**
   * Get follow requests (for private accounts)
   */
  socket.on('follow:requests:get', async (data: any) => {
    try {
      const { userId, page = 1, limit = 20 } = data

      if (!userId) {
        socket.emit('error', { message: 'User ID is required' })
        return
      }

      const requests = await FollowersService.getFollowRequests(userId, {
        page: Number(page),
        limit: Number(limit),
      })

      socket.emit('follow:requests:list', {
        userId,
        requests: requests.data,
        pagination: requests.pagination,
      })
    } catch (error) {
      logger.error('Get follow requests error:', error)
      socket.emit('error', { message: 'Failed to get follow requests' })
    }
  })

  /**
   * Join user followers room for real-time updates
   */
  socket.on('follow:room:join', (data: any) => {
    const { userId } = data

    if (userId) {
      socket.join(`user:followers:${userId}`)
      logger.info(`👥 User joined followers room: user:followers:${userId}`)
    }
  })

  /**
   * Leave user followers room
   */
  socket.on('follow:room:leave', (data: any) => {
    const { userId } = data

    if (userId) {
      socket.leave(`user:followers:${userId}`)
      logger.info(`👋 User left followers room: user:followers:${userId}`)
    }
  })
}
