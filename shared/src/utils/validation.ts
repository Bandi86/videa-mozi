// Common validation utilities using Zod

import { z } from 'zod'
import { UserRole, UserStatus, AccountVisibility, Gender } from '../types/common.js'

// Common validation schemas
export const emailSchema = z
  .string()
  .email('Invalid email format')
  .min(1, 'Email is required')
  .max(255, 'Email too long')

export const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be less than 30 characters')
  .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password too long')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    'Password must contain at least one lowercase letter, one uppercase letter, and one number',
  )

export const displayNameSchema = z
  .string()
  .min(1, 'Display name is required')
  .max(100, 'Display name too long')
  .trim()

export const bioSchema = z.string().max(500, 'Bio must be less than 500 characters').optional()

export const websiteSchema = z.string().url('Invalid website URL').optional().or(z.literal(''))

export const locationSchema = z.string().max(100, 'Location too long').optional()

export const avatarUrlSchema = z.string().url('Invalid avatar URL').optional().or(z.literal(''))

export const coverImageUrlSchema = z
  .string()
  .url('Invalid cover image URL')
  .optional()
  .or(z.literal(''))

export const userRoleSchema = z.enum(['USER', 'ADMIN', 'MODERATOR'])

export const userStatusSchema = z.enum([
  'ACTIVE',
  'SUSPENDED',
  'BANNED',
  'PENDING_VERIFICATION',
  'DELETED',
])

export const accountVisibilitySchema = z.enum(['PUBLIC', 'FRIENDS_ONLY', 'PRIVATE'])

export const genderSchema = z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'])

export const dateOfBirthSchema = z
  .string()
  .datetime('Invalid date format')
  .optional()
  .transform(val => (val ? new Date(val) : undefined))

// User validation schemas
export const createUserSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  password: passwordSchema,
  firstName: z.string().max(50).optional(),
  lastName: z.string().max(50).optional(),
  displayName: displayNameSchema.optional(),
  bio: bioSchema,
  website: websiteSchema,
  location: locationSchema,
  gender: genderSchema.optional(),
  dateOfBirth: dateOfBirthSchema,
  role: userRoleSchema.optional(),
  status: userStatusSchema.optional(),
  visibility: accountVisibilitySchema.optional(),
  isPrivate: z.boolean().optional(),
})

export const updateUserSchema = z.object({
  firstName: z.string().max(50).optional(),
  lastName: z.string().max(50).optional(),
  displayName: displayNameSchema.optional(),
  bio: bioSchema,
  website: websiteSchema,
  location: locationSchema,
  gender: genderSchema.optional(),
  dateOfBirth: dateOfBirthSchema,
  avatarUrl: avatarUrlSchema,
  coverImageUrl: coverImageUrlSchema,
  visibility: accountVisibilitySchema.optional(),
  isPrivate: z.boolean().optional(),
  allowMessages: z.boolean().optional(),
  allowTagging: z.boolean().optional(),
  showOnlineStatus: z.boolean().optional(),
})

export const loginSchema = z.object({
  emailOrUsername: z.string().min(1, 'Email or username is required'),
  password: z.string().min(1, 'Password is required'),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: passwordSchema,
})

export const forgotPasswordSchema = z.object({
  email: emailSchema,
})

// Pagination schemas
export const paginationSchema = z.object({
  page: z.number().int().min(1).optional().default(1),
  limit: z.number().int().min(1).max(100).optional().default(20),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
})

// User filters schema
export const userFiltersSchema = z.object({
  role: userRoleSchema.optional(),
  status: userStatusSchema.optional(),
  visibility: accountVisibilitySchema.optional(),
  isPrivate: z.boolean().optional(),
  isEmailVerified: z.boolean().optional(),
  gender: genderSchema.optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  search: z.string().optional(),
})

// Search schema
export const searchSchema = z.object({
  q: z.string().min(1, 'Search query is required').max(100, 'Search query too long'),
})

// ID parameter schema
export const idParamSchema = z.object({
  id: z.string().min(1, 'ID is required'),
})

// Common validation functions
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formattedErrors = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
      }))

      throw new ValidationError('Validation failed', formattedErrors)
    }
    throw error
  }
}

export function validatePartialData<T>(schema: z.ZodSchema<T>, data: unknown): Partial<T> {
  try {
    // For newer Zod versions, we need to handle partial differently
    const partialSchema = schema instanceof z.ZodObject ? schema.partial() : schema
    return partialSchema.parse(data) as Partial<T>
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formattedErrors = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
      }))

      throw new ValidationError('Validation failed', formattedErrors)
    }
    throw error
  }
}

// Custom validation error class
export class ValidationError extends Error {
  public errors: Array<{
    field: string
    message: string
    code: string
  }>

  constructor(
    message: string,
    errors: Array<{
      field: string
      message: string
      code: string
    }>,
  ) {
    super(message)
    this.name = 'ValidationError'
    this.errors = errors
  }
}

// Type exports
export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type PaginationInput = z.infer<typeof paginationSchema>
export type UserFiltersInput = z.infer<typeof userFiltersSchema>
export type SearchInput = z.infer<typeof searchSchema>
export type IdParamInput = z.infer<typeof idParamSchema>
