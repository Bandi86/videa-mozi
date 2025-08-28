import prisma from '../config/database.js'
import logger, { logUserEvent } from '../config/logger.js'
import { UserRole, UserStatus, AccountVisibility, Gender } from '@prisma/client'
import { publishEvent } from '../../../../shared/src/messaging/publishers.js'
import { UserFollowedEvent, UserUnfollowedEvent } from '../../../../shared/src/messaging/events.js'
import crypto from 'crypto'

export interface CreateUserData {
  email: string
  username: string
  password: string
  firstName?: string
  lastName?: string
  displayName?: string
  bio?: string
  website?: string
  location?: string
  gender?: Gender
  dateOfBirth?: Date
  role?: UserRole
  status?: UserStatus
  visibility?: AccountVisibility
  isPrivate?: boolean
}

export interface UpdateUserData {
  firstName?: string
  lastName?: string
  displayName?: string
  bio?: string
  website?: string
  location?: string
  gender?: Gender
  dateOfBirth?: Date
  avatarUrl?: string
  coverImageUrl?: string
  visibility?: AccountVisibility
  isPrivate?: boolean
  allowMessages?: boolean
  allowTagging?: boolean
  showOnlineStatus?: boolean
}

export interface UserFilters {
  role?: UserRole
  status?: UserStatus
  visibility?: AccountVisibility
  isPrivate?: boolean
  isEmailVerified?: boolean
  gender?: Gender
  dateFrom?: Date
  dateTo?: Date
  search?: string
}

export interface PaginationOptions {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export class UserService {
  /**
   * Create a new user
   */
  async createUser(data: CreateUserData) {
    try {
      const user = await prisma.user.create({
        data: {
          email: data.email.toLowerCase(),
          username: data.username.toLowerCase(),
          password: data.password, // Should be hashed before calling this method
          firstName: data.firstName,
          lastName: data.lastName,
          displayName:
            data.displayName ||
            `${data.firstName || ''} ${data.lastName || ''}`.trim() ||
            data.username,
          bio: data.bio,
          website: data.website,
          location: data.location,
          gender: data.gender,
          dateOfBirth: data.dateOfBirth,
          role: data.role || UserRole.USER,
          status: data.status || UserStatus.ACTIVE,
          visibility: data.visibility || AccountVisibility.PUBLIC,
          isPrivate: data.isPrivate || false,
        },
        select: {
          id: true,
          email: true,
          username: true,
          displayName: true,
          firstName: true,
          lastName: true,
          bio: true,
          website: true,
          location: true,
          gender: true,
          avatarUrl: true,
          coverImageUrl: true,
          role: true,
          status: true,
          visibility: true,
          isPrivate: true,
          isEmailVerified: true,
          followersCount: true,
          followingCount: true,
          postsCount: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      logUserEvent('user_created', {
        userId: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      })

      return user
    } catch (error: any) {
      logger.error('Create user error:', error)
      throw error
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          username: true,
          displayName: true,
          firstName: true,
          lastName: true,
          bio: true,
          website: true,
          location: true,
          gender: true,
          dateOfBirth: true,
          avatarUrl: true,
          coverImageUrl: true,
          role: true,
          status: true,
          visibility: true,
          isPrivate: true,
          isEmailVerified: true,
          followersCount: true,
          followingCount: true,
          postsCount: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
          lastActiveAt: true,
        },
      })

      if (!user) {
        throw new Error('User not found')
      }

      return user
    } catch (error: any) {
      logger.error('Get user by ID error:', error)
      throw error
    }
  }

  /**
   * Get user by email or username
   */
  async getUserByEmailOrUsername(emailOrUsername: string) {
    try {
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: emailOrUsername.toLowerCase() },
            { username: emailOrUsername.toLowerCase() },
          ],
        },
        select: {
          id: true,
          email: true,
          username: true,
          displayName: true,
          firstName: true,
          lastName: true,
          bio: true,
          avatarUrl: true,
          role: true,
          status: true,
          isEmailVerified: true,
          followersCount: true,
          followingCount: true,
          postsCount: true,
        },
      })

      return user
    } catch (error: any) {
      logger.error('Get user by email/username error:', error)
      throw error
    }
  }

  /**
   * Get users with filtering and pagination
   */
  async getUsers(filters: UserFilters = {}, pagination: PaginationOptions = {}) {
    try {
      const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = pagination

      const where: any = {}

      if (filters.role) where.role = filters.role
      if (filters.status) where.status = filters.status
      if (filters.visibility) where.visibility = filters.visibility
      if (filters.isPrivate !== undefined) where.isPrivate = filters.isPrivate
      if (filters.isEmailVerified !== undefined) where.isEmailVerified = filters.isEmailVerified
      if (filters.gender) where.gender = filters.gender

      if (filters.dateFrom || filters.dateTo) {
        where.createdAt = {}
        if (filters.dateFrom) where.createdAt.gte = filters.dateFrom
        if (filters.dateTo) where.createdAt.lte = filters.dateTo
      }

      if (filters.search) {
        where.OR = [
          { username: { contains: filters.search, mode: 'insensitive' } },
          { displayName: { contains: filters.search, mode: 'insensitive' } },
          { email: { contains: filters.search, mode: 'insensitive' } },
        ]
      }

      const total = await prisma.user.count({ where })
      const users = await prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          username: true,
          displayName: true,
          firstName: true,
          lastName: true,
          bio: true,
          website: true,
          location: true,
          gender: true,
          avatarUrl: true,
          coverImageUrl: true,
          role: true,
          status: true,
          visibility: true,
          isPrivate: true,
          isEmailVerified: true,
          followersCount: true,
          followingCount: true,
          postsCount: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
          lastActiveAt: true,
        },
        orderBy: {
          [sortBy]: sortOrder,
        },
        skip: (page - 1) * limit,
        take: limit,
      })

      return {
        data: users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      }
    } catch (error: any) {
      logger.error('Get users error:', error)
      throw new Error('Failed to get users')
    }
  }

  /**
   * Update user
   */
  async updateUser(id: string, updateData: UpdateUserData) {
    try {
      const user = await prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          email: true,
          username: true,
          displayName: true,
          firstName: true,
          lastName: true,
          bio: true,
          website: true,
          location: true,
          gender: true,
          dateOfBirth: true,
          avatarUrl: true,
          coverImageUrl: true,
          role: true,
          status: true,
          visibility: true,
          isPrivate: true,
          isEmailVerified: true,
          followersCount: true,
          followingCount: true,
          postsCount: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      logUserEvent('user_updated', {
        userId: id,
        updatedFields: Object.keys(updateData),
      })

      return user
    } catch (error: any) {
      logger.error('Update user error:', error)
      throw new Error('Failed to update user')
    }
  }

  /**
   * Delete user (soft delete)
   */
  async deleteUser(id: string) {
    try {
      const user = await prisma.user.update({
        where: { id },
        data: {
          status: UserStatus.DELETED,
          deletedAt: new Date(),
        },
        select: {
          id: true,
          email: true,
          username: true,
        },
      })

      logUserEvent('user_deleted', {
        userId: id,
        email: user.email,
        username: user.username,
      })

      return user
    } catch (error: any) {
      logger.error('Delete user error:', error)
      throw new Error('Failed to delete user')
    }
  }

  /**
   * Follow user
   */
  async followUser(followerId: string, followingId: string) {
    try {
      if (followerId === followingId) {
        throw new Error('Users cannot follow themselves')
      }

      // Check if already following
      const existingFollow = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId,
            followingId,
          },
        },
      })

      if (existingFollow) {
        throw new Error('Already following this user')
      }

      // Check if users exist
      const [follower, following] = await Promise.all([
        prisma.user.findUnique({ where: { id: followerId } }),
        prisma.user.findUnique({ where: { id: followingId } }),
      ])

      if (!follower || !following) {
        throw new Error('User not found')
      }

      // Create follow relationship
      const follow = await prisma.follow.create({
        data: {
          followerId,
          followingId,
        },
      })

      // Update follower counts
      await Promise.all([
        prisma.user.update({
          where: { id: followerId },
          data: { followingCount: { increment: 1 } },
        }),
        prisma.user.update({
          where: { id: followingId },
          data: { followersCount: { increment: 1 } },
        }),
      ])

      logUserEvent('user_followed', {
        followerId,
        followingId,
      })

      // Publish follow created event
      const followCreatedEvent: UserFollowedEvent = {
        eventId: crypto.randomUUID(),
        eventType: 'user.followed',
        timestamp: new Date().toISOString(),
        source: 'user-service',
        version: '1.0',
        data: {
          followerId,
          followingId,
          createdAt: follow.createdAt.toISOString(),
        },
      }

      await publishEvent(followCreatedEvent)
      logger.info(`📤 Published user.followed event: ${followerId} -> ${followingId}`)

      return follow
    } catch (error: any) {
      logger.error('Follow user error:', error)
      throw error
    }
  }

  /**
   * Unfollow user
   */
  async unfollowUser(followerId: string, followingId: string) {
    try {
      const follow = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId,
            followingId,
          },
        },
      })

      if (!follow) {
        throw new Error('Not following this user')
      }

      await prisma.follow.delete({
        where: {
          followerId_followingId: {
            followerId,
            followingId,
          },
        },
      })

      // Update follower counts
      await Promise.all([
        prisma.user.update({
          where: { id: followerId },
          data: { followingCount: { decrement: 1 } },
        }),
        prisma.user.update({
          where: { id: followingId },
          data: { followersCount: { decrement: 1 } },
        }),
      ])

      logUserEvent('user_unfollowed', {
        followerId,
        followingId,
      })

      // Publish follow removed event
      const followRemovedEvent: UserUnfollowedEvent = {
        eventId: crypto.randomUUID(),
        eventType: 'user.unfollowed',
        timestamp: new Date().toISOString(),
        source: 'user-service',
        version: '1.0',
        data: {
          followerId,
          followingId,
          createdAt: new Date().toISOString(),
        },
      }

      await publishEvent(followRemovedEvent)
      logger.info(`📤 Published user.unfollowed event: ${followerId} -> ${followingId}`)

      return true
    } catch (error: any) {
      logger.error('Unfollow user error:', error)
      throw error
    }
  }

  /**
   * Get followers
   */
  async getFollowers(userId: string, pagination: PaginationOptions = {}) {
    try {
      const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = pagination

      const followers = await prisma.follow.findMany({
        where: { followingId: userId },
        include: {
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
          [sortBy]: sortOrder,
        },
        skip: (page - 1) * limit,
        take: limit,
      })

      const total = await prisma.follow.count({
        where: { followingId: userId },
      })

      return {
        data: followers.map(f => f.follower),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      }
    } catch (error: any) {
      logger.error('Get followers error:', error)
      throw new Error('Failed to get followers')
    }
  }

  /**
   * Get following
   */
  async getFollowing(userId: string, pagination: PaginationOptions = {}) {
    try {
      const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = pagination

      const following = await prisma.follow.findMany({
        where: { followerId: userId },
        include: {
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
        },
        orderBy: {
          [sortBy]: sortOrder,
        },
        skip: (page - 1) * limit,
        take: limit,
      })

      const total = await prisma.follow.count({
        where: { followerId: userId },
      })

      return {
        data: following.map(f => f.following),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      }
    } catch (error: any) {
      logger.error('Get following error:', error)
      throw new Error('Failed to get following')
    }
  }

  /**
   * Check follow status
   */
  async getFollowStatus(followerId: string, followingId: string) {
    try {
      const follow = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId,
            followingId,
          },
        },
      })

      return {
        isFollowing: !!follow,
        status: follow?.status || null,
        followType: follow?.followType || null,
      }
    } catch (error: any) {
      logger.error('Get follow status error:', error)
      throw new Error('Failed to get follow status')
    }
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(userId: string, preferences: any) {
    try {
      const userPreferences = await prisma.userPreference.upsert({
        where: { userId },
        update: preferences,
        create: {
          userId,
          ...preferences,
        },
      })

      logUserEvent('preferences_updated', {
        userId,
        preferences: Object.keys(preferences),
      })

      return userPreferences
    } catch (error: any) {
      logger.error('Update user preferences error:', error)
      throw new Error('Failed to update user preferences')
    }
  }

  /**
   * Get user preferences
   */
  async getUserPreferences(userId: string) {
    try {
      const preferences = await prisma.userPreference.findUnique({
        where: { userId },
      })

      return preferences
    } catch (error: any) {
      logger.error('Get user preferences error:', error)
      throw new Error('Failed to get user preferences')
    }
  }

  /**
   * Update user stats (for cross-service sync)
   */
  async updateUserStats(
    userId: string,
    stats: {
      followersCount?: number
      followingCount?: number
      postsCount?: number
    },
  ) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: stats,
      })

      logUserEvent('stats_updated', {
        userId,
        stats,
      })

      return true
    } catch (error: any) {
      logger.error('Update user stats error:', error)
      throw new Error('Failed to update user stats')
    }
  }

  /**
   * Search users
   */
  async searchUsers(query: string, pagination: PaginationOptions = {}) {
    try {
      const { page = 1, limit = 20 } = pagination

      const where = {
        OR: [
          { username: { contains: query, mode: 'insensitive' } },
          { displayName: { contains: query, mode: 'insensitive' } },
        ],
        status: UserStatus.ACTIVE,
      }

      const total = await prisma.user.count({ where })
      const users = await prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          bio: true,
          isVerified: true,
          followersCount: true,
          followingCount: true,
          postsCount: true,
        },
        orderBy: {
          followersCount: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      })

      return {
        data: users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      }
    } catch (error: any) {
      logger.error('Search users error:', error)
      throw new Error('Failed to search users')
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(dateFrom?: Date, dateTo?: Date) {
    try {
      const where: any = {}

      if (dateFrom || dateTo) {
        where.createdAt = {}
        if (dateFrom) where.createdAt.gte = dateFrom
        if (dateTo) where.createdAt.lte = dateTo
      }

      const [totalUsers, activeUsers, verifiedUsers, usersByRole, usersByStatus] =
        await Promise.all([
          prisma.user.count({ where }),
          prisma.user.count({ where: { ...where, status: UserStatus.ACTIVE } }),
          prisma.user.count({ where: { ...where, isEmailVerified: true } }),
          prisma.user.groupBy({
            by: ['role'],
            where,
            _count: true,
          }),
          prisma.user.groupBy({
            by: ['status'],
            where,
            _count: true,
          }),
        ])

      return {
        total: totalUsers,
        active: activeUsers,
        verified: verifiedUsers,
        byRole: usersByRole.reduce(
          (acc, item) => {
            acc[item.role] = item._count
            return acc
          },
          {} as Record<string, number>,
        ),
        byStatus: usersByStatus.reduce(
          (acc, item) => {
            acc[item.status] = item._count
            return acc
          },
          {} as Record<string, number>,
        ),
      }
    } catch (error: any) {
      logger.error('Get user stats error:', error)
      throw new Error('Failed to get user statistics')
    }
  }
}

export const userService = new UserService()
