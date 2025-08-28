import { prisma } from '../index.js'
import { redis } from '../index.js'
import logger from '../config/logger.js'

export interface CommentFilters {
  postId?: string
  authorId?: string
  page: number
  limit: number
}

export interface CreateCommentData {
  postId: string
  authorId: string
  content: string
  type?: 'TEXT' | 'IMAGE' | 'GIF'
  mediaUrls?: string[]
  parentId?: string
}

export class CommentsService {
  /**
   * Get comments with filtering, pagination
   */
  static async getComments(filters: CommentFilters) {
    const { postId, authorId, page, limit } = filters

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {
      isDeleted: false,
    }

    if (postId) {
      where.postId = postId
    }

    if (authorId) {
      where.authorId = authorId
    }

    try {
      // Get comments and total count
      const [comments, total] = await Promise.all([
        prisma.comments.findMany({
          where,
          select: {
            id: true,
            content: true,
            type: true,
            mediaUrls: true,
            likesCount: true,
            repliesCount: true,
            depth: true,
            path: true,
            isEdited: true,
            createdAt: true,
            updatedAt: true,
            author: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                isVerified: true,
              },
            },
            likes: {
              select: {
                id: true,
                type: true,
                user: {
                  select: {
                    id: true,
                    username: true,
                    displayName: true,
                  },
                },
              },
              take: 5,
            },
            _count: {
              select: {
                likes: true,
                replies: true,
              },
            },
          },
          orderBy: [{ depth: 'asc' }, { createdAt: 'asc' }],
          skip,
          take: limit,
        }),
        prisma.comments.count({ where }),
      ])

      return {
        comments,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      }
    } catch (error) {
      logger.error('Error getting comments:', error)
      throw new Error('Failed to retrieve comments')
    }
  }

  /**
   * Get comment by ID with full details
   */
  static async getCommentById(id: string) {
    try {
      const comment = await prisma.comments.findUnique({
        where: { id, isDeleted: false },
        select: {
          id: true,
          content: true,
          type: true,
          mediaUrls: true,
          likesCount: true,
          repliesCount: true,
          depth: true,
          path: true,
          isEdited: true,
          createdAt: true,
          updatedAt: true,
          post: {
            select: {
              id: true,
              title: true,
              content: true,
              author: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                },
              },
            },
          },
          author: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              bio: true,
              isVerified: true,
            },
          },
          likes: {
            select: {
              id: true,
              type: true,
              user: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
            },
            take: 10,
          },
          replies: {
            where: { isDeleted: false },
            select: {
              id: true,
              content: true,
              createdAt: true,
              author: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
            },
            orderBy: { createdAt: 'asc' },
            take: 10,
          },
        },
      })

      return comment
    } catch (error) {
      logger.error('Error getting comment by ID:', error)
      throw new Error('Failed to retrieve comment')
    }
  }

  /**
   * Create a new comment
   */
  static async createComment(data: CreateCommentData) {
    try {
      const { postId, authorId, content, type = 'TEXT', mediaUrls = [], parentId } = data

      let depth = 0
      let path = ''
      let parentComment = null

      // Handle reply to comment
      if (parentId) {
        parentComment = await prisma.comments.findUnique({
          where: { id: parentId, isDeleted: false },
        })

        if (!parentComment) {
          throw new Error('Parent comment not found')
        }

        depth = parentComment.depth + 1
        path = `${parentComment.path}.${parentId}`
      }

      const comment = await prisma.comments.create({
        data: {
          postId,
          authorId,
          content,
          type,
          mediaUrls,
          parentId,
          depth,
          path: parentId ? path : '',
        },
        select: {
          id: true,
          content: true,
          type: true,
          mediaUrls: true,
          likesCount: true,
          repliesCount: true,
          depth: true,
          path: true,
          isEdited: true,
          createdAt: true,
          updatedAt: true,
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
      })

      // Update parent's reply count if this is a reply
      if (parentId) {
        await prisma.comments.update({
          where: { id: parentId },
          data: {
            repliesCount: { increment: 1 },
          },
        })
      }

      // Update post's comment count
      await prisma.posts.update({
        where: { id: postId },
        data: {
          commentsCount: { increment: 1 },
        },
      })

      return comment
    } catch (error) {
      logger.error('Error creating comment:', error)
      throw new Error('Failed to create comment')
    }
  }

  /**
   * Update an existing comment
   */
  static async updateComment(id: string, authorId: string, data: Partial<CreateCommentData>) {
    try {
      const updateData: any = {
        isEdited: true,
        updatedAt: new Date(),
      }

      if (data.content !== undefined) updateData.content = data.content
      if (data.mediaUrls !== undefined) updateData.mediaUrls = data.mediaUrls

      const comment = await prisma.comments.updateMany({
        where: {
          id,
          authorId,
          isDeleted: false,
        },
        data: updateData,
      })

      if (comment.count === 0) {
        return null
      }

      return await this.getCommentById(id)
    } catch (error) {
      logger.error('Error updating comment:', error)
      throw new Error('Failed to update comment')
    }
  }

  /**
   * Delete a comment
   */
  static async deleteComment(id: string, authorId: string): Promise<boolean> {
    try {
      // Get comment data before deletion
      const comment = await prisma.comments.findFirst({
        where: {
          id,
          authorId,
          isDeleted: false,
        },
        select: {
          id: true,
          postId: true,
          parentId: true,
          depth: true,
        },
      })

      if (!comment) {
        return false
      }

      // Soft delete the comment
      await prisma.comments.update({
        where: { id },
        data: {
          isDeleted: true,
          updatedAt: new Date(),
        },
      })

      // Update parent's reply count if this was a reply
      if (comment.parentId) {
        await prisma.comments.update({
          where: { id: comment.parentId },
          data: {
            repliesCount: { decrement: 1 },
          },
        })
      }

      // Update post's comment count
      await prisma.posts.update({
        where: { id: comment.postId },
        data: {
          commentsCount: { decrement: 1 },
        },
      })

      return true
    } catch (error) {
      logger.error('Error deleting comment:', error)
      throw new Error('Failed to delete comment')
    }
  }

  /**
   * Get comment thread (parent and all replies)
   */
  static async getCommentThread(commentId: string) {
    try {
      const comment = await prisma.comments.findUnique({
        where: { id: commentId, isDeleted: false },
        select: {
          id: true,
          path: true,
        },
      })

      if (!comment) {
        return null
      }

      // Get all comments in the thread
      const threadComments = await prisma.comments.findMany({
        where: {
          OR: [
            { id: commentId },
            { path: { startsWith: `${comment.path}.` } },
            { path: { endsWith: `.${commentId}` } },
          ],
          isDeleted: false,
        },
        select: {
          id: true,
          content: true,
          type: true,
          mediaUrls: true,
          likesCount: true,
          repliesCount: true,
          depth: true,
          path: true,
          isEdited: true,
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
          likes: {
            select: {
              id: true,
              type: true,
              user: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                },
              },
            },
            take: 5,
          },
        },
        orderBy: [{ depth: 'asc' }, { createdAt: 'asc' }],
      })

      return threadComments
    } catch (error) {
      logger.error('Error getting comment thread:', error)
      throw new Error('Failed to get comment thread')
    }
  }

  /**
   * Get top comments for a post (most liked)
   */
  static async getTopComments(postId: string, limit: number = 10) {
    try {
      const comments = await prisma.comments.findMany({
        where: {
          postId,
          isDeleted: false,
          depth: 0, // Only top-level comments
        },
        select: {
          id: true,
          content: true,
          type: true,
          mediaUrls: true,
          likesCount: true,
          repliesCount: true,
          isEdited: true,
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
        orderBy: [{ likesCount: 'desc' }, { repliesCount: 'desc' }, { createdAt: 'desc' }],
        take: limit,
      })

      return comments
    } catch (error) {
      logger.error('Error getting top comments:', error)
      throw new Error('Failed to get top comments')
    }
  }

  /**
   * Get recent comments for a post
   */
  static async getRecentComments(postId: string, limit: number = 20) {
    try {
      const comments = await prisma.comments.findMany({
        where: {
          postId,
          isDeleted: false,
        },
        select: {
          id: true,
          content: true,
          type: true,
          mediaUrls: true,
          likesCount: true,
          repliesCount: true,
          depth: true,
          isEdited: true,
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
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
      })

      return comments
    } catch (error) {
      logger.error('Error getting recent comments:', error)
      throw new Error('Failed to get recent comments')
    }
  }
}
