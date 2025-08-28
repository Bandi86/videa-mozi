import { CommentsService } from '../../src/services/commentsService.js'
import { logBusinessEvent, logSecurityEvent } from '../../src/config/logger.js'

// Mock Prisma client
const mockPrisma = {
  comments: {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  posts: {
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

describe('CommentsService', () => {
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
    postId: 1,
    authorId: 1,
    parentId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    author: {
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
    _count: {
      select: {
        likes: true,
      },
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createComment', () => {
    it('should create a comment successfully', async () => {
      mockPrisma.posts.findUnique.mockResolvedValue(mockPost)
      mockPrisma.comments.findUnique.mockResolvedValue(null)
      mockPrisma.comments.create.mockResolvedValue(mockComment)

      const input = {
        content: 'Test comment',
        postId: 1,
        parentId: undefined,
        imageUrl: undefined,
      }

      const result = await CommentsService.createComment(1, input)

      expect(mockPrisma.posts.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      })
      expect(mockPrisma.comments.create).toHaveBeenCalledWith({
        data: {
          content: 'Test comment',
          postId: 1,
          authorId: 1,
          parentId: null,
          imageUrl: undefined,
        },
        include: expect.any(Object),
      })
      expect(logBusinessEvent).toHaveBeenCalledWith(
        'COMMENT_CREATED',
        'comment',
        1,
        expect.objectContaining({
          postId: 1,
          authorId: 1,
          hasParent: false,
        }),
      )
      expect(result).toEqual(mockComment)
    })

    it('should throw error if post not found', async () => {
      mockPrisma.posts.findUnique.mockResolvedValue(null)

      const input = {
        content: 'Test comment',
        postId: 999,
      }

      await expect(CommentsService.createComment(1, input)).rejects.toThrow('Post not found')
    })

    it('should throw error if parent comment not found', async () => {
      mockPrisma.posts.findUnique.mockResolvedValue(mockPost)
      mockPrisma.comments.findUnique.mockResolvedValue(null)

      const input = {
        content: 'Test reply',
        postId: 1,
        parentId: 999,
      }

      await expect(CommentsService.createComment(1, input)).rejects.toThrow(
        'Parent comment not found',
      )
    })

    it('should throw error for too many comments in short time', async () => {
      mockPrisma.posts.findUnique.mockResolvedValue(mockPost)
      mockPrisma.comments.count.mockResolvedValue(6) // Over the limit

      const input = {
        content: 'Test comment',
        postId: 1,
      }

      await expect(CommentsService.createComment(1, input)).rejects.toThrow(
        'Too many comments in a short time. Please slow down.',
      )
    })
  })

  describe('updateComment', () => {
    it('should update comment successfully', async () => {
      const existingComment = {
        ...mockComment,
        authorId: 1,
      }

      mockPrisma.comments.findUnique.mockResolvedValue(existingComment)
      mockPrisma.users.findUnique.mockResolvedValue({ roles: 'USER' })
      mockPrisma.comments.update.mockResolvedValue(mockComment)

      const input = {
        content: 'Updated comment',
        imageUrl: 'new-image.jpg',
      }

      const result = await CommentsService.updateComment(1, 1, input)

      expect(mockPrisma.comments.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          content: 'Updated comment',
          imageUrl: 'new-image.jpg',
          updatedAt: expect.any(Date),
        },
        include: expect.any(Object),
      })
      expect(result).toEqual(mockComment)
    })

    it('should throw error if comment not found', async () => {
      mockPrisma.comments.findUnique.mockResolvedValue(null)

      await expect(CommentsService.updateComment(1, 999, { content: 'test' })).rejects.toThrow(
        'Comment not found',
      )
    })

    it('should throw error if insufficient privileges', async () => {
      const existingComment = {
        ...mockComment,
        authorId: 2, // Different author
      }

      mockPrisma.comments.findUnique.mockResolvedValue(existingComment)
      mockPrisma.users.findUnique.mockResolvedValue({ roles: 'USER' })

      await expect(CommentsService.updateComment(1, 1, { content: 'test' })).rejects.toThrow(
        'Insufficient privileges to update this comment',
      )
    })
  })

  describe('deleteComment', () => {
    it('should delete comment successfully', async () => {
      const existingComment = {
        ...mockComment,
        authorId: 1,
      }

      mockPrisma.comments.findUnique.mockResolvedValue(existingComment)
      mockPrisma.users.findUnique.mockResolvedValue({ roles: 'USER' })
      mockPrisma.comments.delete.mockResolvedValue(mockComment)

      await CommentsService.deleteComment(1, 1)

      expect(mockPrisma.comments.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      })
      expect(logBusinessEvent).toHaveBeenCalledWith(
        'COMMENT_DELETED',
        'comment',
        1,
        expect.objectContaining({
          deletedBy: 1,
          postId: 1,
        }),
      )
    })

    it('should throw error if comment not found', async () => {
      mockPrisma.comments.findUnique.mockResolvedValue(null)

      await expect(CommentsService.deleteComment(1, 999)).rejects.toThrow('Comment not found')
    })

    it('should throw error if insufficient privileges', async () => {
      const existingComment = {
        ...mockComment,
        authorId: 2, // Different author
      }

      mockPrisma.comments.findUnique.mockResolvedValue(existingComment)
      mockPrisma.users.findUnique.mockResolvedValue({ roles: 'USER' })

      await expect(CommentsService.deleteComment(1, 1)).rejects.toThrow(
        'Insufficient privileges to delete this comment',
      )
    })
  })

  describe('getComments', () => {
    it('should get comments with pagination', async () => {
      const mockComments = [mockComment]
      const mockTotal = 1

      mockPrisma.comments.findMany.mockResolvedValue(mockComments)
      mockPrisma.comments.count.mockResolvedValue(mockTotal)

      const filters = {
        page: 1,
        limit: 20,
      }

      const result = await CommentsService.getComments(filters)

      expect(mockPrisma.comments.findMany).toHaveBeenCalledWith({
        where: expect.any(Object),
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      })
      expect(result).toEqual({
        comments: mockComments,
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          pages: 1,
        },
      })
    })

    it('should filter by postId', async () => {
      const mockComments = [mockComment]

      mockPrisma.comments.findMany.mockResolvedValue(mockComments)
      mockPrisma.comments.count.mockResolvedValue(1)

      const filters = {
        postId: 1,
        page: 1,
        limit: 20,
      }

      await CommentsService.getComments(filters)

      expect(mockPrisma.comments.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            postId: 1,
          }),
        }),
      )
    })

    it('should filter by authorId', async () => {
      const mockComments = [mockComment]

      mockPrisma.comments.findMany.mockResolvedValue(mockComments)
      mockPrisma.comments.count.mockResolvedValue(1)

      const filters = {
        authorId: 1,
        page: 1,
        limit: 20,
      }

      await CommentsService.getComments(filters)

      expect(mockPrisma.comments.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            authorId: 1,
          }),
        }),
      )
    })
  })

  describe('getCommentById', () => {
    it('should get comment by ID', async () => {
      const mockFullComment = {
        ...mockComment,
        replies: [],
        likes: [],
        _count: {
          likes: 5,
          replies: 2,
        },
      }

      mockPrisma.comments.findUnique.mockResolvedValue(mockFullComment)

      const result = await CommentsService.getCommentById(1)

      expect(mockPrisma.comments.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: expect.any(Object),
      })
      expect(result).toEqual(mockFullComment)
    })

    it('should throw error if comment not found', async () => {
      mockPrisma.comments.findUnique.mockResolvedValue(null)

      await expect(CommentsService.getCommentById(999)).rejects.toThrow('Comment not found')
    })
  })

  describe('getCommentsByPost', () => {
    it('should get comments by post with pagination', async () => {
      const mockComments = [mockComment]
      const mockTotal = 1

      mockPrisma.posts.findUnique.mockResolvedValue(mockPost)
      mockPrisma.comments.findMany.mockResolvedValue(mockComments)
      mockPrisma.comments.count.mockResolvedValue(mockTotal)

      const result = await CommentsService.getCommentsByPost(1, 1, 20)

      expect(mockPrisma.posts.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: { id: true, title: true },
      })
      expect(mockPrisma.comments.findMany).toHaveBeenCalledWith({
        where: {
          postId: 1,
          parentId: null,
        },
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      })
      expect(result).toEqual({
        post: mockPost,
        comments: mockComments,
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

      await expect(CommentsService.getCommentsByPost(999)).rejects.toThrow('Post not found')
    })
  })

  describe('getCommentsByUser', () => {
    it('should get comments by user with pagination', async () => {
      const mockComments = [mockComment]
      const mockTotal = 1

      mockPrisma.users.findUnique.mockResolvedValue(mockUser)
      mockPrisma.comments.findMany.mockResolvedValue(mockComments)
      mockPrisma.comments.count.mockResolvedValue(mockTotal)

      const result = await CommentsService.getCommentsByUser(1, 1, 20)

      expect(mockPrisma.users.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: { id: true, username: true },
      })
      expect(result).toEqual({
        user: mockUser,
        comments: mockComments,
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

      await expect(CommentsService.getCommentsByUser(999)).rejects.toThrow('User not found')
    })
  })

  describe('getCommentStats', () => {
    it('should get comment statistics', async () => {
      const mockStats = {
        totalComments: 10,
        topLevelComments: 8,
        repliesCount: 2,
        mostLikedComment: {
          id: 1,
          content: 'Popular comment',
          likes: { _count: 15 },
          author: { username: 'popular_user' },
        },
      }

      mockPrisma.comments.count
        .mockResolvedValueOnce(10) // totalComments
        .mockResolvedValueOnce(8) // topLevelComments
        .mockResolvedValueOnce(2) // repliesCount

      mockPrisma.comments.findFirst.mockResolvedValue(mockStats.mostLikedComment)

      const result = await CommentsService.getCommentStats()

      expect(result).toEqual(mockStats)
      expect(mockPrisma.comments.count).toHaveBeenCalledTimes(3)
      expect(mockPrisma.comments.findFirst).toHaveBeenCalled()
    })

    it('should filter stats by postId', async () => {
      mockPrisma.comments.count.mockResolvedValue(5)
      mockPrisma.comments.findFirst.mockResolvedValue(null)

      const result = await CommentsService.getCommentStats(1)

      expect(mockPrisma.comments.count).toHaveBeenCalledWith({
        where: { postId: 1 },
      })
      expect(result.totalComments).toBe(5)
    })

    it('should filter stats by authorId', async () => {
      mockPrisma.comments.count.mockResolvedValue(3)
      mockPrisma.comments.findFirst.mockResolvedValue(null)

      const result = await CommentsService.getCommentStats(undefined, 1)

      expect(mockPrisma.comments.count).toHaveBeenCalledWith({
        where: { authorId: 1 },
      })
      expect(result.totalComments).toBe(3)
    })
  })
})
