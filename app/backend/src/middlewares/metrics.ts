import { Request, Response, NextFunction } from 'express'
import os from 'os'

// Metrics storage
interface MetricsData {
  requests: {
    total: number
    byMethod: Record<string, number>
    byStatus: Record<number, number>
    byEndpoint: Record<string, number>
    responseTimes: {
      avg: number
      min: number
      max: number
      percentiles: {
        p50: number
        p95: number
        p99: number
      }
    }
  }
  errors: {
    total: number
    byType: Record<string, number>
    byStatus: Record<number, number>
  }
  system: {
    memory: {
      used: number
      total: number
      percentage: number
    }
    cpu: {
      usage: number
      loadAverage: number[]
    }
    uptime: number
  }
  timestamp: string
}

// In-memory metrics storage (in production, use Redis or time-series database)
let metrics: MetricsData = {
  requests: {
    total: 0,
    byMethod: {},
    byStatus: {},
    byEndpoint: {},
    responseTimes: {
      avg: 0,
      min: Infinity,
      max: 0,
      percentiles: {
        p50: 0,
        p95: 0,
        p99: 0,
      },
    },
  },
  errors: {
    total: 0,
    byType: {},
    byStatus: {},
  },
  system: {
    memory: {
      used: 0,
      total: 0,
      percentage: 0,
    },
    cpu: {
      usage: 0,
      loadAverage: [0, 0, 0],
    },
    uptime: 0,
  },
  timestamp: new Date().toISOString(),
}

let requestCount = 0
let responseTimeSum = 0
let responseTimes: number[] = []
let startTime = Date.now()

// Update metrics
const updateMetrics = (
  method: string,
  statusCode: number,
  responseTime: number,
  endpoint: string,
  errorType?: string,
): void => {
  // Update request counts
  metrics.requests.total++
  metrics.requests.byMethod[method] = (metrics.requests.byMethod[method] || 0) + 1
  metrics.requests.byStatus[statusCode] = (metrics.requests.byStatus[statusCode] || 0) + 1
  metrics.requests.byEndpoint[endpoint] = (metrics.requests.byEndpoint[endpoint] || 0) + 1

  // Update response times
  requestCount++
  responseTimeSum += responseTime
  responseTimes.push(responseTime)

  // Keep only last 1000 response times for percentile calculation
  if (responseTimes.length > 1000) {
    responseTimes = responseTimes.slice(-1000)
  }

  metrics.requests.responseTimes.avg = responseTimeSum / requestCount
  metrics.requests.responseTimes.min = Math.min(metrics.requests.responseTimes.min, responseTime)
  metrics.requests.responseTimes.max = Math.max(metrics.requests.responseTimes.max, responseTime)

  // Calculate percentiles
  const sortedTimes = [...responseTimes].sort((a, b) => a - b)
  const p50Index = Math.floor(sortedTimes.length * 0.5)
  const p95Index = Math.floor(sortedTimes.length * 0.95)
  const p99Index = Math.floor(sortedTimes.length * 0.99)

  metrics.requests.responseTimes.percentiles.p50 = sortedTimes[p50Index] || 0
  metrics.requests.responseTimes.percentiles.p95 = sortedTimes[p95Index] || 0
  metrics.requests.responseTimes.percentiles.p99 = sortedTimes[p99Index] || 0

  // Update error counts
  if (statusCode >= 400) {
    metrics.errors.total++
    metrics.errors.byStatus[statusCode] = (metrics.errors.byStatus[statusCode] || 0) + 1

    if (errorType) {
      metrics.errors.byType[errorType] = (metrics.errors.byType[errorType] || 0) + 1
    }
  }

  // Update system metrics
  updateSystemMetrics()

  metrics.timestamp = new Date().toISOString()
}

// Update system metrics
const updateSystemMetrics = (): void => {
  // Memory usage
  const memUsage = process.memoryUsage()
  const totalMemory = os.totalmem()
  const usedMemory = memUsage.heapUsed
  const memoryPercentage = (usedMemory / totalMemory) * 100

  metrics.system.memory = {
    used: Math.round(usedMemory / 1024 / 1024), // MB
    total: Math.round(totalMemory / 1024 / 1024), // MB
    percentage: Math.round(memoryPercentage * 100) / 100,
  }

  // CPU usage
  const loadAverage = os.loadavg()
  const cpuUsage = (loadAverage[0] / os.cpus().length) * 100

  metrics.system.cpu = {
    usage: Math.round(cpuUsage * 100) / 100,
    loadAverage: loadAverage.map(load => Math.round(load * 100) / 100),
  }

  // Uptime
  metrics.system.uptime = Math.floor((Date.now() - startTime) / 1000)
}

// Metrics collection middleware
export const collectMetrics = (req: Request, res: Response, next: NextFunction): void => {
  const start = process.hrtime.bigint()
  const method = req.method
  const endpoint = req.route?.path || req.path

  // Override res.end to capture response details
  const originalEnd = res.end
  res.end = function (chunk?: any, encoding?: BufferEncoding | (() => void)) {
    const end = process.hrtime.bigint()
    const responseTime = Number(end - start) / 1_000_000 // Convert to milliseconds

    // Extract error type from response if available
    let errorType: string | undefined
    if (res.statusCode >= 400 && (res as any).errorType) {
      errorType = (res as any).errorType
    }

    // Update metrics
    updateMetrics(method, res.statusCode, responseTime, endpoint, errorType)

    // Call original end method
    if (typeof encoding === 'function') {
      return originalEnd.call(this, chunk, encoding as any)
    } else {
      return originalEnd.call(this, chunk, encoding as BufferEncoding)
    }
  }

  next()
}

// Get detailed metrics
export const getDetailedMetrics = (): MetricsData => {
  return { ...metrics }
}

// Reset metrics (useful for testing)
export const resetMetrics = (): void => {
  metrics = {
    requests: {
      total: 0,
      byMethod: {},
      byStatus: {},
      byEndpoint: {},
      responseTimes: {
        avg: 0,
        min: Infinity,
        max: 0,
        percentiles: {
          p50: 0,
          p95: 0,
          p99: 0,
        },
      },
    },
    errors: {
      total: 0,
      byType: {},
      byStatus: {},
    },
    system: {
      memory: {
        used: 0,
        total: 0,
        percentage: 0,
      },
      cpu: {
        usage: 0,
        loadAverage: [0, 0, 0],
      },
      uptime: 0,
    },
    timestamp: new Date().toISOString(),
  }

  requestCount = 0
  responseTimeSum = 0
  responseTimes = []
  startTime = Date.now()
}

// Metrics endpoint middleware
export const metricsEndpoint = (req: Request, res: Response, next: NextFunction): void => {
  const detailedMetrics = getDetailedMetrics()

  // Add cache control headers
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')

  res.json({
    success: true,
    data: detailedMetrics,
    meta: {
      timestamp: new Date().toISOString(),
      collectionPeriod: `${Math.floor((Date.now() - startTime) / 1000)}s`,
    },
  })
}

// Health score calculation
export const calculateHealthScore = (): number => {
  const { requests, errors, system } = metrics

  // Request success rate (0-100)
  const successRate =
    requests.total > 0 ? ((requests.total - (errors.total || 0)) / requests.total) * 100 : 100

  // Response time score (0-100, better for lower times)
  const avgResponseTime = requests.responseTimes.avg
  const responseTimeScore = Math.max(0, 100 - avgResponseTime / 10) // Penalize > 1s

  // System health score (0-100)
  const memoryScore = Math.max(0, 100 - system.memory.percentage)
  const cpuScore = Math.max(0, 100 - system.cpu.usage)

  // Weighted average
  const healthScore =
    successRate * 0.4 + responseTimeScore * 0.3 + memoryScore * 0.15 + cpuScore * 0.15

  return Math.round(healthScore * 100) / 100
}
