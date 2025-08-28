// Common types shared across all services

export interface PaginationOptions {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginationResult<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  error?: string
  timestamp: string
  path: string
  method: string
}

export interface ErrorResponse {
  success: false
  error: string
  code: string
  status: number
  details?: any
  timestamp: string
  path: string
  method: string
}

export interface SuccessResponse<T = any> {
  success: true
  data: T
  message?: string
  timestamp: string
  path: string
  method: string
}

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy'
  service: string
  timestamp: string
  uptime: number
  memory: {
    used: number // MB
    total: number // MB
    percentage: number
  }
  database?: {
    status: 'connected' | 'disconnected'
    responseTime: number
    timestamp: string
  }
  redis?: {
    status: 'connected' | 'disconnected'
    responseTime: number
    timestamp: string
  }
  system?: {
    platform: string
    arch: string
    nodeVersion: string
    cpuCount: number
    loadAverage: number[]
  }
}

export interface ServiceHealthResponse {
  status: 'healthy' | 'unhealthy'
  services: Record<
    string,
    {
      status: 'healthy' | 'unhealthy' | 'not_configured'
      responseTime: number
      timestamp: string
      error?: string
    }
  >
  timestamp: string
}

export interface MetricsResponse {
  period: string
  metrics: Record<string, any>
  timestamp: string
}

export interface RequestContext {
  userId?: string
  username?: string
  userRole?: string
  sessionId?: string
  ipAddress?: string
  userAgent?: string
  requestId: string
  timestamp: string
}

export interface LogEntry {
  level: 'error' | 'warn' | 'info' | 'debug'
  message: string
  service: string
  timestamp: string
  context?: RequestContext
  error?: {
    message: string
    stack?: string
    code?: string
  }
  metadata?: Record<string, any>
}

export type SortOrder = 'asc' | 'desc'

export type UserRole = 'USER' | 'ADMIN' | 'MODERATOR'

export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'PENDING_VERIFICATION' | 'DELETED'

export type AccountVisibility = 'PUBLIC' | 'FRIENDS_ONLY' | 'PRIVATE'

export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY'
