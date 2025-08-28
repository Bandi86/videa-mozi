import request from 'supertest'
import express from 'express'
import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'

// Import your app setup
import app from '../src/index'
import prisma from '../src/config/prisma'

describe('Social Features API', () => {
  let authToken: string
  let userId: number
  let postId: number

  beforeAll(async () => {
    // Ensure database is clean for tests
    await prisma.reports.deleteMany()
    await prisma.shares.deleteMany()
    await prisma.likes.deleteMany()
    await prisma.comments.deleteMany()
    await prisma.posts.deleteMany()
    await prisma.followers.deleteMany()
    await prisma.users.deleteMany()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  describe('Authentication', () => {
    it('should register a new user', async () => {
      const response = await request(app).post('/api/v1/auth/register').send({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        confirmPassword: 'password123',
      })

      expect(response.status).toBe(201)
      expect(response.body).toHaveProperty('message')
      expect(response.body).toHaveProperty('user')
      userId = response.body.user.id
    })

    it('should login user', async () => {
      const response = await request(app).post('/api/v1/auth/login').send({
        email: 'test@example.com',
        password: 'password123',
      })

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('accessToken')
      authToken = response.body.accessToken
    })
  })

  describe('Posts', () => {
    it('should create a new post', async () => {
      const response = await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Post',
          content: 'This is a test post content',
          status: 'PUBLISHED',
        })

      expect(response.status).toBe(201)
      expect(response.body).toHaveProperty('post')
      expect(response.body.post.title).toBe('Test Post')
      postId = response.body.post.id
    })

    it('should get all posts', async () => {
      const response = await request(app)
        .get('/api/v1/posts')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('posts')
      expect(Array.isArray(response.body.posts)).toBe(true)
    })

    it('should get single post by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/posts/${postId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('post')
      expect(response.body.post.id).toBe(postId)
    })

    it('should update post', async () => {
      const response = await request(app)
        .put(`/api/v1/posts/${postId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Updated Test Post',
          content: 'This is updated test post content',
        })

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('post')
      expect(response.body.post.title).toBe('Updated Test Post')
    })
  })

  describe('Comments', () => {
    let commentId: number

    it('should create a comment on post', async () => {
      const response = await request(app)
        .post('/api/v1/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'This is a test comment',
          postId: postId,
        })

      expect(response.status).toBe(201)
      expect(response.body).toHaveProperty('comment')
      expect(response.body.comment.content).toBe('This is a test comment')
      commentId = response.body.comment.id
    })

    it('should get comments for post', async () => {
      const response = await request(app)
        .get(`/api/v1/comments/post/${postId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('comments')
      expect(Array.isArray(response.body.comments)).toBe(true)
    })

    it('should update comment', async () => {
      const response = await request(app)
        .put(`/api/v1/comments/${commentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'This is an updated test comment',
        })

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('comment')
      expect(response.body.comment.content).toBe('This is an updated test comment')
    })
  })

  describe('Likes', () => {
    it('should like a post', async () => {
      const response = await request(app)
        .post('/api/v1/likes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          postId: postId,
        })

      expect(response.status).toBe(201)
      expect(response.body).toHaveProperty('message')
      expect(response.body).toHaveProperty('like')
    })

    it('should get likes for post', async () => {
      const response = await request(app)
        .get(`/api/v1/likes/post/${postId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('likes')
      expect(Array.isArray(response.body.likes)).toBe(true)
    })
  })

  describe('Followers', () => {
    let secondUserId: number
    let secondUserToken: string

    beforeAll(async () => {
      // Create second user for following tests
      const registerResponse = await request(app).post('/api/v1/auth/register').send({
        username: 'seconduser',
        email: 'second@example.com',
        password: 'password123',
        confirmPassword: 'password123',
      })

      secondUserId = registerResponse.body.user.id

      const loginResponse = await request(app).post('/api/v1/auth/login').send({
        email: 'second@example.com',
        password: 'password123',
      })

      secondUserToken = loginResponse.body.accessToken
    })

    it('should follow a user', async () => {
      const response = await request(app)
        .post('/api/v1/followers/follow')
        .set('Authorization', `Bearer ${secondUserToken}`)
        .send({
          followingId: userId,
        })

      expect(response.status).toBe(201)
      expect(response.body).toHaveProperty('message')
      expect(response.body.message).toContain('followed successfully')
    })

    it('should get followers', async () => {
      const response = await request(app)
        .get(`/api/v1/followers/user/${userId}/followers`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('followers')
      expect(Array.isArray(response.body.followers)).toBe(true)
    })

    it('should get following', async () => {
      const response = await request(app)
        .get(`/api/v1/followers/user/${secondUserId}/following`)
        .set('Authorization', `Bearer ${secondUserToken}`)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('following')
      expect(Array.isArray(response.body.following)).toBe(true)
    })
  })

  describe('Shares', () => {
    it('should share a post', async () => {
      const response = await request(app)
        .post('/api/v1/shares')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          postId: postId,
        })

      expect(response.status).toBe(201)
      expect(response.body).toHaveProperty('message')
      expect(response.body.message).toContain('shared successfully')
    })

    it('should get shares for post', async () => {
      const response = await request(app)
        .get(`/api/v1/shares/post/${postId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('shares')
      expect(Array.isArray(response.body.shares)).toBe(true)
    })
  })

  describe('Categories and Tags', () => {
    it('should get all categories', async () => {
      const response = await request(app)
        .get('/api/v1/categories')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('categories')
      expect(Array.isArray(response.body.categories)).toBe(true)
    })

    it('should get all tags', async () => {
      const response = await request(app)
        .get('/api/v1/tags')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('tags')
      expect(Array.isArray(response.body.tags)).toBe(true)
    })
  })

  describe('Reports', () => {
    it('should create a report', async () => {
      const response = await request(app)
        .post('/api/v1/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          postId: postId,
          type: 'SPAM',
          reason: 'Test report',
          description: 'This is a test report for automated testing',
        })

      expect(response.status).toBe(201)
      expect(response.body).toHaveProperty('report')
      expect(response.body.report.type).toBe('SPAM')
    })
  })

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health')

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('status')
    })
  })
})
