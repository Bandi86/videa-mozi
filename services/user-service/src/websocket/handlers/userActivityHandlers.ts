import { Server as SocketIOServer, Socket } from 'socket.io'
import prisma from '../../config/database.js'
import logger from '../../config/logger.js'

export const setupUserActivityHandlers = (io: SocketIOServer, socket: Socket): void => {
  const userId = socket.userId
  const username = socket.username

  // User goes online
  socket.on('user:online', async () => {
    if (!userId) return

    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          lastActiveAt: new Date(),
        },
      })

      // Broadcast to followers that user is online
      socket.to(`user:${userId}`).emit('user:status', {
        userId,
        username,
        status: 'online',
        timestamp: new Date().toISOString(),
      })

      logger.debug(`User ${username} (${userId}) is online`)
    } catch (error: any) {
      logger.error('Error updating user online status:', error)
    }
  })

  // User goes offline
  socket.on('user:offline', async () => {
    if (!userId) return

    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          lastActiveAt: new Date(),
        },
      })

      // Broadcast to followers that user is offline
      socket.to(`user:${userId}`).emit('user:status', {
        userId,
        username,
        status: 'offline',
        timestamp: new Date().toISOString(),
      })

      logger.debug(`User ${username} (${userId}) is offline`)
    } catch (error: any) {
      logger.error('Error updating user offline status:', error)
    }
  })

  // User typing indicator
  socket.on('user:typing:start', (data: { chatId?: string; userId?: string }) => {
    if (!userId) return

    const targetRoom = data.chatId || data.userId
    if (targetRoom) {
      socket.to(`user:${targetRoom}`).emit('user:typing', {
        userId,
        username,
        isTyping: true,
        timestamp: new Date().toISOString(),
      })
    }
  })

  socket.on('user:typing:stop', (data: { chatId?: string; userId?: string }) => {
    if (!userId) return

    const targetRoom = data.chatId || data.userId
    if (targetRoom) {
      socket.to(`user:${targetRoom}`).emit('user:typing', {
        userId,
        username,
        isTyping: false,
        timestamp: new Date().toISOString(),
      })
    }
  })

  // User activity tracking
  socket.on('user:activity', async (data: { action: string; page?: string; metadata?: any }) => {
    if (!userId) return

    try {
      // Update user's last active time
      await prisma.user.update({
        where: { id: userId },
        data: {
          lastActiveAt: new Date(),
        },
      })

      logger.debug(`User activity: ${username} (${userId}) - ${data.action}`)

      // Could store activity data for analytics
      // await prisma.userActivity.create({
      //   data: {
      //     userId,
      //     action: data.action,
      //     page: data.page,
      //     metadata: data.metadata,
      //   },
      // })
    } catch (error: any) {
      logger.error('Error tracking user activity:', error)
    }
  })

  // User presence in rooms/channels
  socket.on('room:join', async (data: { roomId: string; roomType?: string }) => {
    if (!userId) return

    try {
      socket.join(data.roomId)

      // Broadcast presence to room
      socket.to(data.roomId).emit('user:joined', {
        userId,
        username,
        roomId: data.roomId,
        roomType: data.roomType,
        timestamp: new Date().toISOString(),
      })

      logger.debug(`User ${username} joined room ${data.roomId}`)
    } catch (error: any) {
      logger.error('Error joining room:', error)
    }
  })

  socket.on('room:leave', async (data: { roomId: string }) => {
    if (!userId) return

    try {
      socket.leave(data.roomId)

      // Broadcast departure to room
      socket.to(data.roomId).emit('user:left', {
        userId,
        username,
        roomId: data.roomId,
        timestamp: new Date().toISOString(),
      })

      logger.debug(`User ${username} left room ${data.roomId}`)
    } catch (error: any) {
      logger.error('Error leaving room:', error)
    }
  })

  // Real-time profile updates
  socket.on(
    'profile:update',
    async (data: { displayName?: string; bio?: string; avatarUrl?: string; status?: string }) => {
      if (!userId) return

      try {
        // Update profile (you would implement this in your user service)
        // const updatedUser = await userService.updateProfile(userId, data)

        // Broadcast profile update to followers
        socket.to(`user:${userId}`).emit('profile:updated', {
          userId,
          updates: data,
          timestamp: new Date().toISOString(),
        })

        logger.debug(`User ${username} updated profile`)
      } catch (error: any) {
        logger.error('Error updating profile:', error)
        socket.emit('error', {
          event: 'profile:update',
          message: 'Failed to update profile',
        })
      }
    },
  )

  // Follow/Unfollow real-time updates
  socket.on('follow:create', async (data: { followingId: string }) => {
    if (!userId) return

    try {
      // Create follow relationship (you would implement this in your user service)
      // await userService.followUser(userId, data.followingId)

      // Notify the followed user
      io.to(`user:${data.followingId}`).emit('follow:received', {
        followerId: userId,
        followerUsername: username,
        timestamp: new Date().toISOString(),
      })

      logger.debug(`User ${username} followed user ${data.followingId}`)
    } catch (error: any) {
      logger.error('Error creating follow:', error)
      socket.emit('error', {
        event: 'follow:create',
        message: 'Failed to follow user',
      })
    }
  })

  socket.on('follow:remove', async (data: { followingId: string }) => {
    if (!userId) return

    try {
      // Remove follow relationship (you would implement this in your user service)
      // await userService.unfollowUser(userId, data.followingId)

      // Notify the unfollowed user
      io.to(`user:${data.followingId}`).emit('follow:lost', {
        followerId: userId,
        followerUsername: username,
        timestamp: new Date().toISOString(),
      })

      logger.debug(`User ${username} unfollowed user ${data.followingId}`)
    } catch (error: any) {
      logger.error('Error removing follow:', error)
      socket.emit('error', {
        event: 'follow:remove',
        message: 'Failed to unfollow user',
      })
    }
  })

  // Real-time notifications
  socket.on('notification:read', async (data: { notificationId: string }) => {
    if (!userId) return

    try {
      // Mark notification as read (you would implement this in your notification service)
      // await notificationService.markAsRead(userId, data.notificationId)

      // Send confirmation
      socket.emit('notification:read:success', {
        notificationId: data.notificationId,
        timestamp: new Date().toISOString(),
      })

      logger.debug(`User ${username} marked notification ${data.notificationId} as read`)
    } catch (error: any) {
      logger.error('Error marking notification as read:', error)
      socket.emit('error', {
        event: 'notification:read',
        message: 'Failed to mark notification as read',
      })
    }
  })

  // Heartbeat for connection monitoring
  const heartbeat = setInterval(() => {
    socket.emit('heartbeat', {
      timestamp: new Date().toISOString(),
      serverTime: Date.now(),
    })
  }, 30000) // Every 30 seconds

  socket.on('heartbeat:response', (data: { clientTime: number }) => {
    const latency = Date.now() - data.clientTime
    logger.debug(`Socket latency for ${username}: ${latency}ms`)
  })

  // Clean up on disconnect
  socket.on('disconnect', () => {
    clearInterval(heartbeat)
  })
}
