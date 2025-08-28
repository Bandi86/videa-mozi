import { ApolloServer } from 'apollo-server-express'
import { makeExecutableSchema } from '@graphql-tools/schema'
import { loadFilesSync } from '@graphql-tools/load-files'
import { mergeTypeDefs } from '@graphql-tools/merge'
import path from 'path'
import { fileURLToPath } from 'url'
import logger from '../config/logger.js'

// Load GraphQL schemas
const schemas = loadFilesSync(path.join(process.cwd(), 'src/graphql/schemas'), {
  extensions: ['graphql'],
})
const typeDefs = mergeTypeDefs(schemas)

// Placeholder resolvers
const resolvers = {
  Query: {
    posts: () => [],
    post: () => null,
    userPosts: () => [],
    feed: () => [],
    comments: () => [],
    comment: () => null,
    likes: () => [],
    userLikes: () => [],
    followers: () => [],
    following: () => [],
    followStatus: () => false,
    notifications: () => [],
    unreadNotificationsCount: () => 0,
  },
  Mutation: {
    createPost: () => null,
    updatePost: () => null,
    deletePost: () => true,
    createComment: () => null,
    updateComment: () => null,
    deleteComment: () => true,
    likePost: () => null,
    unlikePost: () => true,
    likeComment: () => null,
    unlikeComment: () => true,
    sharePost: () => null,
    followUser: () => null,
    unfollowUser: () => true,
    markNotificationAsRead: () => true,
    markAllNotificationsAsRead: () => true,
  },
}

const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
})

const apolloServer = new ApolloServer({
  schema,
  context: ({ req }: any) => ({
    user: req.user,
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

// Initialize GraphQL function for compatibility
export const initializeGraphQL = async (app: any) => {
  await apolloServer.start()
  apolloServer.applyMiddleware({ app, path: '/graphql' })
}
