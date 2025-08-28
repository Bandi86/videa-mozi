import { describe, it, expect } from '@jest/globals'
import {
  createContentSchema,
  updateContentSchema,
  getContentSchema,
  createContentCommentSchema,
  createContentLikeSchema,
  createContentShareSchema,
  createContentReportSchema,
  contentIdParamSchema,
} from '../src/validators/contentValidators.js'

describe('Content Validators', () => {
  describe('createContentSchema', () => {
    it('should validate valid movie data', () => {
      const validData = {
        title: 'Test Movie',
        description: 'A test movie description',
        genre: 'Action',
        type: 'MOVIE',
        language: 'English',
        country: 'USA',
        duration: 120,
        isFeatured: false,
        streamingPlatforms: ['NETFLIX', 'HULU'],
      }

      const result = createContentSchema.safeParse(validData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.title).toBe('Test Movie')
        expect(result.data.type).toBe('MOVIE')
      }
    })

    it('should validate valid series data', () => {
      const validData = {
        title: 'Test Series',
        description: 'A test series description',
        genre: 'Drama',
        type: 'SERIES',
        language: 'English',
        country: 'USA',
        seasons: 3,
        episodes: 30,
        episodeDuration: 45,
        isFeatured: true,
        streamingPlatforms: ['NETFLIX'],
      }

      const result = createContentSchema.safeParse(validData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.title).toBe('Test Series')
        expect(result.data.type).toBe('SERIES')
        expect(result.data.seasons).toBe(3)
        expect(result.data.episodes).toBe(30)
      }
    })

    it('should reject invalid title', () => {
      const invalidData = {
        title: '',
        description: 'A test description',
        genre: 'Action',
        type: 'MOVIE',
        language: 'English',
        country: 'USA',
      }

      const result = createContentSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].path).toContain('title')
      }
    })

    it('should reject invalid type', () => {
      const invalidData = {
        title: 'Test Movie',
        description: 'A test description',
        genre: 'Action',
        type: 'INVALID',
        language: 'English',
        country: 'USA',
      }

      const result = createContentSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].path).toContain('type')
      }
    })

    it('should reject series without seasons/episodes', () => {
      const invalidData = {
        title: 'Test Series',
        description: 'A test description',
        genre: 'Drama',
        type: 'SERIES',
        language: 'English',
        country: 'USA',
        // Missing seasons and episodes
      }

      const result = createContentSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })
  })

  describe('updateContentSchema', () => {
    it('should validate partial update data', () => {
      const updateData = {
        title: 'Updated Title',
        isFeatured: true,
      }

      const result = updateContentSchema.safeParse(updateData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.title).toBe('Updated Title')
        expect(result.data.isFeatured).toBe(true)
      }
    })

    it('should accept empty object', () => {
      const result = updateContentSchema.safeParse({})
      expect(result.success).toBe(true)
    })
  })

  describe('getContentSchema', () => {
    it('should validate search filters', () => {
      const filterData = {
        type: 'MOVIE',
        genre: 'Action',
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        search: 'test',
      }

      const result = getContentSchema.safeParse(filterData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.type).toBe('MOVIE')
        expect(result.data.search).toBe('test')
      }
    })

    it('should apply default values', () => {
      const result = getContentSchema.safeParse({})
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.page).toBe(1)
        expect(result.data.limit).toBe(10)
        expect(result.data.sortOrder).toBe('desc')
      }
    })

    it('should reject invalid page number', () => {
      const invalidData = {
        page: 0,
      }

      const result = getContentSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should reject invalid limit', () => {
      const invalidData = {
        limit: 200,
      }

      const result = getContentSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })
  })

  describe('createContentCommentSchema', () => {
    it('should validate valid comment data', () => {
      const commentData = {
        content: 'This is a great movie!',
        contentId: '123e4567-e89b-12d3-a456-426614174000',
      }

      const result = createContentCommentSchema.safeParse(commentData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.content).toBe('This is a great movie!')
        expect(result.data.contentId).toBe('123e4567-e89b-12d3-a456-426614174000')
      }
    })

    it('should reject empty content', () => {
      const invalidData = {
        content: '',
        contentId: '123e4567-e89b-12d3-a456-426614174000',
      }

      const result = createContentCommentSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should reject invalid UUID', () => {
      const invalidData = {
        content: 'This is a comment',
        contentId: 'invalid-uuid',
      }

      const result = createContentCommentSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })
  })

  describe('createContentLikeSchema', () => {
    it('should validate valid like data', () => {
      const likeData = {
        contentId: '123e4567-e89b-12d3-a456-426614174000',
      }

      const result = createContentLikeSchema.safeParse(likeData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.contentId).toBe('123e4567-e89b-12d3-a456-426614174000')
      }
    })
  })

  describe('createContentShareSchema', () => {
    it('should validate valid share data', () => {
      const shareData = {
        contentId: '123e4567-e89b-12d3-a456-426614174000',
      }

      const result = createContentShareSchema.safeParse(shareData)
      expect(result.success).toBe(true)
    })
  })

  describe('createContentReportSchema', () => {
    it('should validate valid report data', () => {
      const reportData = {
        contentId: '123e4567-e89b-12d3-a456-426614174000',
        type: 'SPAM',
        reason: 'This content is spam',
      }

      const result = createContentReportSchema.safeParse(reportData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.type).toBe('SPAM')
        expect(result.data.reason).toBe('This content is spam')
      }
    })

    it('should reject report without contentId or commentId', () => {
      const invalidData = {
        type: 'SPAM',
        reason: 'This content is spam',
        // Missing both contentId and commentId
      }

      const result = createContentReportSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should reject short reason', () => {
      const invalidData = {
        contentId: '123e4567-e89b-12d3-a456-426614174000',
        type: 'SPAM',
        reason: 'Hi', // Too short
      }

      const result = createContentReportSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })
  })

  describe('contentIdParamSchema', () => {
    it('should validate valid UUID parameter', () => {
      const paramData = {
        contentId: '123e4567-e89b-12d3-a456-426614174000',
      }

      const result = contentIdParamSchema.safeParse(paramData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.contentId).toBe('123e4567-e89b-12d3-a456-426614174000')
      }
    })

    it('should reject invalid UUID', () => {
      const invalidData = {
        contentId: 'invalid-uuid',
      }

      const result = contentIdParamSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })
  })

  describe('Streaming Platforms', () => {
    it('should accept valid streaming platforms', () => {
      const validPlatforms = ['NETFLIX', 'HULU', 'AMAZON_PRIME', 'HBO_MAX']

      const result = createContentSchema.safeParse({
        title: 'Test Movie',
        description: 'Test description',
        genre: 'Action',
        type: 'MOVIE',
        language: 'English',
        country: 'USA',
        streamingPlatforms: validPlatforms,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.streamingPlatforms).toEqual(validPlatforms)
      }
    })

    it('should reject invalid streaming platforms', () => {
      const invalidPlatforms = ['INVALID_PLATFORM']

      const result = createContentSchema.safeParse({
        title: 'Test Movie',
        description: 'Test description',
        genre: 'Action',
        type: 'MOVIE',
        language: 'English',
        country: 'USA',
        streamingPlatforms: invalidPlatforms,
      })

      expect(result.success).toBe(false)
    })

    it('should accept up to 20 streaming platforms', () => {
      const manyPlatforms = Array(20).fill('NETFLIX')

      const result = createContentSchema.safeParse({
        title: 'Test Movie',
        description: 'Test description',
        genre: 'Action',
        type: 'MOVIE',
        language: 'English',
        country: 'USA',
        streamingPlatforms: manyPlatforms,
      })

      expect(result.success).toBe(true)
    })

    it('should reject more than 20 streaming platforms', () => {
      const tooManyPlatforms = Array(21).fill('NETFLIX')

      const result = createContentSchema.safeParse({
        title: 'Test Movie',
        description: 'Test description',
        genre: 'Action',
        type: 'MOVIE',
        language: 'English',
        country: 'USA',
        streamingPlatforms: tooManyPlatforms,
      })

      expect(result.success).toBe(false)
    })
  })
})
