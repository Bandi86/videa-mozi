import request from 'supertest'
import express from 'express'
import { CommentsService } from '../../src/services/commentsService.js'
import {
  createComment,
  updateComment,
  deleteComment,
  getComments,
  getCommentById,
  getCommentsByPost,
  getCommentsByUser,
  getCommentStats,
} from '../../src/controllers/commentsController.js'

// Mock the service
jest.mock('../../src/services/commentsService.js')

// Mock the utilities
jest.mock('../../src/utils/common.js', () => ({
  getUserId: jest.fn(),
  handleControllerError: jest.fn(),
}))

// Create a test app
const app = express()
app.use(express.json())

// Mock authentication middleware
const mockAuth = (req: any, res: any, next: any) => {
  req.user = { id: 1, username: 'testuser' }
  next()
}

// Routes
app.post('/comments', mockAuth, createComment)
app.put('/comments/:id', mockAuth, updateComment)
app.delete('/comments/:id', mockAuth, deleteComment)
app.get('/comments', getComments)
app.get('/comments/:id', getCommentById)
app.get('/posts/:postId/comments', getCommentsByPost)
app.get('/users/:userId/comments', getCommentsByUser)
app.get('/comments/stats', getCommentStats)

const agent = request(app)

describe('Comments Controller', () => {
  const mockComment = {
    id: 1,
    content: 'Test comment',
    postId: 1,
    authorId: 1,
    parentId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    author: {
      id: 1,
      username: 'testuser',
    },
    post: {
      id: 1,
      title: 'Test Post',
    },
    _count: {
      likes: 5,
    },
  }

  const mockPaginationResult = {
    comments: [mockComment],
    pagination: {
      page: 1,
      limit: 20,
      total: 1,
      pages: 1,
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('POST /comments', () => {
    it('should create a comment successfully', async () => {
      const mockInput = {
        content: 'Test comment',
        postId: 1,
      }

      ;(CommentsService.createComment as jest.Mock).mockResolvedValue(mockComment)

      const response = await agent.post('/comments').send(mockInput).expect(201)

      expect(response.body.message).toBe('Comment created successfully')
      expect(response.body.comment).toEqual(mockComment)
      expect(CommentsService.createComment).toHaveBeenCalledWith(1, mockInput)
    })

    it('should handle service errors', async () => {
      const mockInput = {
        content: 'Test comment',
        postId: 999,
      }

      ;(CommentsService.createComment as jest.Mock).mockRejectedValue(new Error('Post not found'))

      const response = await agent.post('/comments').send(mockInput).expect(500)

      expect(response.body.error).toBe('Post not found')
    })
  })

  describe('PUT /comments/:id', () => {
    it('should update a comment successfully', async () => {
      const mockInput = {
        content: 'Updated comment',
      }

      ;(CommentsService.updateComment as jest.Mock).mockResolvedValue(mockComment)

      const response = await agent.put('/comments/1').send(mockInput).expect(200)

      expect(response.body.message).toBe('Comment updated successfully')
      expect(response.body.comment).toEqual(mockComment)
      expect(CommentsService.updateComment).toHaveBeenCalledWith(1, 1, mockInput)
    })
  })

  describe('DELETE /comments/:id', () => {
    it('should delete a comment successfully', async () => {
      ;(CommentsService.deleteComment as jest.Mock).mockResolvedValue(undefined)

      const response = await agent.delete('/comments/1').expect(200)

      expect(response.body.message).toBe('Comment deleted successfully')
      expect(CommentsService.deleteComment).toHaveBeenCalledWith(1, 1)
    })
  })

  describe('GET /comments', () => {
    it('should get comments with pagination', async () => {
      ;(CommentsService.getComments as jest.Mock).mockResolvedValue(mockPaginationResult)

      const response = await agent.get('/comments?page=1&limit=20').expect(200)

      expect(response.body).toEqual(mockPaginationResult)
      expect(CommentsService.getComments).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
      })
    })

    it('should filter comments by postId', async () => {
      ;(CommentsService.getComments as jest.Mock).mockResolvedValue(mockPaginationResult)

      const response = await agent.get('/comments?postId=1').expect(200)

      expect(CommentsService.getComments).toHaveBeenCalledWith({
        postId: 1,
        page: 1,
        limit: 20,
      })
    })

    it('should filter comments by authorId', async () => {
      ;(CommentsService.getComments as jest.Mock).mockResolvedValue(mockPaginationResult)

      const response = await agent.get('/comments?authorId=1').expect(200)

      expect(CommentsService.getComments).toHaveBeenCalledWith({
        authorId: 1,
        page: 1,
        limit: 20,
      })
    })
  })

  describe('GET /comments/:id', () => {
    it('should get a comment by ID', async () => {
      ;(CommentsService.getCommentById as jest.Mock).mockResolvedValue(mockComment)

      const response = await agent.get('/comments/1').expect(200)

      expect(response.body.comment).toEqual(mockComment)
      expect(CommentsService.getCommentById).toHaveBeenCalledWith(1)
    })
  })

  describe('GET /posts/:postId/comments', () => {
    it('should get comments by post', async () => {
      const mockPostComments = {
        post: { id: 1, title: 'Test Post' },
        comments: [mockComment],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          pages: 1,
        },
      }

      ;(CommentsService.getCommentsByPost as jest.Mock).mockResolvedValue(mockPostComments)

      const response = await agent.get('/posts/1/comments?page=1&limit=20').expect(200)

      expect(response.body).toEqual(mockPostComments)
      expect(CommentsService.getCommentsByPost).toHaveBeenCalledWith(1, 1, 20)
    })
  })

  describe('GET /users/:userId/comments', () => {
    it('should get comments by user', async () => {
      const mockUserComments = {
        user: { id: 1, username: 'testuser' },
        comments: [mockComment],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          pages: 1,
        },
      }

      ;(CommentsService.getCommentsByUser as jest.Mock).mockResolvedValue(mockUserComments)

      const response = await agent.get('/users/1/comments?page=1&limit=20').expect(200)

      expect(response.body).toEqual(mockUserComments)
      expect(CommentsService.getCommentsByUser).toHaveBeenCalledWith(1, 1, 20)
    })
  })

  describe('GET /comments/stats', () => {
    it('should get comment statistics', async () => {
      const mockStats = {
        totalComments: 10,
        topLevelComments: 8,
        repliesCount: 2,
        mostLikedComment: null,
      }

      ;(CommentsService.getCommentStats as jest.Mock).mockResolvedValue(mockStats)

      const response = await agent.get('/comments/stats').expect(200)

      expect(response.body.stats).toEqual(mockStats)
      expect(CommentsService.getCommentStats).toHaveBeenCalledWith(undefined, undefined)
    })

    it('should filter stats by postId', async () => {
      const mockStats = {
        totalComments: 5,
        topLevelComments: 4,
        repliesCount: 1,
        mostLikedComment: null,
      }

      ;(CommentsService.getCommentStats as jest.Mock).mockResolvedValue(mockStats)

      const response = await agent.get('/comments/stats?postId=1').expect(200)

      expect(CommentsService.getCommentStats).toHaveBeenCalledWith(1, undefined)
    })

    it('should filter stats by authorId', async () => {
      const mockStats = {
        totalComments: 3,
        topLevelComments: 3,
        repliesCount: 0,
        mostLikedComment: null,
      }

      ;(CommentsService.getCommentStats as jest.Mock).mockResolvedValue(mockStats)

      const response = await agent.get('/comments/stats?authorId=1').expect(200)

      expect(CommentsService.getCommentStats).toHaveBeenCalledWith(undefined, 1)
    })
  })
})
