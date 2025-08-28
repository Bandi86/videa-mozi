import { ApolloServer } from 'apollo-server-express'
import { makeExecutableSchema } from '@graphql-tools/schema'
import { loadFilesSync } from '@graphql-tools/load-files'
import { mergeResolvers } from '@graphql-tools/merge'
import path from 'path'
import { fileURLToPath } from 'url'
import { contentResolvers } from './resolvers/contentResolvers.js'
import logger from '../config/logger.js'
import { redis } from '../index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load GraphQL schema files
const typeDefs = loadFilesSync(path.join(__dirname, 'schemas'), {
  extensions: ['graphql'],
  recursive: true,
})

// Merge all resolvers
const resolvers = mergeResolvers([contentResolvers])

// Create executable schema
const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
})

// Create Apollo Server
const apolloServer = new ApolloServer({
  schema,
  context: ({ req, res }: { req: any; res: any }) => ({
    req,
    res,
    redis,
    user: req.user, // From authentication middleware
  }),
  formatError: error => {
    logger.error('GraphQL Error:', {
      message: error.message,
      locations: error.locations,
      path: error.path,
      extensions: error.extensions,
    })

    return {
      message: error.message,
      locations: error.locations || [],
      path: error.path || [],
      extensions: {
        code: error.extensions?.code || 'INTERNAL_ERROR',
        timestamp: new Date().toISOString(),
      },
    }
  },
  plugins: [
    {
      requestDidStart(requestContext) {
        const start = Date.now()
        let operationName = 'unknown'

        return {
          didResolveOperation(context: any) {
            operationName = context.operation?.operation || 'unknown'
          },
          willSendResponse(context: any) {
            const duration = Date.now() - start
            logger.info('GraphQL Operation Completed:', {
              operation: operationName,
              duration: `${duration}ms`,
              user: context.contextValue?.req?.user?.id || 'anonymous',
            })
          },
        } as any
      },
    },
  ],
  introspection: process.env.NODE_ENV !== 'production',
})

export { apolloServer }
