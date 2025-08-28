import { PrismaClient } from '../generated/prisma/client/index.js'
import bcrypt from 'bcrypt'

// Create a test Prisma client
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'test' ? ['error'] : undefined,
})

// Test data factories
export class TestDataFactory {
  static async createTestUser(overrides: Partial<any> = {}) {
    const defaultUser = {
      email: `test${Date.now()}@example.com`,
      username: `testuser${Date.now()}`,
      password: await bcrypt.hash('password123', 10),
      roles: 'USER',
      isEmailVerified: true,
      profilePicture: null,
      bio: 'Test user bio',
    }

    const userData = { ...defaultUser, ...overrides }

    return await prisma.users.create({
      data: userData,
      select: {
        id: true,
        email: true,
        username: true,
        roles: true,
        isEmailVerified: true,
        profilePicture: true,
        bio: true,
        created_at: true,
      },
    })
  }

  static async createTestPost(authorId: number, overrides: Partial<any> = {}) {
    const defaultPost = {
      title: 'Test Post Title',
      content: 'This is a test post content for testing purposes.',
      status: 'PUBLISHED',
      authorId,
      categoryId: null,
      imageUrl: 'https://example.com/test-image.jpg',
    }

    const postData = { ...defaultPost, ...overrides }

    return await prisma.posts.create({
      data: postData,
      include: {
        author: {
          select: { id: true, username: true },
        },
        category: true,
      },
    })
  }

  static async createTestComment(postId: number, authorId: number, overrides: Partial<any> = {}) {
    const defaultComment = {
      content: 'This is a test comment for testing purposes.',
      postId,
      authorId,
      parentId: null,
      imageUrl: null,
    }

    const commentData = { ...defaultComment, ...overrides }

    return await prisma.comments.create({
      data: commentData,
      include: {
        author: {
          select: { id: true, username: true },
        },
        post: {
          select: { id: true, title: true },
        },
      },
    })
  }

  static async createTestCategory(overrides: Partial<any> = {}) {
    const defaultCategory = {
      name: `Test Category ${Date.now()}`,
      description: 'Test category description',
    }

    const categoryData = { ...defaultCategory, ...overrides }

    return await prisma.categories.create({
      data: categoryData,
    })
  }

  static async createTestContent(creatorId: number, overrides: Partial<any> = {}) {
    const defaultContent = {
      title: 'Test Movie Title',
      description: 'This is a test movie description for testing purposes.',
      type: 'MOVIE',
      genre: 'Action',
      status: 'ACTIVE',
      createdBy: creatorId,
      updatedBy: creatorId,
      rating: 8.5,
      releaseDate: new Date('2023-01-01'),
      duration: 120,
      language: 'English',
      country: 'USA',
      isFeatured: false,
      isTrending: false,
      isPopular: false,
    }

    const contentData = { ...defaultContent, ...overrides }

    return await prisma.content.create({
      data: contentData,
      include: {
        creator: {
          select: { id: true, username: true },
        },
      },
    })
  }

  static async createTestLike(
    userId: number,
    postId?: number,
    commentId?: number,
    overrides: Partial<any> = {},
  ) {
    const defaultLike = {
      userId,
      postId,
      commentId,
    }

    const likeData = { ...defaultLike, ...overrides }

    return await prisma.likes.create({
      data: likeData,
      include: {
        user: {
          select: { id: true, username: true },
        },
        post: postId
          ? {
              select: { id: true, title: true },
            }
          : false,
        comment: commentId
          ? {
              select: { id: true, content: true },
            }
          : false,
      },
    })
  }
}

// Database management utilities
export class DatabaseUtils {
  static async cleanDatabase() {
    // Clean in order to respect foreign key constraints
    await prisma.likes.deleteMany()
    await prisma.comments.deleteMany()
    await prisma.contentLikes.deleteMany()
    await prisma.contentComments.deleteMany()
    await prisma.contentShares.deleteMany()
    await prisma.contentReports.deleteMany()
    await prisma.posts.deleteMany()
    await prisma.content.deleteMany()
    await prisma.categories.deleteMany()
    await prisma.tags.deleteMany()
    await prisma.auth.deleteMany()
    await prisma.users.deleteMany()
  }

  static async seedDatabase() {
    // Create test users
    const user1 = await TestDataFactory.createTestUser({
      username: 'testuser1',
      email: 'testuser1@example.com',
    })

    const user2 = await TestDataFactory.createTestUser({
      username: 'testuser2',
      email: 'testuser2@example.com',
    })

    const admin = await TestDataFactory.createTestUser({
      username: 'admin',
      email: 'admin@example.com',
      roles: 'ADMIN',
    })

    // Create test category
    const category = await TestDataFactory.createTestCategory({
      name: 'Technology',
    })

    // Create test posts
    const post1 = await TestDataFactory.createTestPost(user1.id, {
      title: 'First Test Post',
      categoryId: category.id,
    })

    const post2 = await TestDataFactory.createTestPost(user2.id, {
      title: 'Second Test Post',
      categoryId: category.id,
    })

    // Create test content
    const content1 = await TestDataFactory.createTestContent(user1.id, {
      title: 'Inception',
      genre: 'Sci-Fi',
      type: 'MOVIE',
    })

    const content2 = await TestDataFactory.createTestContent(user2.id, {
      title: 'Breaking Bad',
      genre: 'Drama',
      type: 'SERIES',
      seasons: 5,
      episodes: 62,
    })

    // Create test comments
    const comment1 = await TestDataFactory.createTestComment(post1.id, user2.id, {
      content: 'Great post! Very informative.',
    })

    const comment2 = await TestDataFactory.createTestComment(post1.id, user1.id, {
      content: 'Thanks for sharing!',
      parentId: comment1.id,
    })

    // Create test likes
    await TestDataFactory.createTestLike(user1.id, post2.id)
    await TestDataFactory.createTestLike(user2.id, post1.id)
    await TestDataFactory.createTestLike(user1.id, undefined, comment1.id)

    return {
      users: { user1, user2, admin },
      posts: { post1, post2 },
      content: { content1, content2 },
      comments: { comment1, comment2 },
      category,
    }
  }

  static async disconnect() {
    await prisma.$disconnect()
  }
}

// Test helpers
export class TestHelpers {
  static generateMockRequest(overrides: Partial<any> = {}) {
    return {
      user: { id: 1, username: 'testuser' },
      body: {},
      query: {},
      params: {},
      headers: {},
      ...overrides,
    }
  }

  static generateMockResponse() {
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    }
    return res
  }

  static generateMockNext() {
    return jest.fn()
  }

  static async authenticateUser(userId: number) {
    // Create or update auth record for test user
    const authData = {
      userId,
      accessToken: `test-access-token-${userId}`,
      refreshToken: `test-refresh-token-${userId}`,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      refreshExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      isOnline: true,
      lastSeen: new Date(),
    }

    return await prisma.auth.upsert({
      where: { userId },
      update: authData,
      create: authData,
    })
  }

  static generateJWT(payload: any) {
    // Simple JWT-like token for testing
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64')
    const body = Buffer.from(JSON.stringify(payload)).toString('base64')
    return `${header}.${body}.signature`
  }

  static async waitForDatabase() {
    let retries = 5
    while (retries > 0) {
      try {
        await prisma.$queryRaw`SELECT 1`
        return
      } catch (error) {
        retries--
        if (retries === 0) throw error
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
  }
}

// Global test setup
export const setupTestEnvironment = () => {
  beforeAll(async () => {
    await TestHelpers.waitForDatabase()
  })

  afterEach(async () => {
    await DatabaseUtils.cleanDatabase()
  })

  afterAll(async () => {
    await DatabaseUtils.disconnect()
  })
}

// Export everything
export default {
  prisma,
  TestDataFactory,
  DatabaseUtils,
  TestHelpers,
  setupTestEnvironment,
}
