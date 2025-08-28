import { LikesService } from '../../src/services/likesService.js'
import { logBusinessEvent, logSecurityEvent } from '../../src/config/logger.js'

// Mock Prisma client
const mockPrisma = {
  likes: {
    create: jest.fn(),
    delete: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  posts: {
    findUnique: jest.fn(),
  },
  comments: {
    findUnique: jest.fn(),
  },
  users: {
    findUnique: jest.fn(),
  },
}

jest.mock('../../src/config/prisma.js', () => ({
  default: mockPrisma,
}))

jest.mock('../../src/config/logger.js', () => ({
  logBusinessEvent: jest.fn(),
  logSecurityEvent: jest.fn(),
}))

describe('LikesService', () => {
  const mockUser = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
  }

  const mockPost = {
    id: 1,
    title: 'Test Post',
    content: 'Test content',
  }

  const mockComment = {
    id: 1,
    content: 'Test comment',
    authorId: 2,
  }

  const mockLike = {
    id: 1,
    userId: 1,
    postId: 1,
    commentId: null,
    createdAt: new Date(),
    user: {
      select: {
        id: true,
        username: true,
      },
    },
    post: {
      select: {
        id: true,
        title: true,
      },
    },
    comment: false,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createLike', () => {
    it('should create a post like successfully', async () => {
      mockPrisma.posts.findUnique.mockResolvedValue(mockPost)
      mockPrisma.likes.findFirst.mockResolvedValue(null)
      mockPrisma.likes.create.mockResolvedValue(mockLike)

      const result = await LikesService.createLike(1, 1, undefined)

      expect(mockPrisma.posts.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      })
      expect(mockPrisma.likes.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 1,
          postId: 1,
          commentId: null,
        },
      })
      expect(mockPrisma.likes.create).toHaveBeenCalledWith({
        data: {
          userId: 1,
          postId: 1,
          commentId: null,
        },
        include: expect.any(Object),
      })
      expect(result).toEqual(mockLike)
    })

    it('should create a comment like successfully', async () => {
      const commentLike = {
        ...mockLike,
        postId: null,
        commentId: 1,
        comment: {
          select: {
            id: true,
            content: true,
            author: { select: { username: true } },
          },
        },
      }

      mockPrisma.comments.findUnique.mockResolvedValue(mockComment)
      mockPrisma.likes.findFirst.mockResolvedValue(null)
      mockPrisma.likes.create.mockResolvedValue(commentLike)

      const result = await LikesService.createLike(1, undefined, 1)

      expect(mockPrisma.comments.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      })
      expect(result.commentId).toBe(1)
    })

    it('should throw error if neither postId nor commentId provided', async () => {
      await expect(LikesService.createLike(1)).rejects.toThrow(
        'Either postId or commentId must be provided, but not both',
      )
    })

    it('should throw error if both postId and commentId provided', async () => {
      await expect(LikesService.createLike(1, 1, 1)).rejects.toThrow(
        'Either postId or commentId must be provided, but not both',
      )
    })

    it('should throw error if post not found', async () => {
      mockPrisma.posts.findUnique.mockResolvedValue(null)

      await expect(LikesService.createLike(1, 999)).rejects.toThrow('Post not found')
    })

    it('should throw error if comment not found', async () => {
      mockPrisma.comments.findUnique.mockResolvedValue(null)

      await expect(LikesService.createLike(1, undefined, 999)).rejects.toThrow('Comment not found')
    })

    it('should throw error if like already exists', async () => {
      mockPrisma.posts.findUnique.mockResolvedValue(mockPost)
      mockPrisma.likes.findFirst.mockResolvedValue(mockLike)

      await expect(LikesService.createLike(1, 1)).rejects.toThrow('Like already exists')
    })
  })

  describe('deleteLike', () => {
    it('should delete like successfully', async () => {
      mockPrisma.likes.findUnique.mockResolvedValue(mockLike)
      mockPrisma.likes.delete.mockResolvedValue(mockLike)

      const result = await LikesService.deleteLike(1, 1)

      expect(mockPrisma.likes.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      })
      expect(mockPrisma.likes.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      })
      expect(result).toEqual(mockLike)
    })

    it('should throw error if like not found', async () => {
      mockPrisma.likes.findUnique.mockResolvedValue(null)

      await expect(LikesService.deleteLike(1, 999)).rejects.toThrow('Like not found')
    })

    it('should throw error if insufficient privileges', async () => {
      const otherUserLike = {
        ...mockLike,
        userId: 2, // Different user
      }

      mockPrisma.likes.findUnique.mockResolvedValue(otherUserLike)

      await expect(LikesService.deleteLike(1, 1)).rejects.toThrow(
        'Insufficient privileges to delete this like',
      )
    })
  })

  describe('getLikes', () => {
    it('should get likes with pagination', async () => {
      const mockLikes = [mockLike]
      const mockTotal = 1

      mockPrisma.likes.findMany.mockResolvedValue(mockLikes)
      mockPrisma.likes.count.mockResolvedValue(mockTotal)

      const filters = {
        page: 1,
        limit: 20,
      }

      const result = await LikesService.getLikes(filters)

      expect(mockPrisma.likes.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      })
      expect(result).toEqual({
        likes: mockLikes,
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          pages: 1,
        },
      })
    })

    it('should filter by postId', async () => {
      const mockLikes = [mockLike]

      mockPrisma.likes.findMany.mockResolvedValue(mockLikes)
      mockPrisma.likes.count.mockResolvedValue(1)

      const filters = {
        postId: 1,
        page: 1,
        limit: 20,
      }

      await LikesService.getLikes(filters)

      expect(mockPrisma.likes.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            postId: 1,
          }),
        }),
      )
    })

    it('should filter by userId', async () => {
      const mockLikes = [mockLike]

      mockPrisma.likes.findMany.mockResolvedValue(mockLikes)
      mockPrisma.likes.count.mockResolvedValue(1)

      const filters = {
        userId: 1,
        page: 1,
        limit: 20,
      }

      await LikesService.getLikes(filters)

      expect(mockPrisma.likes.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 1,
          }),
        }),
      )
    })
  })

  describe('getLikeById', () => {
    it('should get like by ID', async () => {
      const mockFullLike = {
        ...mockLike,
        _count: {
          select: {
            likes: true,
          },
        },
      }

      mockPrisma.likes.findUnique.mockResolvedValue(mockFullLike)

      const result = await LikesService.getLikeById(1)

      expect(mockPrisma.likes.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: expect.any(Object),
      })
      expect(result).toEqual(mockFullLike)
    })

    it('should throw error if like not found', async () => {
      mockPrisma.likes.findUnique.mockResolvedValue(null)

      await expect(LikesService.getLikeById(999)).rejects.toThrow('Like not found')
    })
  })

  describe('getLikesByPost', () => {
    it('should get likes by post with pagination', async () => {
      const mockLikes = [mockLike]
      const mockTotal = 1

      mockPrisma.posts.findUnique.mockResolvedValue(mockPost)
      mockPrisma.likes.findMany.mockResolvedValue(mockLikes)
      mockPrisma.likes.count.mockResolvedValue(mockTotal)

      const result = await LikesService.getLikesByPost(1, 1, 20)

      expect(mockPrisma.posts.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: { id: true, title: true },
      })
      expect(result).toEqual({
        post: mockPost,
        likes: mockLikes,
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          pages: 1,
        },
      })
    })

    it('should throw error if post not found', async () => {
      mockPrisma.posts.findUnique.mockResolvedValue(null)

      await expect(LikesService.getLikesByPost(999)).rejects.toThrow('Post not found')
    })
  })

  describe('getLikesByUser', () => {
    it('should get likes by user with pagination', async () => {
      const mockLikes = [mockLike]
      const mockTotal = 1

      mockPrisma.users.findUnique.mockResolvedValue(mockUser)
      mockPrisma.likes.findMany.mockResolvedValue(mockLikes)
      mockPrisma.likes.count.mockResolvedValue(mockTotal)

      const result = await LikesService.getLikesByUser(1, 1, 20)

      expect(mockPrisma.users.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: { id: true, username: true },
      })
      expect(result).toEqual({
        user: mockUser,
        likes: mockLikes,
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          pages: 1,
        },
      })
    })

    it('should throw error if user not found', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(null)

      await expect(LikesService.getLikesByUser(999)).rejects.toThrow('User not found')
    })
  })

  describe('toggleLike', () => {
    it('should create like when it does not exist', async () => {
      mockPrisma.posts.findUnique.mockResolvedValue(mockPost)
      mockPrisma.likes.findFirst.mockResolvedValue(null)
      mockPrisma.likes.create.mockResolvedValue(mockLike)

      const result = await LikesService.toggleLike(1, 1, undefined)

      expect(result.action).toBe('created')
      expect(result.like).toEqual(mockLike)
    })

    it('should delete like when it exists', async () => {
      mockPrisma.posts.findUnique.mockResolvedValue(mockPost)
      mockPrisma.likes.findFirst.mockResolvedValue(mockLike)
      mockPrisma.likes.delete.mockResolvedValue(mockLike)

      const result = await LikesService.toggleLike(1, 1, undefined)

      expect(result.action).toBe('deleted')
      expect(result.like).toEqual(mockLike)
    })
  })

  describe('getLikeStats', () => {
    it('should get like statistics', async () => {
      mockPrisma.likes.count
        .mockResolvedValueOnce(10) // totalLikes
        .mockResolvedValueOnce(8) // postLikes
        .mockResolvedValueOnce(2) // commentLikes

      mockPrisma.posts.findFirst.mockResolvedValue({
        id: 1,
        title: 'Popular Post',
        likes: { _count: 15 },
      })

      mockPrisma.comments.findFirst.mockResolvedValue({
        id: 1,
        content: 'Popular Comment',
        likes: { _count: 10 },
        author: { username: 'comment_author' },
      })

      const result = await LikesService.getLikeStats()

      expect(result.totalLikes).toBe(10)
      expect(result.postLikes).toBe(8)
      expect(result.commentLikes).toBe(2)
      expect(result.mostLikedPost).toBeDefined()
      expect(result.mostLikedComment).toBeDefined()
    })

    it('should filter stats by postId', async () => {
      mockPrisma.likes.count.mockResolvedValue(5)
      mockPrisma.posts.findFirst.mockResolvedValue(null)
      mockPrisma.comments.findFirst.mockResolvedValue(null)

      const result = await LikesService.getLikeStats(1)

      expect(result.totalLikes).toBe(5)
    })
  })
})
