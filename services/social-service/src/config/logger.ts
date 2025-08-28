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
    const service = 'Social Service'
    const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta, null, 2) : ''
    return `${timestamp} [${service}] [${level.toUpperCase()}]: ${message} ${metaStr}`
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
    filename: 'logs/social-service-error-%DATE%.log',
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
    filename: 'logs/social-service-combined-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    format,
    maxSize: '20m',
    maxFiles: '14d',
    handleExceptions: true,
    handleRejections: true,
  }),

  // Social interactions log
  new DailyRotateFile({
    filename: 'logs/social-service-interactions-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    format,
    maxSize: '20m',
    maxFiles: '30d',
    handleExceptions: false,
    handleRejections: false,
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
logger.exceptions.handle(
  new winston.transports.File({ filename: 'logs/social-service-exceptions.log' }),
)

logger.rejections.handle(
  new winston.transports.File({ filename: 'logs/social-service-rejections.log' }),
)

// Create logs directory if it doesn't exist
import { mkdirSync } from 'fs'
import { dirname } from 'path'

try {
  mkdirSync(dirname('logs/social-service-error-2024-01-01.log'), { recursive: true })
} catch (error) {
  // Directory already exists
}

// Export logger functions for business events
export const logSocialEvent = (event: string, userId: string, targetId: string, details: any) => {
  logger.info('SOCIAL_EVENT', { event, userId, targetId, ...details })
}

export const logPostEvent = (event: string, postId: string, userId: string, details: any) => {
  logger.info('POST_EVENT', { event, postId, userId, ...details })
}

export const logCommentEvent = (event: string, commentId: string, userId: string, details: any) => {
  logger.info('COMMENT_EVENT', { event, commentId, userId, ...details })
}

export const logFollowEvent = (
  event: string,
  followerId: string,
  followingId: string,
  details: any,
) => {
  logger.info('FOLLOW_EVENT', { event, followerId, followingId, ...details })
}

export default logger
