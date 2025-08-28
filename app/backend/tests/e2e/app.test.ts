import request from 'supertest'
import express from 'express'
import { prisma, TestDataFactory, DatabaseUtils } from '../testUtils.js'
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
import {
  createLike,
  deleteLike,
  toggleLike,
  getLikes,
  getLikeById,
  getLikesByPost,
  getLikesByUser,
  getLikeStats,
} from '../../src/controllers/likesController.js'
import { ContentService } from '../../src/services/contentService.js'

// Create test app
const app = express()
app.use(express.json())

// Mock authentication middleware
const mockAuth = (req: any, res: any, next: any) => {
  req.user = { id: 1, username: 'testuser' }
  next()
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() })
})

// Comments routes
app.post('/comments', mockAuth, createComment)
app.put('/comments/:id', mockAuth, updateComment)
app.delete('/comments/:id', mockAuth, deleteComment)
app.get('/comments', getComments)
app.get('/comments/:id', getCommentById)
app.get('/comments/stats', getCommentStats)

// Likes routes
app.post('/likes', mockAuth, createLike)
app.delete('/likes/:id', mockAuth, deleteLike)
app.post('/likes/toggle', mockAuth, toggleLike)
app.get('/likes', getLikes)
app.get('/likes/:id', getLikeById)
app.get('/likes/stats', getLikeStats)

const agent = request(app)

describe('End-to-End API Tests', () => {
  let testData: any

  beforeAll(async () => {
    // Seed the database with test data
    testData = await DatabaseUtils.seedDatabase()
  })

  afterAll(async () => {
    await DatabaseUtils.cleanDatabase()
    await DatabaseUtils.disconnect()
  })

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await agent.get('/health').expect(200)

      expect(response.body.status).toBe('healthy')
      expect(response.body.timestamp).toBeDefined()
    })
  })

  describe('Comments API', () => {
    let createdComment: any

    it('should create a comment', async () => {
      const commentData = {
        content: 'This is an end-to-end test comment',
        postId: testData.posts.post1.id,
      }

      const response = await agent.post('/comments').send(commentData).expect(201)

      expect(response.body.message).toBe('Comment created successfully')
      expect(response.body.comment).toBeDefined()
      expect(response.body.comment.content).toBe(commentData.content)
      expect(response.body.comment.postId).toBe(commentData.postId)

      createdComment = response.body.comment
    })

    it('should get comment by ID', async () => {
      const response = await agent.get(`/comments/${createdComment.id}`).expect(200)

      expect(response.body.comment.id).toBe(createdComment.id)
      expect(response.body.comment.content).toBe(createdComment.content)
    })

    it('should update the comment', async () => {
      const updateData = {
        content: 'Updated end-to-end test comment',
      }

      const response = await agent
        .put(`/comments/${createdComment.id}`)
        .send(updateData)
        .expect(200)

      expect(response.body.message).toBe('Comment updated successfully')
      expect(response.body.comment.content).toBe(updateData.content)
    })

    it('should get comments by post', async () => {
      const response = await agent.get(`/posts/${testData.posts.post1.id}/comments`).expect(200)

      expect(response.body.post.id).toBe(testData.posts.post1.id)
      expect(Array.isArray(response.body.comments)).toBe(true)
      expect(response.body.pagination).toBeDefined()
    })

    it('should get comments by user', async () => {
      const response = await agent.get(`/users/${testData.users.user1.id}/comments`).expect(200)

      expect(response.body.user.id).toBe(testData.users.user1.id)
      expect(Array.isArray(response.body.comments)).toBe(true)
      expect(response.body.pagination).toBeDefined()
    })

    it('should get comment statistics', async () => {
      const response = await agent.get('/comments/stats').expect(200)

      expect(response.body.stats).toBeDefined()
      expect(typeof response.body.stats.totalComments).toBe('number')
    })

    it('should delete the comment', async () => {
      const response = await agent.delete(`/comments/${createdComment.id}`).expect(200)

      expect(response.body.message).toBe('Comment deleted successfully')
    })
  })

  describe('Likes API', () => {
    let createdLike: any

    it('should create a like', async () => {
      const likeData = {
        postId: testData.posts.post2.id,
      }

      const response = await agent.post('/likes').send(likeData).expect(201)

      expect(response.body.message).toBe('Like created successfully')
      expect(response.body.like).toBeDefined()
      expect(response.body.like.postId).toBe(likeData.postId)

      createdLike = response.body.like
    })

    it('should get like by ID', async () => {
      const response = await agent.get(`/likes/${createdLike.id}`).expect(200)

      expect(response.body.like.id).toBe(createdLike.id)
      expect(response.body.like.postId).toBe(createdLike.postId)
    })

    it('should toggle like (delete existing)', async () => {
      const toggleData = {
        postId: testData.posts.post2.id,
      }

      const response = await agent.post('/likes/toggle').send(toggleData).expect(200)

      expect(response.body.action).toBe('deleted')
      expect(response.body.like.id).toBe(createdLike.id)
    })

    it('should create like again with toggle', async () => {
      const toggleData = {
        postId: testData.posts.post2.id,
      }

      const response = await agent.post('/likes/toggle').send(toggleData).expect(200)

      expect(response.body.action).toBe('created')
      expect(response.body.like).toBeDefined()
      expect(response.body.like.postId).toBe(toggleData.postId)

      createdLike = response.body.like
    })

    it('should get likes by post', async () => {
      const response = await agent.get(`/posts/${testData.posts.post2.id}/likes`).expect(200)

      expect(response.body.post.id).toBe(testData.posts.post2.id)
      expect(Array.isArray(response.body.likes)).toBe(true)
      expect(response.body.pagination).toBeDefined()
    })

    it('should get likes by user', async () => {
      const response = await agent.get(`/users/${testData.users.user1.id}/likes`).expect(200)

      expect(response.body.user.id).toBe(testData.users.user1.id)
      expect(Array.isArray(response.body.likes)).toBe(true)
      expect(response.body.pagination).toBeDefined()
    })

    it('should get like statistics', async () => {
      const response = await agent.get('/likes/stats').expect(200)

      expect(response.body.stats).toBeDefined()
      expect(typeof response.body.stats.totalLikes).toBe('number')
    })

    it('should delete the like', async () => {
      const response = await agent.delete(`/likes/${createdLike.id}`).expect(200)

      expect(response.body.message).toBe('Like deleted successfully')
    })
  })

  describe('Content Service Integration', () => {
    it('should get trending content', async () => {
      const trendingContent = await ContentService.getTrendingContent(5)

      expect(Array.isArray(trendingContent)).toBe(true)
      expect(trendingContent.length).toBeLessThanOrEqual(5)
    })

    it('should get featured content', async () => {
      const featuredContent = await ContentService.getFeaturedContent(5)

      expect(Array.isArray(featuredContent)).toBe(true)
      expect(featuredContent.length).toBeLessThanOrEqual(5)
    })
  })

  describe('Database Constraints', () => {
    it('should enforce foreign key constraints', async () => {
      // Try to create a comment with non-existent post ID
      const invalidCommentData = {
        content: 'Invalid comment',
        postId: 99999, // Non-existent post ID
      }

      const response = await agent.post('/comments').send(invalidCommentData).expect(500)

      expect(response.body.error).toBe('Post not found')
    })

    it('should validate required fields', async () => {
      const invalidCommentData = {
        // Missing content
        postId: testData.posts.post1.id,
      }

      const response = await agent.post('/comments').send(invalidCommentData).expect(400)

      expect(response.body.error).toBeDefined()
    })
  })

  describe('Performance Tests', () => {
    it('should handle multiple concurrent requests', async () => {
      const promises = []

      // Create 5 concurrent comments
      for (let i = 0; i < 5; i++) {
        const commentData = {
          content: `Concurrent comment ${i}`,
          postId: testData.posts.post1.id,
        }

        promises.push(agent.post('/comments').send(commentData))
      }

      const responses = await Promise.all(promises)

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201)
        expect(response.body.message).toBe('Comment created successfully')
      })
    })

    it('should handle pagination correctly', async () => {
      // Create multiple comments
      for (let i = 0; i < 5; i++) {
        await TestDataFactory.createTestComment(testData.posts.post1.id, testData.users.user1.id, {
          content: `Pagination test comment ${i}`,
        })
      }

      // Test pagination with limit 2
      const response = await agent
        .get(`/posts/${testData.posts.post1.id}/comments?page=1&limit=2`)
        .expect(200)

      expect(response.body.comments).toHaveLength(2)
      expect(response.body.pagination.page).toBe(1)
      expect(response.body.pagination.limit).toBe(2)
      expect(response.body.pagination.total).toBeGreaterThanOrEqual(5)
      expect(response.body.pagination.pages).toBeGreaterThanOrEqual(3)
    })
  })
})
