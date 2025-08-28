import { Request, Response } from 'express'
import prisma from '../config/prisma.js'
import { logSecurityEvent } from '../config/logger.js'

/**
 * Common utility functions used across controllers and services
 */

/**
 * Extract user ID from request with proper typing
 */
export const getUserId = (req: Request): number => {
  const userId = (req as any).user?.id
  if (!userId) {
    throw new Error('Authentication required')
  }
  return userId
}

/**
 * Check if user has admin privileges
 */
export const requireAdmin = async (userId: number): Promise<void> => {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { roles: true },
  })

  if (!user || user.roles !== 'ADMIN') {
    throw new Error('Insufficient privileges')
  }
}

/**
 * Check if user can perform action on resource
 */
export const checkResourceOwnership = async (
  userId: number,
  resourceUserId: number,
  resourceType: string,
): Promise<void> => {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { roles: true },
  })

  if (resourceUserId !== userId && user?.roles !== 'ADMIN') {
    throw new Error(`Insufficient privileges to access this ${resourceType}`)
  }
}

/**
 * Handle errors consistently across controllers
 */
export const handleControllerError = (
  error: unknown,
  res: Response,
  operation: string,
  userId?: number,
): void => {
  const err = error as Error

  logSecurityEvent(`${operation.toUpperCase()}_FAILED`, 'medium', {
    error: err.message,
    userId,
  })

  if (err.message.includes('Authentication required')) {
    res.status(401).json({ error: err.message })
  } else if (err.message.includes('Insufficient privileges')) {
    res.status(403).json({ error: err.message })
  } else if (err.message.includes('not found')) {
    res.status(404).json({ error: err.message })
  } else if (err.message.includes('already')) {
    res.status(409).json({ error: err.message })
  } else {
    res.status(500).json({ error: `Failed to ${operation.toLowerCase()}` })
  }
}

/**
 * Build pagination parameters
 */
export const buildPagination = (page: number, limit: number) => ({
  skip: (page - 1) * limit,
  take: limit,
})

/**
 * Build common include object for content queries
 */
export const buildContentInclude = () => ({
  creator: {
    select: { id: true, username: true },
  },
  updater: {
    select: { id: true, username: true },
  },
  _count: {
    select: {
      likes: true,
      comments: true,
      shares: true,
      reports: true,
    },
  },
})

/**
 * Build common include object for content comment queries
 */
export const buildContentCommentInclude = () => ({
  author: {
    select: { id: true, username: true },
  },
  contentRef: {
    select: { id: true, title: true, type: true },
  },
  parent: {
    select: { id: true, content: true },
  },
  _count: {
    select: {
      likes: true,
      replies: true,
    },
  },
})

/**
 * Validate resource existence
 */
export const validateResourceExists = async (
  model: any,
  where: any,
  resourceName: string,
): Promise<void> => {
  const resource = await model.findUnique({ where })
  if (!resource) {
    throw new Error(`${resourceName} not found`)
  }
}

/**
 * Handle Prisma unique constraint errors
 */
export const handlePrismaUniqueError = (error: any, message: string): never => {
  if (error.code === 'P2002') {
    throw new Error(message)
  }
  throw error
}

/**
 * Common response formatters
 */
export const formatSuccessResponse = (message: string, data?: any) => ({
  message,
  ...(data && { data }),
})

export const formatPaginatedResponse = (data: any[], pagination: any) => ({
  data,
  pagination,
})
