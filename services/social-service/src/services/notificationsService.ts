import { prisma } from '../index.js'
import { redis } from '../index.js'
import logger from '../config/logger.js'

export interface NotificationFilters {
  userId: string
  page: number
  limit: number
  type?: 'LIKE' | 'COMMENT' | 'FOLLOW' | 'SHARE' | 'MENTION' | 'REPLY' | 'QUOTE'
  isRead?: boolean
}

export interface CreateNotificationData {
  userId: string
  actorId: string
  type: 'LIKE' | 'COMMENT' | 'FOLLOW' | 'SHARE' | 'MENTION' | 'REPLY' | 'QUOTE'
  title: string
  content: string
  postId?: string
  commentId?: string
}

export class NotificationsService {
  /**
   * Get user notifications with filtering and pagination
   */
  static async getUserNotifications(filters: NotificationFilters) {
    const { userId, page, limit, type, isRead } = filters

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {
      userId,
      isDeleted: false,
    }

    if (type) {
      where.type = type
    }

    if (isRead !== undefined) {
      where.isRead = isRead
    }

    try {
      // Get notifications and total count
      const [notifications, total] = await Promise.all([
        prisma.notifications.findMany({
          where,
          select: {
            id: true,
            type: true,
            title: true,
            content: true,
            postId: true,
            commentId: true,
            isRead: true,
            createdAt: true,
            actor: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                isVerified: true,
              },
            },
            post: {
              select: {
                id: true,
                title: true,
                content: true,
                type: true,
              },
            },
            comment: {
              select: {
                id: true,
                content: true,
              },
            },
          },
          orderBy: [
            { isRead: 'asc' }, // Unread first
            { createdAt: 'desc' },
          ],
          skip,
          take: limit,
        }),
        prisma.notifications.count({ where }),
      ])

      return {
        notifications,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      }
    } catch (error) {
      logger.error('Error getting user notifications:', error)
      throw new Error('Failed to retrieve notifications')
    }
  }

  /**
   * Create a new notification
   */
  static async createNotification(data: CreateNotificationData) {
    try {
      const { userId, actorId, type, title, content, postId, commentId } = data

      // Don't create notification if user is notifying themselves
      if (userId === actorId) {
        return null
      }

      const notification = await prisma.notifications.create({
        data: {
          userId,
          actorId,
          type,
          title,
          content,
          postId,
          commentId,
        },
        select: {
          id: true,
          type: true,
          title: true,
          content: true,
          postId: true,
          commentId: true,
          isRead: true,
          createdAt: true,
        },
      })

      // Cache the unread count for this user
      await this.updateUnreadCount(userId)

      return notification
    } catch (error) {
      logger.error('Error creating notification:', error)
      throw new Error('Failed to create notification')
    }
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(userId: string, notificationId: string): Promise<boolean> {
    try {
      const notification = await prisma.notifications.findFirst({
        where: {
          id: notificationId,
          userId,
          isDeleted: false,
        },
      })

      if (!notification) {
        return false
      }

      if (!notification.isRead) {
        await prisma.notifications.update({
          where: { id: notificationId },
          data: { isRead: true },
        })

        // Update unread count cache
        await this.updateUnreadCount(userId)
      }

      return true
    } catch (error) {
      logger.error('Error marking notification as read:', error)
      throw new Error('Failed to mark notification as read')
    }
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(userId: string): Promise<number> {
    try {
      const result = await prisma.notifications.updateMany({
        where: {
          userId,
          isRead: false,
          isDeleted: false,
        },
        data: {
          isRead: true,
        },
      })

      // Clear unread count cache
      await redis.del(`notifications:unread:${userId}`)

      return result.count
    } catch (error) {
      logger.error('Error marking all notifications as read:', error)
      throw new Error('Failed to mark all notifications as read')
    }
  }

  /**
   * Delete notification
   */
  static async deleteNotification(userId: string, notificationId: string): Promise<boolean> {
    try {
      const notification = await prisma.notifications.findFirst({
        where: {
          id: notificationId,
          userId,
        },
      })

      if (!notification) {
        return false
      }

      await prisma.notifications.update({
        where: { id: notificationId },
        data: {
          isDeleted: true,
        },
      })

      // Update unread count if this was unread
      if (!notification.isRead) {
        await this.updateUnreadCount(userId)
      }

      return true
    } catch (error) {
      logger.error('Error deleting notification:', error)
      throw new Error('Failed to delete notification')
    }
  }

  /**
   * Get user notification statistics
   */
  static async getUserNotificationStats(userId: string) {
    try {
      const [totalNotifications, unreadCount, byType, recentActivity] = await Promise.all([
        prisma.notifications.count({
          where: {
            userId,
            isDeleted: false,
          },
        }),
        prisma.notifications.count({
          where: {
            userId,
            isRead: false,
            isDeleted: false,
          },
        }),
        prisma.notifications.groupBy({
          by: ['type'],
          where: {
            userId,
            isDeleted: false,
          },
          _count: {
            id: true,
          },
        }),
        prisma.notifications.findMany({
          where: {
            userId,
            isDeleted: false,
          },
          select: {
            type: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 10,
        }),
      ])

      return {
        totalNotifications,
        unreadCount,
        byType: byType.reduce(
          (acc, curr) => {
            acc[curr.type] = curr._count.id
            return acc
          },
          {} as Record<string, number>,
        ),
        recentActivity,
      }
    } catch (error) {
      logger.error('Error getting user notification stats:', error)
      throw new Error('Failed to get notification statistics')
    }
  }

  /**
   * Create notification for like on post
   */
  static async createLikeNotification(userId: string, actorId: string, postId: string) {
    try {
      const post = await prisma.posts.findUnique({
        where: { id: postId },
        select: {
          id: true,
          title: true,
          content: true,
          author: {
            select: {
              username: true,
              displayName: true,
            },
          },
        },
      })

      if (!post) return null

      const actor = await prisma.users.findUnique({
        where: { id: actorId },
        select: {
          username: true,
          displayName: true,
        },
      })

      if (!actor) return null

      const title = 'New Like'
      const content = `${actor.displayName || actor.username} liked your post "${post.title || post.content?.substring(0, 50)}"`

      return await this.createNotification({
        userId,
        actorId,
        type: 'LIKE',
        title,
        content,
        postId,
      })
    } catch (error) {
      logger.error('Error creating like notification:', error)
      return null
    }
  }

  /**
   * Create notification for comment on post
   */
  static async createCommentNotification(
    userId: string,
    actorId: string,
    postId: string,
    commentId: string,
  ) {
    try {
      const [post, comment] = await Promise.all([
        prisma.posts.findUnique({
          where: { id: postId },
          select: {
            id: true,
            title: true,
            content: true,
            author: {
              select: {
                username: true,
                displayName: true,
              },
            },
          },
        }),
        prisma.comments.findUnique({
          where: { id: commentId },
          select: {
            content: true,
          },
        }),
      ])

      if (!post || !comment) return null

      const actor = await prisma.users.findUnique({
        where: { id: actorId },
        select: {
          username: true,
          displayName: true,
        },
      })

      if (!actor) return null

      const title = 'New Comment'
      const content = `${actor.displayName || actor.username} commented on your post: "${comment.content?.substring(0, 100)}"`

      return await this.createNotification({
        userId,
        actorId,
        type: 'COMMENT',
        title,
        content,
        postId,
        commentId,
      })
    } catch (error) {
      logger.error('Error creating comment notification:', error)
      return null
    }
  }

  /**
   * Create notification for follow
   */
  static async createFollowNotification(userId: string, actorId: string) {
    try {
      const actor = await prisma.users.findUnique({
        where: { id: actorId },
        select: {
          username: true,
          displayName: true,
        },
      })

      if (!actor) return null

      const title = 'New Follower'
      const content = `${actor.displayName || actor.username} started following you`

      return await this.createNotification({
        userId,
        actorId,
        type: 'FOLLOW',
        title,
        content,
      })
    } catch (error) {
      logger.error('Error creating follow notification:', error)
      return null
    }
  }

  /**
   * Create notification for share
   */
  static async createShareNotification(userId: string, actorId: string, postId: string) {
    try {
      const post = await prisma.posts.findUnique({
        where: { id: postId },
        select: {
          id: true,
          title: true,
          content: true,
          author: {
            select: {
              username: true,
              displayName: true,
            },
          },
        },
      })

      if (!post) return null

      const actor = await prisma.users.findUnique({
        where: { id: actorId },
        select: {
          username: true,
          displayName: true,
        },
      })

      if (!actor) return null

      const title = 'New Share'
      const content = `${actor.displayName || actor.username} shared your post "${post.title || post.content?.substring(0, 50)}"`

      return await this.createNotification({
        userId,
        actorId,
        type: 'SHARE',
        title,
        content,
        postId,
      })
    } catch (error) {
      logger.error('Error creating share notification:', error)
      return null
    }
  }

  /**
   * Create notification for mention
   */
  static async createMentionNotification(
    userId: string,
    actorId: string,
    postId: string,
    commentId?: string,
  ) {
    try {
      const actor = await prisma.users.findUnique({
        where: { id: actorId },
        select: {
          username: true,
          displayName: true,
        },
      })

      if (!actor) return null

      const title = 'You were mentioned'
      const content = `${actor.displayName || actor.username} mentioned you in ${commentId ? 'a comment' : 'a post'}`

      return await this.createNotification({
        userId,
        actorId,
        type: 'MENTION',
        title,
        content,
        postId,
        commentId,
      })
    } catch (error) {
      logger.error('Error creating mention notification:', error)
      return null
    }
  }

  /**
   * Get notification feed (activity from people user follows)
   */
  static async getNotificationFeed(userId: string, page: number = 1, limit: number = 20) {
    try {
      const skip = (page - 1) * limit

      // Get users that this user follows
      const followingIds = await prisma.followers.findMany({
        where: {
          followerId: userId,
          status: 'ACCEPTED',
        },
        select: {
          followingId: true,
        },
      })

      const followingIdList = followingIds.map(f => f.followingId)

      // Get notifications from followed users
      const [notifications, total] = await Promise.all([
        prisma.notifications.findMany({
          where: {
            userId: { in: followingIdList },
            isDeleted: false,
          },
          select: {
            id: true,
            type: true,
            title: true,
            content: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
              },
            },
            actor: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
              },
            },
            post: {
              select: {
                id: true,
                title: true,
                content: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          skip,
          take: limit,
        }),
        prisma.notifications.count({
          where: {
            userId: { in: followingIdList },
            isDeleted: false,
          },
        }),
      ])

      return {
        notifications,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      }
    } catch (error) {
      logger.error('Error getting notification feed:', error)
      throw new Error('Failed to get notification feed')
    }
  }

  /**
   * Update unread count cache
   */
  private static async updateUnreadCount(userId: string) {
    try {
      const unreadCount = await prisma.notifications.count({
        where: {
          userId,
          isRead: false,
          isDeleted: false,
        },
      })

      await redis.setex(`notifications:unread:${userId}`, 3600, unreadCount.toString())
    } catch (error) {
      logger.error('Error updating unread count:', error)
    }
  }

  /**
   * Get unread count for user
   */
  static async getUnreadCount(userId: string): Promise<number> {
    try {
      const cachedCount = await redis.get(`notifications:unread:${userId}`)
      if (cachedCount) {
        return parseInt(cachedCount, 10)
      }

      const count = await prisma.notifications.count({
        where: {
          userId,
          isRead: false,
          isDeleted: false,
        },
      })

      await redis.setex(`notifications:unread:${userId}`, 3600, count.toString())
      return count
    } catch (error) {
      logger.error('Error getting unread count:', error)
      return 0
    }
  }

  /**
   * Clean up old notifications
   */
  static async cleanupOldNotifications(daysOld: number = 30) {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysOld)

      const result = await prisma.notifications.deleteMany({
        where: {
          createdAt: { lt: cutoffDate },
          isRead: true,
        },
      })

      logger.info(`Cleaned up ${result.count} old notifications`)
      return result.count
    } catch (error) {
      logger.error('Error cleaning up old notifications:', error)
      throw new Error('Failed to cleanup old notifications')
    }
  }
}
