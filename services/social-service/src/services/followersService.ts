import { prisma } from '../index.js'
import { redis } from '../index.js'
import logger from '../config/logger.js'

export interface FollowerFilters {
  userId?: string
  type: 'followers' | 'following'
  status?: 'PENDING' | 'ACCEPTED' | 'BLOCKED'
  page: number
  limit: number
}

export interface FollowRequestFilters {
  userId: string
  page: number
  limit: number
}

export class FollowersService {
  /**
   * Get followers/following relationships with filtering and pagination
   */
  static async getRelationships(filters: FollowerFilters) {
    const { userId, type, status, page, limit } = filters

    if (!userId) {
      throw new Error('User ID is required')
    }

    const skip = (page - 1) * limit

    let where: any = {}
    let select: any = {}

    if (type === 'followers') {
      // Get users who follow this user
      where.followingId = userId
      select = {
        id: true,
        status: true,
        followType: true,
        requestMessage: true,
        createdAt: true,
        acceptedAt: true,
        follower: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            bio: true,
            isVerified: true,
            followersCount: true,
            followingCount: true,
          },
        },
      }
    } else {
      // Get users this user follows
      where.followerId = userId
      select = {
        id: true,
        status: true,
        followType: true,
        requestMessage: true,
        createdAt: true,
        acceptedAt: true,
        following: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            bio: true,
            isVerified: true,
            followersCount: true,
            followingCount: true,
          },
        },
      }
    }

    if (status) {
      where.status = status
    }

    try {
      const [relationships, total] = await Promise.all([
        prisma.followers.findMany({
          where,
          select,
          orderBy: {
            createdAt: 'desc',
          },
          skip,
          take: limit,
        }),
        prisma.followers.count({ where }),
      ])

      return {
        relationships,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      }
    } catch (error) {
      logger.error('Error getting relationships:', error)
      throw new Error('Failed to retrieve relationships')
    }
  }

  /**
   * Follow a user
   */
  static async followUser(followerId: string, followingId: string, requestMessage?: string) {
    try {
      // Check if target user exists
      const targetUser = await prisma.users.findUnique({
        where: { id: followingId },
        select: {
          id: true,
          isPrivate: true,
        },
      })

      if (!targetUser) {
        throw new Error('User not found')
      }

      // Check if already following
      const existingFollow = await prisma.followers.findUnique({
        where: {
          followerId_followingId: {
            followerId,
            followingId,
          },
        },
      })

      if (existingFollow) {
        if (existingFollow.status === 'ACCEPTED') {
          throw new Error('Already following this user')
        } else if (existingFollow.status === 'PENDING') {
          throw new Error('Follow request already pending')
        } else if (existingFollow.status === 'BLOCKED') {
          throw new Error('Unable to follow this user')
        }
      }

      const followData: any = {
        followerId,
        followingId,
      }

      // If target user has private account, create pending request
      if (targetUser.isPrivate) {
        followData.status = 'PENDING'
        followData.requestMessage = requestMessage || null

        const follow = await prisma.followers.create({
          data: followData,
          select: {
            id: true,
            status: true,
            followType: true,
            requestMessage: true,
            createdAt: true,
          },
        })

        return {
          action: 'requested',
          status: 'PENDING',
          follow,
        }
      } else {
        // Public account - follow immediately
        followData.status = 'ACCEPTED'
        followData.followType = 'FOLLOW'

        const follow = await prisma.followers.create({
          data: followData,
          select: {
            id: true,
            status: true,
            followType: true,
            createdAt: true,
          },
        })

        // Update follower counts
        await this.updateFollowerCounts(followerId, followingId, 1)

        return {
          action: 'followed',
          status: 'ACCEPTED',
          follow,
        }
      }
    } catch (error) {
      logger.error('Error following user:', error)
      throw new Error('Failed to follow user')
    }
  }

  /**
   * Unfollow a user
   */
  static async unfollowUser(followerId: string, followingId: string): Promise<boolean> {
    try {
      const follow = await prisma.followers.findUnique({
        where: {
          followerId_followingId: {
            followerId,
            followingId,
          },
        },
        select: {
          id: true,
          status: true,
        },
      })

      if (!follow || follow.status !== 'ACCEPTED') {
        return false
      }

      // Delete the follow relationship
      await prisma.followers.delete({
        where: {
          followerId_followingId: {
            followerId,
            followingId,
          },
        },
      })

      // Update follower counts
      await this.updateFollowerCounts(followerId, followingId, -1)

      return true
    } catch (error) {
      logger.error('Error unfollowing user:', error)
      throw new Error('Failed to unfollow user')
    }
  }

  /**
   * Accept follow request
   */
  static async acceptFollowRequest(followerId: string, followingId: string) {
    try {
      const follow = await prisma.followers.findUnique({
        where: {
          followerId_followingId: {
            followerId,
            followingId,
          },
        },
        select: {
          id: true,
          status: true,
        },
      })

      if (!follow || follow.status !== 'PENDING') {
        return null
      }

      // Accept the follow request
      const updatedFollow = await prisma.followers.update({
        where: {
          followerId_followingId: {
            followerId,
            followingId,
          },
        },
        data: {
          status: 'ACCEPTED',
          followType: 'FOLLOW',
          acceptedAt: new Date(),
        },
        select: {
          id: true,
          status: true,
          followType: true,
          requestMessage: true,
          createdAt: true,
          acceptedAt: true,
        },
      })

      // Update follower counts
      await this.updateFollowerCounts(followerId, followingId, 1)

      return updatedFollow
    } catch (error) {
      logger.error('Error accepting follow request:', error)
      throw new Error('Failed to accept follow request')
    }
  }

  /**
   * Reject follow request
   */
  static async rejectFollowRequest(followerId: string, followingId: string): Promise<boolean> {
    try {
      const follow = await prisma.followers.findUnique({
        where: {
          followerId_followingId: {
            followerId,
            followingId,
          },
        },
        select: {
          id: true,
          status: true,
        },
      })

      if (!follow || follow.status !== 'PENDING') {
        return false
      }

      // Delete the follow request
      await prisma.followers.delete({
        where: {
          followerId_followingId: {
            followerId,
            followingId,
          },
        },
      })

      return true
    } catch (error) {
      logger.error('Error rejecting follow request:', error)
      throw new Error('Failed to reject follow request')
    }
  }

  /**
   * Get follow requests for a user
   */
  static async getFollowRequests(filters: FollowRequestFilters) {
    const { userId, page, limit } = filters

    const skip = (page - 1) * limit

    try {
      const [requests, total] = await Promise.all([
        prisma.followers.findMany({
          where: {
            followingId: userId,
            status: 'PENDING',
          },
          select: {
            id: true,
            status: true,
            followType: true,
            requestMessage: true,
            createdAt: true,
            follower: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                bio: true,
                isVerified: true,
                followersCount: true,
                followingCount: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          skip,
          take: limit,
        }),
        prisma.followers.count({
          where: {
            followingId: userId,
            status: 'PENDING',
          },
        }),
      ])

      return {
        requests,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      }
    } catch (error) {
      logger.error('Error getting follow requests:', error)
      throw new Error('Failed to get follow requests')
    }
  }

  /**
   * Get follow status between two users
   */
  static async getFollowStatus(currentUserId: string, targetUserId: string): Promise<string> {
    try {
      const follow = await prisma.followers.findUnique({
        where: {
          followerId_followingId: {
            followerId: currentUserId,
            followingId: targetUserId,
          },
        },
        select: {
          status: true,
        },
      })

      if (!follow) {
        return 'NOT_FOLLOWING'
      }

      return follow.status
    } catch (error) {
      logger.error('Error getting follow status:', error)
      return 'UNKNOWN'
    }
  }

  /**
   * Get follower/following statistics
   */
  static async getFollowStats(userId: string) {
    try {
      const [followersCount, followingCount, pendingRequests, mutualFollows] = await Promise.all([
        prisma.followers.count({
          where: {
            followingId: userId,
            status: 'ACCEPTED',
          },
        }),
        prisma.followers.count({
          where: {
            followerId: userId,
            status: 'ACCEPTED',
          },
        }),
        prisma.followers.count({
          where: {
            followingId: userId,
            status: 'PENDING',
          },
        }),
        // Count mutual follows (users who follow each other)
        prisma.followers.count({
          where: {
            followerId: userId,
            status: 'ACCEPTED',
            following: {
              followers: {
                some: {
                  followerId: userId,
                  status: 'ACCEPTED',
                },
              },
            },
          },
        }),
      ])

      return {
        followersCount,
        followingCount,
        pendingRequests,
        mutualFollows,
      }
    } catch (error) {
      logger.error('Error getting follow stats:', error)
      throw new Error('Failed to get follow statistics')
    }
  }

  /**
   * Get suggested users to follow
   */
  static async getSuggestedUsers(userId: string, limit: number = 10) {
    try {
      // Get users followed by people the current user follows
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

      // Find users followed by these people, but not by current user
      const suggestedUsers = await prisma.followers.findMany({
        where: {
          followerId: { in: followingIdList },
          followingId: {
            not: userId,
            notIn: followingIdList,
          },
          status: 'ACCEPTED',
          following: {
            isActive: true,
          },
        },
        select: {
          following: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              bio: true,
              isVerified: true,
              followersCount: true,
            },
          },
        },
        orderBy: {
          following: {
            followersCount: 'desc',
          },
        },
        take: limit,
      })

      // Remove duplicates and return unique users
      const uniqueUsers = suggestedUsers
        .map(s => s.following)
        .filter((user, index, self) => index === self.findIndex(u => u.id === user.id))

      return uniqueUsers
    } catch (error) {
      logger.error('Error getting suggested users:', error)
      throw new Error('Failed to get suggested users')
    }
  }

  /**
   * Update follower counts for both users
   */
  private static async updateFollowerCounts(
    followerId: string,
    followingId: string,
    increment: number,
  ) {
    try {
      // Update following count for follower
      await prisma.users.update({
        where: { id: followerId },
        data: {
          followingCount: { increment },
        },
      })

      // Update followers count for following
      await prisma.users.update({
        where: { id: followingId },
        data: {
          followersCount: { increment },
        },
      })
    } catch (error) {
      logger.error('Error updating follower counts:', error)
    }
  }

  /**
   * Sync user data from User Service
   */
  static async syncUserData(userData: {
    id: string
    username: string
    displayName?: string
    avatarUrl?: string
    bio?: string
    isVerified?: boolean
    isPrivate?: boolean
  }) {
    try {
      await prisma.users.upsert({
        where: { id: userData.id },
        update: {
          username: userData.username,
          displayName: userData.displayName,
          avatarUrl: userData.avatarUrl,
          bio: userData.bio,
          isVerified: userData.isVerified,
          isPrivate: userData.isPrivate,
          lastActiveAt: new Date(),
        },
        create: {
          id: userData.id,
          username: userData.username,
          displayName: userData.displayName,
          avatarUrl: userData.avatarUrl,
          bio: userData.bio,
          isVerified: userData.isVerified || false,
          isPrivate: userData.isPrivate || false,
          isActive: true,
          lastActiveAt: new Date(),
        },
      })

      logger.info(`User data synced: ${userData.username} (${userData.id})`)
    } catch (error) {
      logger.error('Error syncing user data:', error)
      throw new Error('Failed to sync user data')
    }
  }
}
