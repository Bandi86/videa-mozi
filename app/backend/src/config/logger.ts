import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import path from 'path'

// Define log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
}

const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
}

// Custom log format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
    const stackStr = stack ? `\n${stack}` : ''
    return `${timestamp} [${level}]: ${message} ${metaStr}${stackStr}`
  }),
)

// Custom log format for file output (JSON structured)
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
)

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs')

// File transport for all logs
const allLogsTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'app-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  format: fileFormat,
})

// File transport for error logs only
const errorLogsTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  maxSize: '20m',
  maxFiles: '30d',
  format: fileFormat,
})

// Console transport for development
const consoleTransport = new winston.transports.Console({
  level: process.env.LOG_LEVEL || 'info',
  format: consoleFormat,
  handleExceptions: true,
  handleRejections: true,
})

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels: logLevels,
  format: fileFormat,
  defaultMeta: { service: 'videa-mozi-backend' },
  transports: [consoleTransport, allLogsTransport, errorLogsTransport],
  exitOnError: false,
})

// Handle uncaught exceptions and unhandled rejections
logger.exceptions.handle(
  new winston.transports.File({ filename: path.join(logsDir, 'exceptions.log') }),
)

logger.rejections.handle(
  new winston.transports.File({ filename: path.join(logsDir, 'rejections.log') }),
)

// Custom logging methods for different use cases
export const logRequest = (req: any, res: any, responseTime?: number) => {
  const { method, url, ip, headers } = req
  const { statusCode } = res
  const userAgent = headers['user-agent'] || 'Unknown'
  const userId = req.user?.id || 'anonymous'

  logger.http('Request received', {
    method,
    url,
    statusCode,
    responseTime: `${responseTime}ms`,
    ip,
    userAgent,
    userId,
    timestamp: new Date().toISOString(),
  })
}

export const logAuthEvent = (
  event: string,
  userId?: number,
  email?: string,
  ip?: string,
  metadata?: any,
) => {
  logger.info('Authentication event', {
    event,
    userId,
    email,
    ip,
    ...metadata,
    timestamp: new Date().toISOString(),
  })
}

export const logSecurityEvent = (
  event: string,
  severity: 'low' | 'medium' | 'high',
  details: any,
) => {
  const logData = {
    event,
    severity,
    ...details,
    timestamp: new Date().toISOString(),
  }

  if (severity === 'high') {
    logger.error('Security event - HIGH SEVERITY', logData)
  } else if (severity === 'medium') {
    logger.warn('Security event - MEDIUM SEVERITY', logData)
  } else {
    logger.info('Security event - LOW SEVERITY', logData)
  }
}

export const logDatabaseQuery = (query: string, duration: number, success: boolean) => {
  if (process.env.LOG_DATABASE_QUERIES === 'true') {
    logger.debug('Database query', {
      query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
      duration: `${duration}ms`,
      success,
      timestamp: new Date().toISOString(),
    })
  }
}

export const logEmailEvent = (event: string, email: string, success: boolean, metadata?: any) => {
  logger.info('Email event', {
    event,
    email,
    success,
    ...metadata,
    timestamp: new Date().toISOString(),
  })
}

export const logRateLimitEvent = (identifier: string, endpoint: string, metadata?: any) => {
  logger.warn('Rate limit exceeded', {
    identifier,
    endpoint,
    ...metadata,
    timestamp: new Date().toISOString(),
  })
}

// Performance monitoring
export const logPerformanceMetric = (
  metric: string,
  value: number,
  unit: string,
  metadata?: any,
) => {
  logger.info('Performance metric', {
    metric,
    value,
    unit,
    ...metadata,
    timestamp: new Date().toISOString(),
  })
}

// Business logic events
export const logBusinessEvent = (
  event: string,
  entity: string,
  entityId?: number | string,
  metadata?: any,
) => {
  logger.info('Business event', {
    event,
    entity,
    entityId,
    ...metadata,
    timestamp: new Date().toISOString(),
  })
}

export default logger
