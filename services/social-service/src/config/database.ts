import { PrismaClient } from '@prisma/client'
import logger from './logger.js'

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

export const connectDatabase = async (): Promise<void> => {
  try {
    await prisma.$connect()
    logger.info('✅ Connected to database')
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

export default prisma
