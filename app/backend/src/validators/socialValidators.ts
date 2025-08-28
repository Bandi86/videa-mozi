import { z } from 'zod'

// Reusable validation schemas
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

// Posts validation schemas
export const createPostSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title must be less than 255 characters'),
  content: z
    .string()
    .min(1, 'Content is required')
    .max(10000, 'Content must be less than 10,000 characters'),
  categoryId: idSchema.optional(),
  tagIds: z.array(idSchema).max(10, 'Maximum 10 tags allowed').optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
  imageUrl: z.string().url('Invalid image URL').optional(),
  images: z
    .array(z.string().url('Invalid image URL'))
    .max(10, 'Maximum 10 images allowed')
    .optional(),
})

export const updatePostSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255).optional(),
  content: z.string().min(1, 'Content is required').max(10000).optional(),
  categoryId: idSchema.optional(),
  tagIds: z.array(idSchema).max(10, 'Maximum 10 tags allowed').optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  imageUrl: z.string().url('Invalid image URL').optional(),
  images: z
    .array(z.string().url('Invalid image URL'))
    .max(10, 'Maximum 10 images allowed')
    .optional(),
})

export const getPostsSchema = z
  .object({
    categoryId: idSchema.optional(),
    tagId: idSchema.optional(),
    authorId: idSchema.optional(),
    status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
    search: z.string().max(255).optional(),
  })
  .merge(paginationSchema)

// Comments validation schemas
export const createCommentSchema = z.object({
  content: z
    .string()
    .min(1, 'Comment content is required')
    .max(2000, 'Comment must be less than 2,000 characters'),
  postId: idSchema,
  parentId: idSchema.optional(), // For nested comments
  imageUrl: z.string().url('Invalid image URL').optional(),
})

export const updateCommentSchema = z.object({
  content: z
    .string()
    .min(1, 'Comment content is required')
    .max(2000, 'Comment must be less than 2,000 characters'),
  imageUrl: z.string().url('Invalid image URL').optional(),
})

export const getCommentsSchema = z
  .object({
    postId: idSchema.optional(),
    authorId: idSchema.optional(),
    tagId: idSchema.optional(),
    categoryId: idSchema.optional(),
  })
  .merge(paginationSchema)

// Likes validation schemas
export const createLikeSchema = z
  .object({
    postId: idSchema.optional(),
    commentId: idSchema.optional(),
  })
  .refine(data => data.postId || data.commentId, {
    message: 'Either postId or commentId must be provided',
  })

export const getLikesSchema = z
  .object({
    postId: idSchema.optional(),
    commentId: idSchema.optional(),
    userId: idSchema.optional(),
    tagId: idSchema.optional(),
    categoryId: idSchema.optional(),
  })
  .merge(paginationSchema)

// Followers validation schemas
export const followUserSchema = z.object({
  followingId: idSchema,
})

export const getFollowersSchema = z
  .object({
    userId: idSchema.optional(),
    tagId: idSchema.optional(),
    categoryId: idSchema.optional(),
  })
  .merge(paginationSchema)

export const getFollowingSchema = z
  .object({
    userId: idSchema.optional(),
    tagId: idSchema.optional(),
    categoryId: idSchema.optional(),
  })
  .merge(paginationSchema)

// Shares validation schemas
export const createShareSchema = z.object({
  postId: idSchema,
})

export const getSharesSchema = z
  .object({
    postId: idSchema.optional(),
    userId: idSchema.optional(),
    tagId: idSchema.optional(),
    categoryId: idSchema.optional(),
  })
  .merge(paginationSchema)

// Reports validation schemas
export const createReportSchema = z
  .object({
    postId: idSchema.optional(),
    commentId: idSchema.optional(),
    reportedUserId: idSchema.optional(),
    type: z.enum(['SPAM', 'HARASSMENT', 'INAPPROPRIATE_CONTENT', 'COPYRIGHT_VIOLATION', 'OTHER']),
    reason: z
      .string()
      .min(5, 'Reason must be at least 5 characters')
      .max(500, 'Reason must be less than 500 characters'),
    description: z.string().max(2000, 'Description must be less than 2,000 characters').optional(),
  })
  .refine(data => data.postId || data.commentId || data.reportedUserId, {
    message: 'Either postId, commentId, or reportedUserId must be provided',
  })

export const updateReportSchema = z.object({
  status: z.enum(['PENDING', 'REVIEWED', 'RESOLVED', 'DISMISSED']),
  description: z.string().max(2000).optional(),
})

export const getReportsSchema = z
  .object({
    postId: idSchema.optional(),
    commentId: idSchema.optional(),
    reportedUserId: idSchema.optional(),
    reporterId: idSchema.optional(),
    type: z
      .enum(['SPAM', 'HARASSMENT', 'INAPPROPRIATE_CONTENT', 'COPYRIGHT_VIOLATION', 'OTHER'])
      .optional(),
    status: z.enum(['PENDING', 'REVIEWED', 'RESOLVED', 'DISMISSED']).optional(),
  })
  .merge(paginationSchema)

// Categories validation schemas
export const createCategorySchema = z.object({
  name: z
    .string()
    .min(1, 'Category name is required')
    .max(100, 'Name must be less than 100 characters'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
})

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
})

// Tags validation schemas
export const createTagSchema = z.object({
  name: z.string().min(1, 'Tag name is required').max(50, 'Name must be less than 50 characters'),
})

export const updateTagSchema = z.object({
  name: z.string().min(1).max(50).optional(),
})

// Query parameter validation schemas
export const idParamSchema = z.object({
  id: idSchema,
})

export const postIdParamSchema = z.object({
  postId: idSchema,
})

export const commentIdParamSchema = z.object({
  commentId: idSchema,
})

export const userIdParamSchema = z.object({
  userId: idSchema,
})

export const categoryIdParamSchema = z.object({
  categoryId: idSchema,
})

export const tagIdParamSchema = z.object({
  tagId: idSchema,
})

// User profile validation schemas
export const updateProfileSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be less than 50 characters')
    .optional(),
  bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
  profilePicture: z.string().url('Invalid profile picture URL').optional(),
})

export const updatePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'New password must be at least 8 characters')
      .max(128, 'New password must be less than 128 characters'),
    confirmPassword: z.string().min(1, 'Password confirmation is required'),
  })
  .refine(data => data.newPassword === data.confirmPassword, {
    message: "New passwords don't match",
    path: ['confirmPassword'],
  })

// Export types for use in controllers
export type CreatePostInput = z.infer<typeof createPostSchema>
export type UpdatePostInput = z.infer<typeof updatePostSchema>
export type GetPostsInput = z.infer<typeof getPostsSchema>
export type CreateCommentInput = z.infer<typeof createCommentSchema>
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>
export type CreateLikeInput = z.infer<typeof createLikeSchema>
export type FollowUserInput = z.infer<typeof followUserSchema>
export type CreateShareInput = z.infer<typeof createShareSchema>
export type CreateReportInput = z.infer<typeof createReportSchema>
export type UpdateReportInput = z.infer<typeof updateReportSchema>
export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>
export type CreateTagInput = z.infer<typeof createTagSchema>
export type UpdateTagInput = z.infer<typeof updateTagSchema>
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>
export type GetCommentsInput = z.infer<typeof getCommentsSchema>
export type GetLikesInput = z.infer<typeof getLikesSchema>
export type GetFollowersInput = z.infer<typeof getFollowersSchema>
export type GetFollowingInput = z.infer<typeof getFollowingSchema>
export type GetSharesInput = z.infer<typeof getSharesSchema>
export type GetReportsInput = z.infer<typeof getReportsSchema>
