import { PrismaClient } from '@prisma/client'
import logger from './logger.js'

const prisma = new PrismaClient()

export const connectDatabase = async (): Promise<void> => {
  try {
    await prisma.$connect()
    logger.info('✅ Connected to SQLite database')

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
