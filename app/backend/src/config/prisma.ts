import { PrismaClient } from '../../generated/prisma/client.js'
import { withAccelerate } from '@prisma/extension-accelerate'

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  //extensions: [withAccelerate()],
})

URL

export default prisma
