import { prisma } from '../index.js'
import { redis } from '../index.js'
import logger from '../config/logger.js'

export interface ShareFilters {
  postId?: string
  userId?: string
  type?: 'SHARE' | 'REPOST' | 'QUOTE'
  page: number
  limit: number
}

export interface CreateShareData {
  userId: string
  postId: string
  shareType: 'SHARE' | 'REPOST' | 'QUOTE'
  quoteText?: string
  quoteMedia?: string[]
}

export class SharesService {
  /**
   * Get shares with filtering and pagination
   */
  static async getShares(filters: ShareFilters) {
    const { postId, userId, type, page, limit } = filters

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}

    if (postId) {
      where.postId = postId
    }

    if (userId) {
      where.userId = userId
    }

    if (type) {
      where.shareType = type
    }

    try {
      // Get shares and total count
      const [shares, total] = await Promise.all([
        prisma.shares.findMany({
          where,
          select: {
            id: true,
            shareType: true,
            quoteText: true,
            quoteMedia: true,
            createdAt: true,
            user: {
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
                mediaUrls: true,
                thumbnailUrl: true,
                author: {
                  select: {
                    id: true,
                    username: true,
                    displayName: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          skip,
          take: limit,
        }),
        prisma.shares.count({ where }),
      ])

      return {
        shares,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      }
    } catch (error) {
      logger.error('Error getting shares:', error)
      throw new Error('Failed to retrieve shares')
    }
  }

  /**
   * Create a new share
   */
  static async createShare(data: CreateShareData) {
    try {
      const { userId, postId, shareType, quoteText, quoteMedia = [] } = data

      // Check if post exists and is not deleted
      const post = await prisma.posts.findUnique({
        where: { id: postId, isDeleted: false },
        select: { id: true, sharesCount: true },
      })

      if (!post) {
        throw new Error('Post not found')
      }

      // Check if user already shared this post (prevent duplicate shares)
      const existingShare = await prisma.shares.findUnique({
        where: {
          userId_postId: {
            userId,
            postId,
          },
        },
      })

      if (existingShare) {
        throw new Error('Post already shared by this user')
      }

      // Create the share
      const share = await prisma.shares.create({
        data: {
          userId,
          postId,
          shareType,
          quoteText: shareType === 'QUOTE' ? quoteText : null,
          quoteMedia: shareType === 'QUOTE' ? quoteMedia : [],
        },
        select: {
          id: true,
          shareType: true,
          quoteText: true,
          quoteMedia: true,
          createdAt: true,
          user: {
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
              mediaUrls: true,
              thumbnailUrl: true,
              author: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                },
              },
            },
          },
        },
      })

      // Increment post shares count
      await prisma.posts.update({
        where: { id: postId },
        data: {
          sharesCount: { increment: 1 },
        },
      })

      // If this is a repost, also create a post in the user's timeline
      if (shareType === 'REPOST') {
        await this.createRepostPost(userId, postId)
      }

      return share
    } catch (error) {
      logger.error('Error creating share:', error)
      throw new Error('Failed to create share')
    }
  }

  /**
   * Delete a share
   */
  static async deleteShare(shareId: string, userId: string): Promise<boolean> {
    try {
      // Get share data before deletion
      const share = await prisma.shares.findFirst({
        where: {
          id: shareId,
          userId,
        },
        select: {
          id: true,
          postId: true,
          shareType: true,
        },
      })

      if (!share) {
        return false
      }

      // Delete the share
      await prisma.shares.delete({
        where: { id: shareId },
      })

      // Decrement post shares count
      await prisma.posts.update({
        where: { id: share.postId },
        data: {
          sharesCount: { decrement: 1 },
        },
      })

      // If this was a repost, also delete the associated post
      if (share.shareType === 'REPOST') {
        await this.deleteRepostPost(userId, share.postId)
      }

      return true
    } catch (error) {
      logger.error('Error deleting share:', error)
      throw new Error('Failed to delete share')
    }
  }

  /**
   * Get shares for a specific post
   */
  static async getPostShares(postId: string, page: number = 1, limit: number = 20) {
    try {
      const skip = (page - 1) * limit

      const [shares, total] = await Promise.all([
        prisma.shares.findMany({
          where: { postId },
          select: {
            id: true,
            shareType: true,
            quoteText: true,
            quoteMedia: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                isVerified: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          skip,
          take: limit,
        }),
        prisma.shares.count({ where: { postId } }),
      ])

      return {
        shares,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      }
    } catch (error) {
      logger.error('Error getting post shares:', error)
      throw new Error('Failed to get post shares')
    }
  }

  /**
   * Get user's shares
   */
  static async getUserShares(userId: string, page: number = 1, limit: number = 20) {
    try {
      const skip = (page - 1) * limit

      const [shares, total] = await Promise.all([
        prisma.shares.findMany({
          where: { userId },
          select: {
            id: true,
            shareType: true,
            quoteText: true,
            quoteMedia: true,
            createdAt: true,
            post: {
              select: {
                id: true,
                title: true,
                content: true,
                type: true,
                mediaUrls: true,
                thumbnailUrl: true,
                author: {
                  select: {
                    id: true,
                    username: true,
                    displayName: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          skip,
          take: limit,
        }),
        prisma.shares.count({ where: { userId } }),
      ])

      return {
        shares,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      }
    } catch (error) {
      logger.error('Error getting user shares:', error)
      throw new Error('Failed to get user shares')
    }
  }

  /**
   * Get share statistics
   */
  static async getShareStats() {
    try {
      const [totalShares, shareTypes, topSharedPosts] = await Promise.all([
        prisma.shares.count(),
        prisma.shares.groupBy({
          by: ['shareType'],
          _count: {
            id: true,
          },
        }),
        prisma.posts.findMany({
          select: {
            id: true,
            title: true,
            content: true,
            sharesCount: true,
            author: {
              select: {
                id: true,
                username: true,
                displayName: true,
              },
            },
          },
          orderBy: {
            sharesCount: 'desc',
          },
          take: 10,
        }),
      ])

      return {
        totalShares,
        byType: shareTypes.reduce(
          (acc, curr) => {
            acc[curr.shareType] = curr._count.id
            return acc
          },
          {} as Record<string, number>,
        ),
        topSharedPosts,
      }
    } catch (error) {
      logger.error('Error getting share stats:', error)
      throw new Error('Failed to get share statistics')
    }
  }

  /**
   * Check if user shared a post
   */
  static async hasUserShared(userId: string, postId: string): Promise<boolean> {
    try {
      const share = await prisma.shares.findUnique({
        where: {
          userId_postId: {
            userId,
            postId,
          },
        },
        select: { id: true },
      })

      return !!share
    } catch (error) {
      logger.error('Error checking user share:', error)
      return false
    }
  }

  /**
   * Get user's share summary
   */
  static async getUserShareSummary(userId: string) {
    try {
      const [totalShares, shareTypes, recentShares] = await Promise.all([
        prisma.shares.count({ where: { userId } }),
        prisma.shares.groupBy({
          by: ['shareType'],
          where: { userId },
          _count: {
            id: true,
          },
        }),
        prisma.shares.findMany({
          where: { userId },
          select: {
            id: true,
            shareType: true,
            quoteText: true,
            createdAt: true,
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
          take: 10,
        }),
      ])

      return {
        totalShares,
        byType: shareTypes.reduce(
          (acc, curr) => {
            acc[curr.shareType] = curr._count.id
            return acc
          },
          {} as Record<string, number>,
        ),
        recentShares,
      }
    } catch (error) {
      logger.error('Error getting user share summary:', error)
      throw new Error('Failed to get user share summary')
    }
  }

  /**
   * Create a repost post (when user reposts)
   */
  private static async createRepostPost(userId: string, originalPostId: string) {
    try {
      const originalPost = await prisma.posts.findUnique({
        where: { id: originalPostId },
        select: {
          title: true,
          content: true,
          mediaUrls: true,
          thumbnailUrl: true,
          tags: true,
          author: {
            select: {
              username: true,
              displayName: true,
            },
          },
        },
      })

      if (!originalPost) return

      // Create a new post with repost content
      await prisma.posts.create({
        data: {
          authorId: userId,
          title: originalPost.title,
          content: `Reposted from @${originalPost.author.username}: ${originalPost.content}`,
          type: 'TEXT',
          visibility: 'PUBLIC',
          mediaUrls: originalPost.mediaUrls,
          thumbnailUrl: originalPost.thumbnailUrl,
          tags: originalPost.tags,
          originalPostId,
        },
      })
    } catch (error) {
      logger.error('Error creating repost post:', error)
    }
  }

  /**
   * Delete repost post (when user unshares)
   */
  private static async deleteRepostPost(userId: string, originalPostId: string) {
    try {
      await prisma.posts.deleteMany({
        where: {
          authorId: userId,
          originalPostId,
        },
      })
    } catch (error) {
      logger.error('Error deleting repost post:', error)
    }
  }
}
