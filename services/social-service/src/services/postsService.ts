import { prisma } from '../index.js'
import { redis } from '../index.js'
import logger from '../config/logger.js'

export interface PostFilters {
  page: number
  limit: number
  authorId?: string
  type?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'LINK' | 'POLL'
  visibility?: 'PUBLIC' | 'FRIENDS' | 'PRIVATE'
  search?: string
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

export interface CreatePostData {
  authorId: string
  title?: string
  content: string
  type?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'LINK' | 'POLL'
  visibility?: 'PUBLIC' | 'FRIENDS' | 'PRIVATE'
  mediaUrls?: string[]
  thumbnailUrl?: string
  tags?: string[]
  mentions?: string[]
  location?: string
  originalPostId?: string
  replyToId?: string
  threadId?: string
}

export class PostsService {
  /**
   * Get posts with filtering, pagination, and sorting
   */
  static async getPosts(filters: PostFilters) {
    const {
      page,
      limit,
      authorId,
      type,
      visibility = 'PUBLIC',
      search,
      sortBy,
      sortOrder,
    } = filters

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {
      isDeleted: false,
    }

    if (authorId) {
      where.authorId = authorId
    }

    if (type) {
      where.type = type
    }

    if (visibility) {
      where.visibility = visibility
    }

    if (search) {
      where.OR = [
        { content: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
        { tags: { hasSome: [search] } },
      ]
    }

    // Build order clause
    const orderBy: any = {}
    orderBy[sortBy] = sortOrder

    try {
      // Get posts and total count
      const [posts, total] = await Promise.all([
        prisma.posts.findMany({
          where,
          select: {
            id: true,
            title: true,
            content: true,
            type: true,
            visibility: true,
            mediaUrls: true,
            thumbnailUrl: true,
            tags: true,
            mentions: true,
            location: true,
            likesCount: true,
            commentsCount: true,
            sharesCount: true,
            viewsCount: true,
            isPinned: true,
            isEdited: true,
            originalPostId: true,
            replyToId: true,
            threadId: true,
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
            originalPost: {
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
            _count: {
              select: {
                likes: true,
                comments: true,
                shares: true,
              },
            },
          },
          orderBy,
          skip,
          take: limit,
        }),
        prisma.posts.count({ where }),
      ])

      return {
        posts,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      }
    } catch (error) {
      logger.error('Error getting posts:', error)
      throw new Error('Failed to retrieve posts')
    }
  }

  /**
   * Get post by ID with full details
   */
  static async getPostById(id: string) {
    try {
      const post = await prisma.posts.findUnique({
        where: { id, isDeleted: false },
        select: {
          id: true,
          title: true,
          content: true,
          type: true,
          visibility: true,
          mediaUrls: true,
          thumbnailUrl: true,
          tags: true,
          mentions: true,
          location: true,
          likesCount: true,
          commentsCount: true,
          sharesCount: true,
          viewsCount: true,
          isPinned: true,
          isEdited: true,
          originalPostId: true,
          replyToId: true,
          threadId: true,
          createdAt: true,
          updatedAt: true,
          author: {
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
          originalPost: {
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
          comments: {
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
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
      })

      return post
    } catch (error) {
      logger.error('Error getting post by ID:', error)
      throw new Error('Failed to retrieve post')
    }
  }

  /**
   * Create a new post
   */
  static async createPost(data: CreatePostData) {
    try {
      const {
        authorId,
        title,
        content,
        type = 'TEXT',
        visibility = 'PUBLIC',
        mediaUrls = [],
        thumbnailUrl,
        tags = [],
        mentions = [],
        location,
        originalPostId,
        replyToId,
        threadId,
      } = data

      // Process hashtags from content and tags
      const hashtags = this.extractHashtags(content, tags)

      // Update hashtag counts
      await this.updateHashtagCounts(hashtags, 1)

      const post = await prisma.posts.create({
        data: {
          authorId,
          title,
          content,
          type,
          visibility,
          mediaUrls,
          thumbnailUrl,
          tags: hashtags,
          mentions,
          location,
          originalPostId,
          replyToId,
          threadId,
        },
        select: {
          id: true,
          title: true,
          content: true,
          type: true,
          visibility: true,
          mediaUrls: true,
          thumbnailUrl: true,
          tags: true,
          mentions: true,
          location: true,
          likesCount: true,
          commentsCount: true,
          sharesCount: true,
          viewsCount: true,
          isPinned: true,
          isEdited: true,
          originalPostId: true,
          replyToId: true,
          threadId: true,
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

      return post
    } catch (error) {
      logger.error('Error creating post:', error)
      throw new Error('Failed to create post')
    }
  }

  /**
   * Update an existing post
   */
  static async updatePost(id: string, authorId: string, data: Partial<CreatePostData>) {
    try {
      // Check if post exists and user is author
      const existingPost = await prisma.posts.findFirst({
        where: {
          id,
          authorId,
          isDeleted: false,
        },
        select: {
          id: true,
          tags: true,
          content: true,
        },
      })

      if (!existingPost) {
        return null
      }

      const updateData: any = {
        isEdited: true,
        updatedAt: new Date(),
      }

      if (data.title !== undefined) updateData.title = data.title
      if (data.content !== undefined) updateData.content = data.content
      if (data.mediaUrls !== undefined) updateData.mediaUrls = data.mediaUrls
      if (data.thumbnailUrl !== undefined) updateData.thumbnailUrl = data.thumbnailUrl
      if (data.tags !== undefined) updateData.tags = data.tags
      if (data.mentions !== undefined) updateData.mentions = data.mentions
      if (data.location !== undefined) updateData.location = data.location

      // Handle hashtag updates
      if (data.content !== undefined || data.tags !== undefined) {
        const newContent = data.content !== undefined ? data.content : existingPost.content
        const newTags = data.tags !== undefined ? data.tags : existingPost.tags
        const newHashtags = this.extractHashtags(newContent, newTags)

        // Decrease old hashtag counts
        await this.updateHashtagCounts(existingPost.tags, -1)

        // Increase new hashtag counts
        await this.updateHashtagCounts(newHashtags, 1)

        updateData.tags = newHashtags
      }

      const post = await prisma.posts.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          title: true,
          content: true,
          type: true,
          visibility: true,
          mediaUrls: true,
          thumbnailUrl: true,
          tags: true,
          mentions: true,
          location: true,
          likesCount: true,
          commentsCount: true,
          sharesCount: true,
          viewsCount: true,
          isPinned: true,
          isEdited: true,
          originalPostId: true,
          replyToId: true,
          threadId: true,
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

      return post
    } catch (error) {
      logger.error('Error updating post:', error)
      throw new Error('Failed to update post')
    }
  }

  /**
   * Delete a post
   */
  static async deletePost(id: string, authorId: string): Promise<boolean> {
    try {
      // Get post data before deletion for hashtag cleanup
      const post = await prisma.posts.findFirst({
        where: {
          id,
          authorId,
          isDeleted: false,
        },
        select: {
          id: true,
          tags: true,
        },
      })

      if (!post) {
        return false
      }

      // Decrease hashtag counts
      await this.updateHashtagCounts(post.tags, -1)

      // Soft delete the post
      await prisma.posts.update({
        where: { id },
        data: {
          isDeleted: true,
          updatedAt: new Date(),
        },
      })

      return true
    } catch (error) {
      logger.error('Error deleting post:', error)
      throw new Error('Failed to delete post')
    }
  }

  /**
   * Pin or unpin a post
   */
  static async pinPost(id: string, authorId: string, pinned: boolean) {
    try {
      const post = await prisma.posts.updateMany({
        where: {
          id,
          authorId,
          isDeleted: false,
        },
        data: {
          isPinned: pinned,
          updatedAt: new Date(),
        },
      })

      if (post.count === 0) {
        return null
      }

      return await this.getPostById(id)
    } catch (error) {
      logger.error('Error pinning post:', error)
      throw new Error('Failed to pin/unpin post')
    }
  }

  /**
   * Get user's feed posts
   */
  static async getUserFeed(userId: string, page: number = 1, limit: number = 20) {
    try {
      const skip = (page - 1) * limit

      // Get posts from followed users and own posts
      const followedUserIds = await this.getFollowedUserIds(userId)

      const posts = await prisma.posts.findMany({
        where: {
          isDeleted: false,
          OR: [
            { authorId: userId },
            {
              authorId: { in: followedUserIds },
              visibility: 'PUBLIC',
            },
          ],
        },
        select: {
          id: true,
          title: true,
          content: true,
          type: true,
          visibility: true,
          mediaUrls: true,
          thumbnailUrl: true,
          tags: true,
          mentions: true,
          location: true,
          likesCount: true,
          commentsCount: true,
          sharesCount: true,
          viewsCount: true,
          isPinned: true,
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
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      })

      return posts
    } catch (error) {
      logger.error('Error getting user feed:', error)
      throw new Error('Failed to get user feed')
    }
  }

  /**
   * Search posts
   */
  static async searchPosts(query: string, limit: number = 20) {
    try {
      const posts = await prisma.posts.findMany({
        where: {
          isDeleted: false,
          visibility: 'PUBLIC',
          OR: [
            { content: { contains: query, mode: 'insensitive' } },
            { title: { contains: query, mode: 'insensitive' } },
            { tags: { hasSome: [query] } },
            { author: { username: { contains: query, mode: 'insensitive' } } },
            { author: { displayName: { contains: query, mode: 'insensitive' } } },
          ],
        },
        select: {
          id: true,
          title: true,
          content: true,
          type: true,
          mediaUrls: true,
          thumbnailUrl: true,
          tags: true,
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
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
      })

      return posts
    } catch (error) {
      logger.error('Error searching posts:', error)
      throw new Error('Failed to search posts')
    }
  }

  /**
   * Get trending posts
   */
  static async getTrendingPosts(limit: number = 10, period: 'day' | 'week' | 'month' = 'week') {
    try {
      // Calculate date based on period
      const now = new Date()
      let startDate: Date

      switch (period) {
        case 'day':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
          break
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
      }

      const posts = await prisma.posts.findMany({
        where: {
          isDeleted: false,
          visibility: 'PUBLIC',
          createdAt: { gte: startDate },
        },
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
          viewsCount: true,
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
        orderBy: [{ likesCount: 'desc' }, { commentsCount: 'desc' }, { sharesCount: 'desc' }],
        take: limit,
      })

      return posts
    } catch (error) {
      logger.error('Error getting trending posts:', error)
      throw new Error('Failed to get trending posts')
    }
  }

  /**
   * Extract hashtags from content and tags array
   */
  private static extractHashtags(content: string, additionalTags: string[] = []): string[] {
    const hashtagRegex = /#[\w]+/g
    const contentHashtags = content.match(hashtagRegex) || []

    // Clean hashtags (remove #)
    const cleanContentHashtags = contentHashtags.map(tag => tag.slice(1).toLowerCase())

    // Combine and deduplicate
    const allHashtags = [...cleanContentHashtags, ...additionalTags]
    return [...new Set(allHashtags)]
  }

  /**
   * Update hashtag counts
   */
  private static async updateHashtagCounts(hashtags: string[], increment: number): Promise<void> {
    try {
      for (const hashtag of hashtags) {
        if (increment > 0) {
          // Increment count
          const existing = await prisma.hashtags.findUnique({
            where: { tag: hashtag },
          })

          if (existing) {
            await prisma.hashtags.update({
              where: { tag: hashtag },
              data: {
                count: { increment: 1 },
                lastUsed: new Date(),
              },
            })
          } else {
            await prisma.hashtags.create({
              data: {
                tag: hashtag,
                count: 1,
                lastUsed: new Date(),
              },
            })
          }
        } else {
          // Decrement count
          const existing = await prisma.hashtags.findUnique({
            where: { tag: hashtag },
          })

          if (existing) {
            const newCount = Math.max(0, existing.count - 1)
            if (newCount === 0) {
              await prisma.hashtags.delete({
                where: { tag: hashtag },
              })
            } else {
              await prisma.hashtags.update({
                where: { tag: hashtag },
                data: {
                  count: newCount,
                },
              })
            }
          }
        }
      }
    } catch (error) {
      logger.error('Error updating hashtag counts:', error)
    }
  }

  /**
   * Get followed user IDs for feed generation
   */
  private static async getFollowedUserIds(userId: string): Promise<string[]> {
    try {
      const followers = await prisma.followers.findMany({
        where: {
          followerId: userId,
          status: 'ACCEPTED',
        },
        select: {
          followingId: true,
        },
      })

      return followers.map(f => f.followingId)
    } catch (error) {
      logger.error('Error getting followed user IDs:', error)
      return []
    }
  }
}
