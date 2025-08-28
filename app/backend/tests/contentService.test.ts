import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { ContentService } from '../src/services/contentService.js'
import prisma from '../src/config/prisma.js'

// Mock prisma
jest.mock('../src/config/prisma.js', () => ({
  __esModule: true,
  default: {
    content: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    users: {
      findUnique: jest.fn(),
    },
  },
}))

describe('ContentService', () => {
  const mockPrisma = prisma as jest.Mocked<typeof prisma>

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('createContent', () => {
    it('should create content successfully', async () => {
      const userId = 1
      const input = {
        title: 'Test Movie',
        description: 'A test movie',
        genre: 'Action',
        type: 'MOVIE' as const,
        language: 'English',
        country: 'USA',
        duration: 120,
        isFeatured: false,
        streamingPlatforms: ['NETFLIX', 'HULU'],
      }

      const expectedContent = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        ...input,
        createdBy: userId,
        updatedBy: userId,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
        creator: { id: userId, username: 'testuser' },
        _count: {
          likes: 0,
          comments: 0,
          shares: 0,
        },
      }

      mockPrisma.users.findUnique.mockResolvedValue({
        id: userId,
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashedpassword',
        roles: 'USER' as const,
        isEmailVerified: true,
        created_at: new Date(),
        updated_at: new Date(),
      })

      mockPrisma.content.create.mockResolvedValue(expectedContent as any)

      const result = await ContentService.createContent(userId, input)

      expect(mockPrisma.users.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
      })

      expect(mockPrisma.content.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: input.title,
          description: input.description,
          genre: input.genre,
          type: input.type,
          language: input.language,
          country: input.country,
          duration: input.duration,
          streamingPlatforms: input.streamingPlatforms,
          createdBy: userId,
          updatedBy: userId,
        }),
        include: expect.any(Object),
      })

      expect(result).toEqual(expectedContent)
    })

    it('should throw error for invalid user', async () => {
      const userId = 999
      const input = {
        title: 'Test Movie',
        description: 'A test movie',
        genre: 'Action',
        type: 'MOVIE' as const,
        language: 'English',
        country: 'USA',
      }

      mockPrisma.users.findUnique.mockResolvedValue(null)

      await expect(ContentService.createContent(userId, input)).rejects.toThrow('User not found')
    })

    it('should throw error for series without seasons/episodes', async () => {
      const userId = 1
      const input = {
        title: 'Test Series',
        description: 'A test series',
        genre: 'Drama',
        type: 'SERIES' as const,
        language: 'English',
        country: 'USA',
        // Missing seasons and episodes
      }

      mockPrisma.users.findUnique.mockResolvedValue({
        id: userId,
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashedpassword',
        roles: 'USER' as const,
        isEmailVerified: true,
        created_at: new Date(),
        updated_at: new Date(),
      })

      await expect(ContentService.createContent(userId, input)).rejects.toThrow(
        'Series must have seasons and episodes specified',
      )
    })
  })

  describe('updateContent', () => {
    it('should update content successfully', async () => {
      const userId = 1
      const contentId = '123e4567-e89b-12d3-a456-426614174000'
      const input = {
        title: 'Updated Title',
        isFeatured: true,
      }

      const existingContent = {
        id: contentId,
        title: 'Original Title',
        description: 'Original description',
        genre: 'Action',
        type: 'MOVIE' as const,
        language: 'English',
        country: 'USA',
        createdBy: userId,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const updatedContent = {
        ...existingContent,
        title: 'Updated Title',
        isFeatured: true,
        updatedBy: userId,
        creator: { id: userId, username: 'testuser' },
        updater: { id: userId, username: 'testuser' },
        _count: {
          likes: 0,
          comments: 0,
          shares: 0,
        },
      }

      mockPrisma.content.findUnique.mockResolvedValue(existingContent as any)
      mockPrisma.content.update.mockResolvedValue(updatedContent as any)

      const result = await ContentService.updateContent(userId, contentId, input)

      expect(mockPrisma.content.findUnique).toHaveBeenCalledWith({
        where: { id: contentId },
      })

      expect(mockPrisma.content.update).toHaveBeenCalledWith({
        where: { id: contentId },
        data: expect.objectContaining({
          title: 'Updated Title',
          isFeatured: true,
          updatedBy: userId,
        }),
        include: expect.any(Object),
      })

      expect(result).toEqual(updatedContent)
    })

    it('should throw error for non-existent content', async () => {
      const userId = 1
      const contentId = 'non-existent-id'
      const input = { title: 'Updated Title' }

      mockPrisma.content.findUnique.mockResolvedValue(null)

      await expect(ContentService.updateContent(userId, contentId, input)).rejects.toThrow(
        'Content not found',
      )
    })

    it('should throw error for insufficient privileges', async () => {
      const userId = 1
      const contentId = '123e4567-e89b-12d3-a456-426614174000'
      const input = { title: 'Updated Title' }

      const existingContent = {
        id: contentId,
        title: 'Original Title',
        description: 'Original description',
        genre: 'Action',
        type: 'MOVIE' as const,
        language: 'English',
        country: 'USA',
        createdBy: 2, // Different user
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPrisma.content.findUnique.mockResolvedValue(existingContent as any)
      mockPrisma.users.findUnique.mockResolvedValue({
        id: userId,
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashedpassword',
        roles: 'USER' as const,
        isEmailVerified: true,
        created_at: new Date(),
        updated_at: new Date(),
      })

      await expect(ContentService.updateContent(userId, contentId, input)).rejects.toThrow(
        'Insufficient privileges to update this content',
      )
    })
  })

  describe('getContent', () => {
    it('should get content with filters', async () => {
      const filters = {
        page: 1,
        limit: 10,
        type: 'MOVIE' as const,
        genre: 'Action',
        search: 'test',
      }

      const mockContent = [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          title: 'Test Movie',
          description: 'A test movie',
          genre: 'Action',
          type: 'MOVIE',
          language: 'English',
          country: 'USA',
          status: 'ACTIVE',
          createdBy: 1,
          creator: { id: 1, username: 'testuser' },
          _count: {
            likes: 5,
            comments: 3,
            shares: 2,
          },
        },
      ]

      mockPrisma.content.findMany.mockResolvedValue(mockContent as any)
      mockPrisma.content.count.mockResolvedValue(1)

      const result = await ContentService.getContent(filters)

      expect(mockPrisma.content.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          status: 'ACTIVE',
          type: 'MOVIE',
          genre: { contains: 'Action', mode: 'insensitive' },
          OR: [
            { title: { contains: 'test', mode: 'insensitive' } },
            { description: { contains: 'test', mode: 'insensitive' } },
            { genre: { contains: 'test', mode: 'insensitive' } },
          ],
        }),
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      })

      expect(result.content).toEqual(mockContent)
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        pages: 1,
      })
    })
  })

  describe('getContentById', () => {
    it('should get content by ID', async () => {
      const contentId = '123e4567-e89b-12d3-a456-426614174000'
      const mockContent = {
        id: contentId,
        title: 'Test Movie',
        description: 'A test movie',
        genre: 'Action',
        type: 'MOVIE',
        language: 'English',
        country: 'USA',
        status: 'ACTIVE',
        createdBy: 1,
        creator: { id: 1, username: 'testuser' },
        updater: { id: 1, username: 'testuser' },
        _count: {
          likes: 5,
          comments: 3,
          shares: 2,
          reports: 1,
        },
      }

      mockPrisma.content.findUnique.mockResolvedValue(mockContent as any)

      const result = await ContentService.getContentById(contentId)

      expect(mockPrisma.content.findUnique).toHaveBeenCalledWith({
        where: { id: contentId, status: 'ACTIVE' },
        include: expect.any(Object),
      })

      expect(result).toEqual(mockContent)
    })

    it('should throw error for non-existent content', async () => {
      const contentId = 'non-existent-id'

      mockPrisma.content.findUnique.mockResolvedValue(null)

      await expect(ContentService.getContentById(contentId)).rejects.toThrow('Content not found')
    })
  })

  describe('deleteContent', () => {
    it('should soft delete content successfully', async () => {
      const userId = 1
      const contentId = '123e4567-e89b-12d3-a456-426614174000'

      const existingContent = {
        id: contentId,
        title: 'Test Movie',
        description: 'A test movie',
        genre: 'Action',
        type: 'MOVIE',
        language: 'English',
        country: 'USA',
        createdBy: userId,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const deletedContent = {
        ...existingContent,
        status: 'DELETED',
        deletedAt: new Date(),
        deletedBy: userId,
      }

      mockPrisma.content.findUnique.mockResolvedValue(existingContent as any)
      mockPrisma.content.update.mockResolvedValue(deletedContent as any)

      const result = await ContentService.deleteContent(userId, contentId)

      expect(mockPrisma.content.update).toHaveBeenCalledWith({
        where: { id: contentId },
        data: {
          status: 'DELETED',
          deletedAt: expect.any(Date),
          deletedBy: userId,
        },
      })

      expect(result).toEqual(deletedContent)
    })
  })

  describe('getTrendingContent', () => {
    it('should get trending content', async () => {
      const limit = 5
      const mockContent = [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          title: 'Trending Movie',
          genre: 'Action',
          type: 'MOVIE',
          isTrending: true,
          creator: { id: 1, username: 'testuser' },
          _count: {
            likes: 10,
            comments: 5,
            shares: 3,
          },
        },
      ]

      mockPrisma.content.findMany.mockResolvedValue(mockContent as any)

      const result = await ContentService.getTrendingContent(limit)

      expect(mockPrisma.content.findMany).toHaveBeenCalledWith({
        where: {
          status: 'ACTIVE',
          OR: [{ isTrending: true }, { isPopular: true }, { isTopRated: true }],
        },
        take: limit,
        orderBy: [
          { isTrending: 'desc' },
          { isPopular: 'desc' },
          { isTopRated: 'desc' },
          { createdAt: 'desc' },
        ],
        include: expect.any(Object),
      })

      expect(result).toEqual(mockContent)
    })
  })

  describe('getFeaturedContent', () => {
    it('should get featured content', async () => {
      const limit = 10
      const mockContent = [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          title: 'Featured Movie',
          genre: 'Drama',
          type: 'MOVIE',
          isFeatured: true,
          creator: { id: 1, username: 'testuser' },
          _count: {
            likes: 15,
            comments: 8,
            shares: 5,
          },
        },
      ]

      mockPrisma.content.findMany.mockResolvedValue(mockContent as any)

      const result = await ContentService.getFeaturedContent(limit)

      expect(mockPrisma.content.findMany).toHaveBeenCalledWith({
        where: {
          status: 'ACTIVE',
          isFeatured: true,
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      })

      expect(result).toEqual(mockContent)
    })
  })

  describe('searchContent', () => {
    it('should search content', async () => {
      const query = 'test movie'
      const filters = { type: 'MOVIE' as const }

      const mockSearchResult = {
        content: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            title: 'Test Movie',
            genre: 'Action',
            type: 'MOVIE',
            creator: { id: 1, username: 'testuser' },
            _count: {
              likes: 5,
              comments: 3,
              shares: 2,
            },
          },
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          pages: 1,
        },
      }

      // Mock the getContent method
      const getContentSpy = jest.spyOn(ContentService, 'getContent')
      getContentSpy.mockResolvedValue(mockSearchResult)

      const result = await ContentService.searchContent(query, filters)

      expect(getContentSpy).toHaveBeenCalledWith({
        ...filters,
        search: query,
      })

      expect(result).toEqual(mockSearchResult)

      getContentSpy.mockRestore()
    })
  })

  describe('getContentStats', () => {
    it('should get content statistics', async () => {
      const mockStats = {
        total: 100,
        movies: 60,
        series: 40,
        featured: 10,
        trending: 15,
        popular: 20,
      }

      mockPrisma.content.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(60) // movies
        .mockResolvedValueOnce(40) // series
        .mockResolvedValueOnce(10) // featured
        .mockResolvedValueOnce(15) // trending
        .mockResolvedValueOnce(20) // popular

      const result = await ContentService.getContentStats()

      expect(mockPrisma.content.count).toHaveBeenCalledTimes(6)
      expect(result).toEqual(mockStats)
    })
  })
})
