// Common utility functions shared across all services

import { v4 as uuidv4 } from 'uuid'
import { PaginationOptions, PaginationResult } from '../types/common.js'

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return uuidv4()
}

/**
 * Generate a short unique ID (8 characters)
 */
export function generateShortId(): string {
  return uuidv4().substring(0, 8)
}

/**
 * Generate a request ID for tracking
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${generateShortId()}`
}

/**
 * Calculate pagination metadata
 */
export function calculatePagination<T>(
  data: T[],
  total: number,
  options: PaginationOptions,
): PaginationResult<T> {
  const { page = 1, limit = 20 } = options
  const pages = Math.ceil(total / limit)
  const hasNext = page < pages
  const hasPrev = page > 1

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      pages,
      hasNext,
      hasPrev,
    },
  }
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * Sanitize string input
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return ''

  return input
    .trim()
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .substring(0, 10000) // Limit length
}

/**
 * Sanitize object input recursively
 */
export function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'string') return sanitizeString(obj)
  if (typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(sanitizeObject)

  const sanitized: any = {}
  for (const [key, value] of Object.entries(obj)) {
    sanitized[key] = sanitizeObject(value)
  }
  return sanitized
}

/**
 * Format date to ISO string
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toISOString()
}

/**
 * Format date to human readable string
 */
export function formatDateHuman(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Calculate time difference in human readable format
 */
export function timeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000)

  const intervals = [
    { label: 'year', seconds: 31536000 },
    { label: 'month', seconds: 2592000 },
    { label: 'week', seconds: 604800 },
    { label: 'day', seconds: 86400 },
    { label: 'hour', seconds: 3600 },
    { label: 'minute', seconds: 60 },
    { label: 'second', seconds: 1 },
  ]

  for (const interval of intervals) {
    const count = Math.floor(diffInSeconds / interval.seconds)
    if (count >= 1) {
      return count === 1 ? `1 ${interval.label} ago` : `${count} ${interval.label}s ago`
    }
  }

  return 'just now'
}

/**
 * Generate slug from string
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    .substring(0, 100) // Limit length
}

/**
 * Capitalize first letter of string
 */
export function capitalize(str: string): string {
  if (!str) return str
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.substring(0, maxLength - 3) + '...'
}

/**
 * Generate random string
 */
export function generateRandomString(length: number = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * Deep clone object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj
  if (obj instanceof Date) return new Date(obj.getTime()) as T
  if (Array.isArray(obj)) return obj.map(deepClone) as T

  const cloned = {} as T
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      cloned[key] = deepClone(obj[key])
    }
  }
  return cloned
}

/**
 * Check if value is empty (null, undefined, empty string, empty array, empty object)
 */
export function isEmpty(value: any): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.keys(value).length === 0
  return false
}

/**
 * Pick specific properties from object
 */
export function pick<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[],
): Pick<T, K> {
  const result = {} as Pick<T, K>
  keys.forEach(key => {
    if (key in obj) {
      result[key] = obj[key]
    }
  })
  return result
}

/**
 * Omit specific properties from object
 */
export function omit<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[],
): Omit<T, K> {
  const result = { ...obj }
  keys.forEach(key => delete result[key])
  return result
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Retry function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number
    initialDelay?: number
    maxDelay?: number
    backoffMultiplier?: number
  } = {},
): Promise<T> {
  const { maxAttempts = 3, initialDelay = 1000, maxDelay = 30000, backoffMultiplier = 2 } = options

  let lastError: Error

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      if (attempt === maxAttempts) {
        throw lastError
      }

      const delay = Math.min(initialDelay * Math.pow(backoffMultiplier, attempt - 1), maxDelay)
      await sleep(delay)
    }
  }

  throw lastError!
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.')
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''
}

/**
 * Get file size in human readable format
 */
export function formatFileSize(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  if (bytes === 0) return '0 Bytes'

  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Validate file type against allowed types
 */
export function isValidFileType(filename: string, allowedTypes: string[]): boolean {
  const extension = getFileExtension(filename)
  return allowedTypes.includes(extension) || allowedTypes.includes(`.${extension}`)
}

/**
 * Generate pagination SQL
 */
export function generatePaginationSQL(options: PaginationOptions): string {
  const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = options
  const offset = (page - 1) * limit

  return `ORDER BY "${sortBy}" ${sortOrder.toUpperCase()} LIMIT ${limit} OFFSET ${offset}`
}

/**
 * Parse boolean from string
 */
export function parseBoolean(value: string | boolean | number): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const lowerValue = value.toLowerCase()
    return lowerValue === 'true' || lowerValue === '1' || lowerValue === 'yes'
  }
  return false
}

/**
 * Format number with commas
 */
export function formatNumber(num: number): string {
  return num.toLocaleString()
}

/**
 * Check if string contains only alphanumeric characters
 */
export function isAlphanumeric(str: string): boolean {
  return /^[a-zA-Z0-9]+$/.test(str)
}

/**
 * Check if string contains only alphanumeric characters and underscores
 */
export function isAlphanumericWithUnderscore(str: string): boolean {
  return /^[a-zA-Z0-9_]+$/.test(str)
}

/**
 * Remove duplicate items from array
 */
export function removeDuplicates<T>(array: T[]): T[] {
  return Array.from(new Set(array))
}

/**
 * Shuffle array randomly
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}
