import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
}

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
}

// Add colors to winston
winston.addColors(colors)

// Define the format for logs
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`),
)

// Define which transports the logger must use
const transports = [
  // Console transport for development
  new winston.transports.Console(),

  // File transport for all logs
  new DailyRotateFile({
    filename: 'logs/shared-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
  }),

  // Separate file for errors
  new DailyRotateFile({
    filename: 'logs/shared-error-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxSize: '20m',
    maxFiles: '14d',
  }),
]

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format,
  transports,
})

// Export logger functions for backward compatibility
export const logBusinessEvent = (event: string, details: any) => {
  logger.info(`Business Event: ${event}`, { event, details })
}

export const logSecurityEvent = (event: string, details: any, userId?: string) => {
  logger.warn(`Security Event: ${event}`, { event, details, userId })
}

export const logError = (error: Error, context?: string) => {
  logger.error(`Error${context ? ` in ${context}` : ''}: ${error.message}`, {
    error: error.message,
    stack: error.stack,
    context,
  })
}

export default logger
