import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
    return JSON.stringify({
      timestamp,
      level: level.toUpperCase(),
      service: service || 'user-service',
      message,
      ...meta,
    })
  }),
)

const transports: winston.transport[] = [
  new winston.transports.Console({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
      winston.format.printf(({ timestamp, level, message, service }) => {
        return `${timestamp} [${service}] ${level}: ${message}`
      }),
    ),
  }),
]

if (process.env.NODE_ENV === 'production') {
  transports.push(
    new DailyRotateFile({
      filename: path.join(__dirname, '../../logs', 'user-service-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      level: 'info',
    }),
    new DailyRotateFile({
      filename: path.join(__dirname, '../../logs', 'user-service-error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      level: 'error',
    }),
  )
}

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'user-service' },
  transports,
})

// Handle logger errors
logger.exceptions.handle(
  new winston.transports.Console(),
  new winston.transports.File({ filename: path.join(__dirname, '../../logs', 'exceptions.log') }),
)

logger.rejections.handle(
  new winston.transports.Console(),
  new winston.transports.File({ filename: path.join(__dirname, '../../logs', 'rejections.log') }),
)

// Specialized logging functions
export const logAuthEvent = (action: string, details: any) => {
  logger.info('Auth Event', {
    action,
    ...details,
    timestamp: new Date().toISOString(),
  })
}

export const logUserEvent = (action: string, details: any) => {
  logger.info('User Event', {
    action,
    ...details,
    timestamp: new Date().toISOString(),
  })
}

export const logSecurityEvent = (event: string, details: any) => {
  logger.warn('Security Event', {
    event,
    ...details,
    timestamp: new Date().toISOString(),
  })
}

export const logBusinessEvent = (event: string, details: any) => {
  logger.info('Business Event', {
    event,
    ...details,
    timestamp: new Date().toISOString(),
  })
}

export default logger
