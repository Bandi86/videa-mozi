import { ApolloServer } from 'apollo-server-express'
import { loadFilesSync } from '@graphql-tools/load-files'
import { mergeTypeDefs, mergeResolvers } from '@graphql-tools/merge'
import { makeExecutableSchema } from '@graphql-tools/schema'
import depthLimit from 'graphql-depth-limit'
import { createComplexityLimitRule } from 'graphql-validation-complexity'
import logger from '../config/logger.js'

// Load GraphQL schema files
const typesArray = loadFilesSync('./src/graphql/schemas/**/*.graphql')
const resolversArray = loadFilesSync('./src/graphql/resolvers/**/*.ts')

// Merge schemas and resolvers
const typeDefs = mergeTypeDefs(typesArray)
const resolvers = mergeResolvers(resolversArray)

// Create executable schema
const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
})

// Create Apollo Server
const apolloServer = new ApolloServer({
  schema,
  context: ({ req, res }) => ({
    req,
    res,
    user: req.user, // User from authentication middleware
  }),
  validationRules: [
    depthLimit(10), // Maximum query depth
    createComplexityLimitRule(1000, {
      // Maximum complexity
      onCost: (cost: number) => {
        logger.warn(`Query complexity cost: ${cost}`)
      },
    }),
  ],
  formatError: error => {
    logger.error('GraphQL Error:', error)

    // Don't expose internal errors in production
    if (process.env.NODE_ENV === 'production') {
      return {
        message: 'Internal server error',
        locations: error.locations,
        path: error.path,
      }
    }

    return error
  },
  introspection: process.env.NODE_ENV !== 'production', // Disable in production
  playground: process.env.NODE_ENV !== 'production', // Disable in production
})

export const initializeGraphQL = async (app: any): Promise<void> => {
  try {
    await apolloServer.start()
    apolloServer.applyMiddleware({
      app,
      path: '/graphql',
      cors: {
        origin: process.env.CORS_ORIGIN || '*',
        credentials: true,
      },
    })

    logger.info('✅ GraphQL server initialized successfully')
  } catch (error) {
    logger.error('❌ Failed to initialize GraphQL server:', error)
    throw error
  }
}

export default apolloServer
