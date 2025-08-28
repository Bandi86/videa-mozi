import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
}

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
}

// Add colors to winston
winston.addColors(colors)

// Define the format for logs
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta, null, 2) : ''
    return `${timestamp} [${level.toUpperCase()}]: ${message} ${metaStr}`
  }),
)

// Define transports
const transports = [
  // Console transport for development
  new winston.transports.Console({
    level: process.env.LOG_LEVEL || 'debug',
    format: winston.format.combine(winston.format.colorize({ all: true }), format),
    handleExceptions: true,
    handleRejections: true,
  }),

  // Error log file
  new DailyRotateFile({
    filename: 'logs/error-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    format,
    maxSize: '20m',
    maxFiles: '14d',
    handleExceptions: true,
    handleRejections: true,
  }),

  // Combined log file
  new DailyRotateFile({
    filename: 'logs/combined-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    format,
    maxSize: '20m',
    maxFiles: '14d',
    handleExceptions: true,
    handleRejections: true,
  }),

  // Security events log
  new DailyRotateFile({
    filename: 'logs/security-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    format,
    maxSize: '20m',
    maxFiles: '30d',
    handleExceptions: false,
    handleRejections: false,
  }),

  // API Gateway specific log
  new DailyRotateFile({
    filename: 'logs/api-gateway-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    format,
    maxSize: '20m',
    maxFiles: '14d',
    handleExceptions: true,
    handleRejections: true,
  }),
]

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format,
  transports,
  exitOnError: false,
})

// Handle uncaught exceptions and unhandled rejections
logger.exceptions.handle(new winston.transports.File({ filename: 'logs/exceptions.log' }))

logger.rejections.handle(new winston.transports.File({ filename: 'logs/rejections.log' }))

// Create logs directory if it doesn't exist
import { mkdirSync } from 'fs'
import { dirname } from 'path'

try {
  mkdirSync(dirname('logs/error-2024-01-01.log'), { recursive: true })
} catch (error) {
  // Directory already exists
}

// Export logger functions for business events
export const logAuthEvent = (event: string, details: any) => {
  logger.info('AUTH_EVENT', { event, ...details })
}

export const logSecurityEvent = (
  event: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  details: any,
) => {
  const level =
    severity === 'critical' || severity === 'high'
      ? 'error'
      : severity === 'medium'
        ? 'warn'
        : 'info'

  logger.log(level, 'SECURITY_EVENT', { event, severity, ...details })
}

export const logBusinessEvent = (
  event: string,
  resource: string,
  resourceId: number | string,
  details: any,
) => {
  logger.info('BUSINESS_EVENT', { event, resource, resourceId, ...details })
}

export const logPerformanceEvent = (event: string, metric: string, value: number, details: any) => {
  logger.info('PERFORMANCE_EVENT', { event, metric, value, ...details })
}

export const logGatewayEvent = (event: string, service: string, details: any) => {
  logger.info('GATEWAY_EVENT', { event, service, ...details })
}

export default logger
