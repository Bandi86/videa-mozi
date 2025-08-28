import { PrismaClient } from '@prisma/client'
import logger from './logger.js'

const prisma = new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'query',
    },
    {
      emit: 'event',
      level: 'error',
    },
    {
      emit: 'event',
      level: 'info',
    },
    {
      emit: 'event',
      level: 'warn',
    },
  ],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
})

// Log database events
prisma.$on('query', e => {
  logger.info('Database Query', {
    query: e.query,
    params: e.params,
    duration: e.duration,
    timestamp: new Date().toISOString(),
  })
})

prisma.$on('error', e => {
  logger.error('Database Error', {
    message: e.message,
    target: e.target,
    timestamp: new Date().toISOString(),
  })
})

prisma.$on('info', e => {
  logger.info('Database Info', {
    message: e.message,
    target: e.target,
    timestamp: new Date().toISOString(),
  })
})

prisma.$on('warn', e => {
  logger.warn('Database Warning', {
    message: e.message,
    target: e.target,
    timestamp: new Date().toISOString(),
  })
})

export const connectDatabase = async (): Promise<void> => {
  try {
    await prisma.$connect()
    logger.info('✅ Connected to PostgreSQL database')

    // Test the connection
    await prisma.$queryRaw`SELECT 1`
    logger.info('✅ Database connection test successful')
  } catch (error) {
    logger.error('❌ Failed to connect to database:', error)
    throw error
  }
}

export const disconnectDatabase = async (): Promise<void> => {
  try {
    await prisma.$disconnect()
    logger.info('✅ Disconnected from database')
  } catch (error) {
    logger.error('❌ Error disconnecting from database:', error)
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  await disconnectDatabase()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await disconnectDatabase()
  process.exit(0)
})

export default prisma
