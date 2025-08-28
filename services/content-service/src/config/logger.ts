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
    const service = 'Content Service'
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
    filename: 'logs/content-service-error-%DATE%.log',
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
    filename: 'logs/content-service-combined-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    format,
    maxSize: '20m',
    maxFiles: '14d',
    handleExceptions: true,
    handleRejections: true,
  }),

  // Content operations log
  new DailyRotateFile({
    filename: 'logs/content-service-operations-%DATE%.log',
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
  new winston.transports.File({ filename: 'logs/content-service-exceptions.log' }),
)

logger.rejections.handle(
  new winston.transports.File({ filename: 'logs/content-service-rejections.log' }),
)

// Create logs directory if it doesn't exist
import { mkdirSync } from 'fs'
import { dirname } from 'path'

try {
  mkdirSync(dirname('logs/content-service-error-2024-01-01.log'), { recursive: true })
} catch (error) {
  // Directory already exists
}

// Export logger functions for business events
export const logContentEvent = (
  event: string,
  contentType: string,
  contentId: string,
  details: any,
) => {
  logger.info('CONTENT_EVENT', { event, contentType, contentId, ...details })
}

export const logCategoryEvent = (event: string, categoryId: string, details: any) => {
  logger.info('CATEGORY_EVENT', { event, categoryId, ...details })
}

export const logSearchEvent = (event: string, query: string, results: number, details: any) => {
  logger.info('SEARCH_EVENT', { event, query, results, ...details })
}

export default logger
