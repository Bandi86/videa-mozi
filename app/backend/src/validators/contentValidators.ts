import { z } from 'zod'

// Reusable validation schemas
const uuidSchema = z.string().uuid('Invalid UUID format')

const idSchema = z.number().int().positive('ID must be a positive integer')

const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

const searchSchema = z.object({
  query: z.string().min(1, 'Search query is required').max(255),
})

// Content validation schemas
export const createContentSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title must be less than 255 characters'),
  description: z
    .string()
    .min(1, 'Description is required')
    .max(2000, 'Description must be less than 2,000 characters'),
  image: z.string().url('Invalid image URL').optional(),
  trailer: z.string().url('Invalid trailer URL').optional(),
  rating: z.number().min(0).max(10).optional(),
  releaseDate: z.string().datetime('Invalid release date format').optional(),
  genre: z.string().min(1, 'Genre is required').max(100, 'Genre must be less than 100 characters'),
  type: z.enum(['MOVIE', 'SERIES'], {
    message: 'Type must be either MOVIE or SERIES',
  }),
  duration: z.number().int().min(1, 'Duration must be at least 1 minute').optional(),
  language: z
    .string()
    .min(1, 'Language is required')
    .max(50, 'Language must be less than 50 characters'),
  country: z
    .string()
    .min(1, 'Country is required')
    .max(100, 'Country must be less than 100 characters'),

  // Series-specific fields
  seasons: z.number().int().min(1, 'Seasons must be at least 1').optional(),
  episodes: z.number().int().min(1, 'Episodes must be at least 1').optional(),
  episodeDuration: z.number().int().min(1, 'Episode duration must be at least 1 minute').optional(),

  // Content flags
  isFeatured: z.boolean().default(false),
  isTrending: z.boolean().default(false),
  isNew: z.boolean().default(false),
  isPopular: z.boolean().default(false),
  isTopRated: z.boolean().default(false),
  isUpcoming: z.boolean().default(false),
  isNowPlaying: z.boolean().default(false),
  isComingSoon: z.boolean().default(false),
  isInTheaters: z.boolean().default(false),

  // Streaming platforms
  streamingPlatforms: z
    .array(
      z.enum([
        'NETFLIX',
        'HULU',
        'AMAZON_PRIME',
        'HBO_MAX',
        'SHOWTIME',
        'STARZ',
        'HGTV',
        'DISCOVERY_PLUS',
        'PEACOCK',
        'APPLE_TV',
        'DISNEY_PLUS',
        'YOUTUBE',
        'OTHER',
      ]),
    )
    .max(20, 'Maximum 20 streaming platforms allowed')
    .optional(),
})

export const updateContentSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().min(1).max(2000).optional(),
  image: z.string().url('Invalid image URL').optional(),
  trailer: z.string().url('Invalid trailer URL').optional(),
  rating: z.number().min(0).max(10).optional(),
  releaseDate: z.string().datetime('Invalid release date format').optional(),
  genre: z.string().min(1).max(100).optional(),
  type: z
    .enum(['MOVIE', 'SERIES'], {
      message: 'Type must be either MOVIE or SERIES',
    })
    .optional(),
  duration: z.number().int().min(1).optional(),
  language: z.string().min(1).max(50).optional(),
  country: z.string().min(1).max(100).optional(),

  // Series-specific fields
  seasons: z.number().int().min(1).optional(),
  episodes: z.number().int().min(1).optional(),
  episodeDuration: z.number().int().min(1).optional(),

  // Content flags
  isFeatured: z.boolean().optional(),
  isTrending: z.boolean().optional(),
  isNew: z.boolean().optional(),
  isPopular: z.boolean().optional(),
  isTopRated: z.boolean().optional(),
  isUpcoming: z.boolean().optional(),
  isNowPlaying: z.boolean().optional(),
  isComingSoon: z.boolean().optional(),
  isInTheaters: z.boolean().optional(),

  // Streaming platforms
  streamingPlatforms: z
    .array(
      z.enum([
        'NETFLIX',
        'HULU',
        'AMAZON_PRIME',
        'HBO_MAX',
        'SHOWTIME',
        'STARZ',
        'HGTV',
        'DISCOVERY_PLUS',
        'PEACOCK',
        'APPLE_TV',
        'DISNEY_PLUS',
        'YOUTUBE',
        'OTHER',
      ]),
    )
    .max(20, 'Maximum 20 streaming platforms allowed')
    .optional(),
})

export const getContentSchema = z
  .object({
    type: z.enum(['MOVIE', 'SERIES']).optional(),
    genre: z.string().max(100).optional(),
    language: z.string().max(50).optional(),
    country: z.string().max(100).optional(),
    rating: z.number().min(0).max(10).optional(),
    isFeatured: z.boolean().optional(),
    isTrending: z.boolean().optional(),
    isNew: z.boolean().optional(),
    isPopular: z.boolean().optional(),
    isTopRated: z.boolean().optional(),
    isUpcoming: z.boolean().optional(),
    isNowPlaying: z.boolean().optional(),
    isComingSoon: z.boolean().optional(),
    isInTheaters: z.boolean().optional(),
    streamingPlatforms: z
      .array(
        z.enum([
          'NETFLIX',
          'HULU',
          'AMAZON_PRIME',
          'HBO_MAX',
          'SHOWTIME',
          'STARZ',
          'HGTV',
          'DISCOVERY_PLUS',
          'PEACOCK',
          'APPLE_TV',
          'DISNEY_PLUS',
          'YOUTUBE',
          'OTHER',
        ]),
      )
      .optional(),
    search: z.string().max(255).optional(),
    createdBy: idSchema.optional(),
  })
  .merge(paginationSchema)

// Content comments validation schemas
export const createContentCommentSchema = z.object({
  content: z
    .string()
    .min(1, 'Comment content is required')
    .max(2000, 'Comment must be less than 2,000 characters'),
  contentId: uuidSchema,
  parentId: idSchema.optional(), // For nested comments
  imageUrl: z.string().url('Invalid image URL').optional(),
})

export const updateContentCommentSchema = z.object({
  content: z
    .string()
    .min(1, 'Comment content is required')
    .max(2000, 'Comment must be less than 2,000 characters'),
  imageUrl: z.string().url('Invalid image URL').optional(),
})

export const getContentCommentsSchema = z
  .object({
    contentId: uuidSchema.optional(),
    authorId: idSchema.optional(),
  })
  .merge(paginationSchema)

// Content likes validation schemas
export const createContentLikeSchema = z.object({
  contentId: uuidSchema,
})

export const getContentLikesSchema = z
  .object({
    contentId: uuidSchema.optional(),
    userId: idSchema.optional(),
  })
  .merge(paginationSchema)

// Content comment likes validation schemas
export const createContentCommentLikeSchema = z.object({
  commentId: idSchema,
})

export const getContentCommentLikesSchema = z
  .object({
    commentId: idSchema.optional(),
    userId: idSchema.optional(),
  })
  .merge(paginationSchema)

// Content shares validation schemas
export const createContentShareSchema = z.object({
  contentId: uuidSchema,
})

export const getContentSharesSchema = z
  .object({
    contentId: uuidSchema.optional(),
    userId: idSchema.optional(),
  })
  .merge(paginationSchema)

// Content reports validation schemas
export const createContentReportSchema = z
  .object({
    contentId: uuidSchema.optional(),
    commentId: idSchema.optional(),
    type: z.enum(['SPAM', 'HARASSMENT', 'INAPPROPRIATE_CONTENT', 'COPYRIGHT_VIOLATION', 'OTHER']),
    reason: z
      .string()
      .min(5, 'Reason must be at least 5 characters')
      .max(500, 'Reason must be less than 500 characters'),
    description: z.string().max(2000, 'Description must be less than 2,000 characters').optional(),
  })
  .refine(data => data.contentId || data.commentId, {
    message: 'Either contentId or commentId must be provided',
  })

export const updateContentReportSchema = z.object({
  status: z.enum(['PENDING', 'REVIEWED', 'RESOLVED', 'DISMISSED']),
  description: z.string().max(2000).optional(),
})

export const getContentReportsSchema = z
  .object({
    contentId: uuidSchema.optional(),
    commentId: idSchema.optional(),
    reporterId: idSchema.optional(),
    type: z
      .enum(['SPAM', 'HARASSMENT', 'INAPPROPRIATE_CONTENT', 'COPYRIGHT_VIOLATION', 'OTHER'])
      .optional(),
    status: z.enum(['PENDING', 'REVIEWED', 'RESOLVED', 'DISMISSED']).optional(),
  })
  .merge(paginationSchema)

// Parameter validation schemas
export const contentIdParamSchema = z.object({
  contentId: uuidSchema,
})

export const contentCommentIdParamSchema = z.object({
  commentId: idSchema,
})

// Type exports for TypeScript
export type CreateContentInput = z.infer<typeof createContentSchema>
export type UpdateContentInput = z.infer<typeof updateContentSchema>
export type GetContentInput = z.infer<typeof getContentSchema>
export type CreateContentCommentInput = z.infer<typeof createContentCommentSchema>
export type UpdateContentCommentInput = z.infer<typeof updateContentCommentSchema>
export type GetContentCommentsInput = z.infer<typeof getContentCommentsSchema>
export type CreateContentLikeInput = z.infer<typeof createContentLikeSchema>
export type GetContentLikesInput = z.infer<typeof getContentLikesSchema>
export type CreateContentCommentLikeInput = z.infer<typeof createContentCommentLikeSchema>
export type GetContentCommentLikesInput = z.infer<typeof getContentCommentLikesSchema>
export type CreateContentShareInput = z.infer<typeof createContentShareSchema>
export type GetContentSharesInput = z.infer<typeof getContentSharesSchema>
export type CreateContentReportInput = z.infer<typeof createContentReportSchema>
export type UpdateContentReportInput = z.infer<typeof updateContentReportSchema>
export type GetContentReportsInput = z.infer<typeof getContentReportsSchema>
