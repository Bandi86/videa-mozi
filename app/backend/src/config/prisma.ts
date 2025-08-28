import { PrismaClient } from '../../generated/prisma/client/index.js'

// Environment-specific configuration
const isDevelopment = process.env.NODE_ENV === 'development'
const isProduction = process.env.NODE_ENV === 'production'

// Connection pool configuration
const getConnectionConfig = () => {
  const baseConfig = {
    url: process.env.DATABASE_URL,
  }

  // PostgreSQL-specific connection configuration
  if (process.env.DATABASE_URL?.includes('postgresql://')) {
    return {
      ...baseConfig,
      // Connection timeout in seconds
      connection_timeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '30'),
      // Pool configuration
      pool_mode: 'transaction',
      pool_size: parseInt(process.env.DB_POOL_SIZE || (isProduction ? '20' : '5')),
      max_lifetime: parseInt(process.env.DB_MAX_LIFETIME || '300'), // 5 minutes
      idle_timeout: parseInt(process.env.DB_IDLE_TIMEOUT || '60'), // 1 minute
    }
  }

  return baseConfig
}

// Enhanced Prisma configuration for production scaling
const prisma = new PrismaClient({
  log: isDevelopment ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'],

  datasources: {
    db: getConnectionConfig(),
  },

  // Transaction configuration
  transactionOptions: {
    maxWait: 5000, // 5 seconds
    timeout: 10000, // 10 seconds
  },

  // Error format for better debugging
  errorFormat: isDevelopment ? 'pretty' : 'minimal',
})

// Graceful shutdown handling
const gracefulShutdown = async () => {
  console.log('Closing Prisma client connection...')
  await prisma.$disconnect()
  console.log('Prisma client disconnected successfully')
}

// Handle process termination signals
process.on('SIGTERM', gracefulShutdown)
process.on('SIGINT', gracefulShutdown)

// Handle uncaught exceptions
process.on('uncaughtException', async error => {
  console.error('Uncaught Exception:', error)
  await gracefulShutdown()
  process.exit(1)
})

process.on('unhandledRejection', async (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  await gracefulShutdown()
  process.exit(1)
})

export default prisma
