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
      service: service || 'media-service',
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
      filename: path.join(__dirname, '../../logs', 'media-service-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      level: 'info',
    }),
    new DailyRotateFile({
      filename: path.join(__dirname, '../../logs', 'media-service-error-%DATE%.log'),
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
  defaultMeta: { service: 'media-service' },
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
export const logMediaEvent = (action: string, details: any) => {
  logger.info('Media Event', {
    action,
    ...details,
    timestamp: new Date().toISOString(),
  })
}

export const logProcessingEvent = (mediaId: string, stage: string, details: any = {}) => {
  logger.info('Processing Event', {
    mediaId,
    stage,
    ...details,
    timestamp: new Date().toISOString(),
  })
}

export const logUploadEvent = (filename: string, size: number, details: any = {}) => {
  logger.info('Upload Event', {
    filename,
    size,
    ...details,
    timestamp: new Date().toISOString(),
  })
}

export const logStorageEvent = (action: string, provider: string, details: any = {}) => {
  logger.info('Storage Event', {
    action,
    provider,
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

export default logger
