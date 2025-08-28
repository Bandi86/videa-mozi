import { prisma } from '../index.js'
import { redis } from '../index.js'
import logger from '../config/logger.js'

export interface LikeFilters {
  postId?: string
  commentId?: string
  userId?: string
  page: number
  limit: number
}

export interface ToggleLikeData {
  userId: string
  postId?: string
  commentId?: string
  type: 'LIKE' | 'LOVE' | 'LAUGH' | 'ANGRY' | 'SAD' | 'WOW'
}

export class LikesService {
  /**
   * Get likes with filtering and pagination
   */
  static async getLikes(filters: LikeFilters) {
    const { postId, commentId, userId, page, limit } = filters

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}

    if (postId) {
      where.postId = postId
    }

    if (commentId) {
      where.commentId = commentId
    }

    if (userId) {
      where.userId = userId
    }

    try {
      // Get likes and total count
      const [likes, total] = await Promise.all([
        prisma.likes.findMany({
          where,
          select: {
            id: true,
            type: true,
            reaction: true,
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
              },
            },
            comment: {
              select: {
                id: true,
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
        prisma.likes.count({ where }),
      ])

      return {
        likes,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      }
    } catch (error) {
      logger.error('Error getting likes:', error)
      throw new Error('Failed to retrieve likes')
    }
  }

  /**
   * Toggle like on a post
   */
  static async togglePostLike(
    userId: string,
    postId: string,
    type: 'LIKE' | 'LOVE' | 'LAUGH' | 'ANGRY' | 'SAD' | 'WOW',
  ) {
    try {
      // Check if post exists
      const post = await prisma.posts.findUnique({
        where: { id: postId, isDeleted: false },
        select: { id: true, likesCount: true },
      })

      if (!post) {
        throw new Error('Post not found')
      }

      // Check if user already liked this post
      const existingLike = await prisma.likes.findUnique({
        where: {
          userId_postId: {
            userId,
            postId,
          },
        },
      })

      if (existingLike) {
        // Unlike: remove the like
        await prisma.likes.delete({
          where: { id: existingLike.id },
        })

        // Decrement post likes count
        await prisma.posts.update({
          where: { id: postId },
          data: {
            likesCount: { decrement: 1 },
          },
        })

        return {
          action: 'unliked',
          like: null,
          postId,
          likesCount: post.likesCount - 1,
        }
      } else {
        // Like: create new like
        const like = await prisma.likes.create({
          data: {
            userId,
            postId,
            type,
          },
          select: {
            id: true,
            type: true,
            reaction: true,
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
        })

        // Increment post likes count
        await prisma.posts.update({
          where: { id: postId },
          data: {
            likesCount: { increment: 1 },
          },
        })

        return {
          action: 'liked',
          like,
          postId,
          likesCount: post.likesCount + 1,
        }
      }
    } catch (error) {
      logger.error('Error toggling post like:', error)
      throw new Error('Failed to toggle post like')
    }
  }

  /**
   * Toggle like on a comment
   */
  static async toggleCommentLike(
    userId: string,
    commentId: string,
    type: 'LIKE' | 'LOVE' | 'LAUGH' | 'ANGRY' | 'SAD' | 'WOW',
  ) {
    try {
      // Check if comment exists
      const comment = await prisma.comments.findUnique({
        where: { id: commentId, isDeleted: false },
        select: { id: true, likesCount: true },
      })

      if (!comment) {
        throw new Error('Comment not found')
      }

      // Check if user already liked this comment
      const existingLike = await prisma.likes.findUnique({
        where: {
          userId_commentId: {
            userId,
            commentId,
          },
        },
      })

      if (existingLike) {
        // Unlike: remove the like
        await prisma.likes.delete({
          where: { id: existingLike.id },
        })

        // Decrement comment likes count
        await prisma.comments.update({
          where: { id: commentId },
          data: {
            likesCount: { decrement: 1 },
          },
        })

        return {
          action: 'unliked',
          like: null,
          commentId,
          likesCount: comment.likesCount - 1,
        }
      } else {
        // Like: create new like
        const like = await prisma.likes.create({
          data: {
            userId,
            commentId,
            type,
          },
          select: {
            id: true,
            type: true,
            reaction: true,
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
        })

        // Increment comment likes count
        await prisma.comments.update({
          where: { id: commentId },
          data: {
            likesCount: { increment: 1 },
          },
        })

        return {
          action: 'liked',
          like,
          commentId,
          likesCount: comment.likesCount + 1,
        }
      }
    } catch (error) {
      logger.error('Error toggling comment like:', error)
      throw new Error('Failed to toggle comment like')
    }
  }

  /**
   * Get likes for a specific post
   */
  static async getPostLikes(postId: string, page: number = 1, limit: number = 20) {
    try {
      const skip = (page - 1) * limit

      const [likes, total] = await Promise.all([
        prisma.likes.findMany({
          where: { postId },
          select: {
            id: true,
            type: true,
            reaction: true,
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
        prisma.likes.count({ where: { postId } }),
      ])

      return {
        likes,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      }
    } catch (error) {
      logger.error('Error getting post likes:', error)
      throw new Error('Failed to get post likes')
    }
  }

  /**
   * Get likes for a specific comment
   */
  static async getCommentLikes(commentId: string, page: number = 1, limit: number = 20) {
    try {
      const skip = (page - 1) * limit

      const [likes, total] = await Promise.all([
        prisma.likes.findMany({
          where: { commentId },
          select: {
            id: true,
            type: true,
            reaction: true,
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
        prisma.likes.count({ where: { commentId } }),
      ])

      return {
        likes,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      }
    } catch (error) {
      logger.error('Error getting comment likes:', error)
      throw new Error('Failed to get comment likes')
    }
  }

  /**
   * Get user's liked posts
   */
  static async getUserLikedPosts(userId: string, page: number = 1, limit: number = 20) {
    try {
      const skip = (page - 1) * limit

      const [likes, total] = await Promise.all([
        prisma.likes.findMany({
          where: {
            userId,
            postId: { not: null },
          },
          select: {
            id: true,
            type: true,
            reaction: true,
            createdAt: true,
            post: {
              select: {
                id: true,
                title: true,
                content: true,
                type: true,
                mediaUrls: true,
                thumbnailUrl: true,
                likesCount: true,
                commentsCount: true,
                sharesCount: true,
                createdAt: true,
                author: {
                  select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatarUrl: true,
                    isVerified: true,
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
        prisma.likes.count({
          where: {
            userId,
            postId: { not: null },
          },
        }),
      ])

      return {
        likes,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      }
    } catch (error) {
      logger.error('Error getting user liked posts:', error)
      throw new Error('Failed to get user liked posts')
    }
  }

  /**
   * Get like statistics
   */
  static async getLikeStats() {
    try {
      const [totalLikes, postLikes, commentLikes, likeTypes] = await Promise.all([
        prisma.likes.count(),
        prisma.likes.count({ where: { postId: { not: null } } }),
        prisma.likes.count({ where: { commentId: { not: null } } }),
        prisma.likes.groupBy({
          by: ['type'],
          _count: {
            id: true,
          },
        }),
      ])

      return {
        totalLikes,
        postLikes,
        commentLikes,
        byType: likeTypes.reduce(
          (acc, curr) => {
            acc[curr.type] = curr._count.id
            return acc
          },
          {} as Record<string, number>,
        ),
      }
    } catch (error) {
      logger.error('Error getting like stats:', error)
      throw new Error('Failed to get like statistics')
    }
  }

  /**
   * Check if user liked a post or comment
   */
  static async hasUserLiked(userId: string, postId?: string, commentId?: string): Promise<boolean> {
    try {
      const where: any = { userId }

      if (postId) {
        where.postId = postId
      }

      if (commentId) {
        where.commentId = commentId
      }

      const like = await prisma.likes.findFirst({
        where,
        select: { id: true },
      })

      return !!like
    } catch (error) {
      logger.error('Error checking user like:', error)
      return false
    }
  }

  /**
   * Get user's like summary
   */
  static async getUserLikeSummary(userId: string) {
    try {
      const [totalLikes, postLikes, commentLikes, recentLikes] = await Promise.all([
        prisma.likes.count({ where: { userId } }),
        prisma.likes.count({ where: { userId, postId: { not: null } } }),
        prisma.likes.count({ where: { userId, commentId: { not: null } } }),
        prisma.likes.findMany({
          where: { userId },
          select: {
            id: true,
            type: true,
            createdAt: true,
            post: {
              select: {
                id: true,
                title: true,
                content: true,
              },
            },
            comment: {
              select: {
                id: true,
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
        totalLikes,
        postLikes,
        commentLikes,
        recentLikes,
      }
    } catch (error) {
      logger.error('Error getting user like summary:', error)
      throw new Error('Failed to get user like summary')
    }
  }
}
