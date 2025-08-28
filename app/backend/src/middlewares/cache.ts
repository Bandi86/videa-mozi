import { Request, Response, NextFunction } from 'express'
import Redis from 'ioredis'

// Redis client for caching
let redisClient: any = null

if (process.env.REDIS_URL) {
  redisClient = new (Redis as any)(process.env.REDIS_URL!)
}

// Simple in-memory cache fallback
const memoryCache = new Map<string, { data: any; expires: number }>()

// Set Redis client (for testing purposes)
export const setRedisClient = (client: any): void => {
  redisClient = client
}

// Get cache key
const getCacheKey = (req: Request, prefix: string = 'cache'): string => {
  const url = req.originalUrl
  const userId = (req as any).user?.id || 'anonymous'
  const method = req.method

  return `${prefix}:${method}:${userId}:${url}`
}

// Response caching middleware
export const cache = (ttlSeconds: number = 300, prefix: string = 'response') => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next()
    }

    const cacheKey = getCacheKey(req, prefix)

    try {
      let cachedData: string | null = null

      if (redisClient) {
        cachedData = await redisClient.get(cacheKey)
      } else {
        // Fallback to memory cache
        const memoryData = memoryCache.get(cacheKey)
        if (memoryData && memoryData.expires > Date.now()) {
          cachedData = JSON.stringify(memoryData.data)
        } else if (memoryData) {
          memoryCache.delete(cacheKey)
        }
      }

      if (cachedData) {
        const parsedData = JSON.parse(cachedData)
        res.setHeader('X-Cache-Status', 'HIT')
        res.setHeader('X-Cache-TTL', ttlSeconds.toString())
        res.json(parsedData)
        return
      }

      // Cache miss - capture response
      res.setHeader('X-Cache-Status', 'MISS')

      const originalJson = res.json
      res.json = function (data: any) {
        // Store in cache
        const cacheData = JSON.stringify(data)

        if (redisClient) {
          redisClient
            .setex(cacheKey, ttlSeconds, cacheData)
            .catch((err: Error) => console.error('Cache storage error:', err))
        } else {
          // Store in memory cache
          memoryCache.set(cacheKey, {
            data,
            expires: Date.now() + ttlSeconds * 1000,
          })
        }

        // Call original json method
        return originalJson.call(this, data)
      }

      next()
    } catch (error) {
      console.error('Cache middleware error:', error)
      next()
    }
  }
}

// Clear cache middleware (for invalidation)
export const clearCache = (patterns: string[] = []) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (redisClient) {
        // Clear Redis cache
        for (const pattern of patterns) {
          const keys = await redisClient.keys(pattern)
          if (keys.length > 0) {
            await redisClient.del(...keys)
          }
        }
      } else {
        // Clear memory cache
        for (const pattern of patterns) {
          for (const [key] of memoryCache) {
            if (key.includes(pattern)) {
              memoryCache.delete(key)
            }
          }
        }
      }

      res.setHeader('X-Cache-Cleared', 'true')
      next()
    } catch (error) {
      console.error('Cache clear error:', error)
      next()
    }
  }
}

// Cache invalidation helper
export const invalidateCache = async (patterns: string[]): Promise<void> => {
  try {
    if (redisClient) {
      for (const pattern of patterns) {
        const keys = await redisClient.keys(pattern)
        if (keys.length > 0) {
          await redisClient.del(...keys)
        }
      }
    } else {
      for (const pattern of patterns) {
        for (const [key] of memoryCache) {
          if (key.includes(pattern)) {
            memoryCache.delete(key)
          }
        }
      }
    }
  } catch (error) {
    console.error('Cache invalidation error:', error)
  }
}

// Cache statistics middleware
export const cacheStats = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    let info: any = {}

    if (redisClient) {
      const redisInfo = await redisClient.info('memory')
      info.redis = {
        connected_clients: redisInfo.match(/connected_clients:(\d+)/)?.[1],
        used_memory_human: redisInfo.match(/used_memory_human:(.+)/)?.[1],
        total_connections_received: redisInfo.match(/total_connections_received:(\d+)/)?.[1],
      }
    }

    // Memory cache stats
    info.memory = {
      entries: memoryCache.size,
      maxAge: Math.max(...Array.from(memoryCache.values()).map(v => v.expires - Date.now())) / 1000,
    }

    res.json({
      success: true,
      data: info,
      meta: {
        timestamp: new Date().toISOString(),
        cacheType: redisClient ? 'redis' : 'memory',
      },
    })
  } catch (error) {
    console.error('Cache stats error:', error)
    next(error)
  }
}
