import swaggerJSDoc from 'swagger-jsdoc'
import swaggerUi from 'swagger-ui-express'

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Videa Mozi Backend API',
    version: '1.0.0',
    description: 'Authentication and User Management API for Videa Mozi',
    contact: {
      name: 'API Support',
      email: 'support@videa-mozi.com',
    },
  },
  servers: [
    {
      url: 'http://localhost:3001',
      description: 'Development server',
    },
    {
      url: 'https://api.videa-mozi.com',
      description: 'Production server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            description: 'User ID',
          },
          username: {
            type: 'string',
            description: 'Unique username',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'User email address',
          },
          roles: {
            type: 'string',
            enum: ['USER', 'ADMIN'],
            description: 'User role',
          },
          isEmailVerified: {
            type: 'boolean',
            description: 'Whether the user has verified their email',
          },
          created_at: {
            type: 'string',
            format: 'date-time',
            description: 'Account creation timestamp',
          },
          updated_at: {
            type: 'string',
            format: 'date-time',
            description: 'Last update timestamp',
          },
        },
      },
      RegisterRequest: {
        type: 'object',
        required: ['username', 'email', 'password', 'confirmPassword'],
        properties: {
          username: {
            type: 'string',
            minLength: 3,
            maxLength: 50,
            description: 'Unique username',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'Valid email address',
          },
          password: {
            type: 'string',
            minLength: 8,
            description: 'Strong password with uppercase, lowercase, number, and special character',
          },
          confirmPassword: {
            type: 'string',
            description: 'Password confirmation (must match password)',
          },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
            description: 'User email address',
          },
          password: {
            type: 'string',
            description: 'User password',
          },
        },
      },
      Tokens: {
        type: 'object',
        properties: {
          accessToken: {
            type: 'string',
            description: 'JWT access token (short-lived)',
          },
          refreshToken: {
            type: 'string',
            description: 'JWT refresh token (long-lived)',
          },
          expiresAt: {
            type: 'string',
            format: 'date-time',
            description: 'Access token expiration time',
          },
          refreshExpiresAt: {
            type: 'string',
            format: 'date-time',
            description: 'Refresh token expiration time',
          },
        },
      },
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'string',
            description: 'Error type',
          },
          message: {
            type: 'string',
            description: 'Human-readable error message',
          },
          details: {
            type: 'object',
            description: 'Additional error details (e.g., validation errors)',
          },
        },
      },
      Content: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Content UUID',
          },
          title: {
            type: 'string',
            description: 'Content title',
          },
          description: {
            type: 'string',
            description: 'Content description',
          },
          image: {
            type: 'string',
            format: 'uri',
            description: 'Content poster image URL',
          },
          trailer: {
            type: 'string',
            format: 'uri',
            description: 'Content trailer URL',
          },
          rating: {
            type: 'number',
            minimum: 0,
            maximum: 10,
            description: 'Content rating (0-10)',
          },
          releaseDate: {
            type: 'string',
            format: 'date-time',
            description: 'Release date',
          },
          genre: {
            type: 'string',
            description: 'Content genre',
          },
          type: {
            type: 'string',
            enum: ['MOVIE', 'SERIES'],
            description: 'Content type',
          },
          duration: {
            type: 'integer',
            description: 'Duration in minutes (for movies)',
          },
          language: {
            type: 'string',
            description: 'Content language',
          },
          country: {
            type: 'string',
            description: 'Content country of origin',
          },
          seasons: {
            type: 'integer',
            description: 'Number of seasons (for series)',
          },
          episodes: {
            type: 'integer',
            description: 'Total number of episodes (for series)',
          },
          episodeDuration: {
            type: 'integer',
            description: 'Average episode duration in minutes (for series)',
          },
          status: {
            type: 'string',
            enum: ['ACTIVE', 'INACTIVE', 'DELETED'],
            description: 'Content status',
          },
          isFeatured: {
            type: 'boolean',
            description: 'Whether content is featured',
          },
          isTrending: {
            type: 'boolean',
            description: 'Whether content is trending',
          },
          isNew: {
            type: 'boolean',
            description: 'Whether content is new',
          },
          isPopular: {
            type: 'boolean',
            description: 'Whether content is popular',
          },
          isTopRated: {
            type: 'boolean',
            description: 'Whether content is top-rated',
          },
          isUpcoming: {
            type: 'boolean',
            description: 'Whether content is upcoming',
          },
          isNowPlaying: {
            type: 'boolean',
            description: 'Whether content is now playing',
          },
          isComingSoon: {
            type: 'boolean',
            description: 'Whether content is coming soon',
          },
          isInTheaters: {
            type: 'boolean',
            description: 'Whether content is in theaters',
          },
          streamingPlatforms: {
            type: 'array',
            items: {
              type: 'string',
              enum: [
                'NETFLIX',
                'HULU',
                'AMAZON_PRIME',
                'HBO_MAX',
                'SHOWTIME',
                'STARZ',
                'HGTV',
                'DISCOVERY_PLUS',
                'PEACOCK',
                'APPLE_TV',
                'DISNEY_PLUS',
                'YOUTUBE',
                'OTHER',
              ],
            },
            description: 'Available streaming platforms',
          },
          createdBy: {
            type: 'integer',
            description: 'User ID who created the content',
          },
          updatedBy: {
            type: 'integer',
            description: 'User ID who last updated the content',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Creation timestamp',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Last update timestamp',
          },
          creator: {
            $ref: '#/components/schemas/User',
          },
          updater: {
            $ref: '#/components/schemas/User',
          },
          _count: {
            type: 'object',
            properties: {
              likes: {
                type: 'integer',
                description: 'Number of likes',
              },
              comments: {
                type: 'integer',
                description: 'Number of comments',
              },
              shares: {
                type: 'integer',
                description: 'Number of shares',
              },
            },
          },
        },
      },
      CreateContentRequest: {
        type: 'object',
        required: ['title', 'description', 'genre', 'type', 'language', 'country'],
        properties: {
          title: {
            type: 'string',
            maxLength: 255,
            description: 'Content title',
          },
          description: {
            type: 'string',
            maxLength: 2000,
            description: 'Content description',
          },
          image: {
            type: 'string',
            format: 'uri',
            description: 'Content poster image URL',
          },
          trailer: {
            type: 'string',
            format: 'uri',
            description: 'Content trailer URL',
          },
          rating: {
            type: 'number',
            minimum: 0,
            maximum: 10,
            description: 'Content rating (0-10)',
          },
          releaseDate: {
            type: 'string',
            format: 'date-time',
            description: 'Release date',
          },
          genre: {
            type: 'string',
            maxLength: 100,
            description: 'Content genre',
          },
          type: {
            type: 'string',
            enum: ['MOVIE', 'SERIES'],
            description: 'Content type',
          },
          duration: {
            type: 'integer',
            minimum: 1,
            description: 'Duration in minutes (for movies)',
          },
          language: {
            type: 'string',
            maxLength: 50,
            description: 'Content language',
          },
          country: {
            type: 'string',
            maxLength: 100,
            description: 'Content country of origin',
          },
          seasons: {
            type: 'integer',
            minimum: 1,
            description: 'Number of seasons (for series)',
          },
          episodes: {
            type: 'integer',
            minimum: 1,
            description: 'Total number of episodes (for series)',
          },
          episodeDuration: {
            type: 'integer',
            minimum: 1,
            description: 'Average episode duration in minutes (for series)',
          },
          isFeatured: {
            type: 'boolean',
            default: false,
            description: 'Whether content is featured',
          },
          isTrending: {
            type: 'boolean',
            default: false,
            description: 'Whether content is trending',
          },
          isNew: {
            type: 'boolean',
            default: false,
            description: 'Whether content is new',
          },
          isPopular: {
            type: 'boolean',
            default: false,
            description: 'Whether content is popular',
          },
          isTopRated: {
            type: 'boolean',
            default: false,
            description: 'Whether content is top-rated',
          },
          isUpcoming: {
            type: 'boolean',
            default: false,
            description: 'Whether content is upcoming',
          },
          isNowPlaying: {
            type: 'boolean',
            default: false,
            description: 'Whether content is now playing',
          },
          isComingSoon: {
            type: 'boolean',
            default: false,
            description: 'Whether content is coming soon',
          },
          isInTheaters: {
            type: 'boolean',
            default: false,
            description: 'Whether content is in theaters',
          },
          streamingPlatforms: {
            type: 'array',
            maxItems: 20,
            items: {
              type: 'string',
              enum: [
                'NETFLIX',
                'HULU',
                'AMAZON_PRIME',
                'HBO_MAX',
                'SHOWTIME',
                'STARZ',
                'HGTV',
                'DISCOVERY_PLUS',
                'PEACOCK',
                'APPLE_TV',
                'DISNEY_PLUS',
                'YOUTUBE',
                'OTHER',
              ],
            },
            description: 'Available streaming platforms',
          },
        },
      },
      UpdateContentRequest: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            maxLength: 255,
            description: 'Content title',
          },
          description: {
            type: 'string',
            maxLength: 2000,
            description: 'Content description',
          },
          image: {
            type: 'string',
            format: 'uri',
            description: 'Content poster image URL',
          },
          trailer: {
            type: 'string',
            format: 'uri',
            description: 'Content trailer URL',
          },
          rating: {
            type: 'number',
            minimum: 0,
            maximum: 10,
            description: 'Content rating (0-10)',
          },
          releaseDate: {
            type: 'string',
            format: 'date-time',
            description: 'Release date',
          },
          genre: {
            type: 'string',
            maxLength: 100,
            description: 'Content genre',
          },
          duration: {
            type: 'integer',
            minimum: 1,
            description: 'Duration in minutes (for movies)',
          },
          language: {
            type: 'string',
            maxLength: 50,
            description: 'Content language',
          },
          country: {
            type: 'string',
            maxLength: 100,
            description: 'Content country of origin',
          },
          seasons: {
            type: 'integer',
            minimum: 1,
            description: 'Number of seasons (for series)',
          },
          episodes: {
            type: 'integer',
            minimum: 1,
            description: 'Total number of episodes (for series)',
          },
          episodeDuration: {
            type: 'integer',
            minimum: 1,
            description: 'Average episode duration in minutes (for series)',
          },
          isFeatured: {
            type: 'boolean',
            description: 'Whether content is featured',
          },
          isTrending: {
            type: 'boolean',
            description: 'Whether content is trending',
          },
          isNew: {
            type: 'boolean',
            description: 'Whether content is new',
          },
          isPopular: {
            type: 'boolean',
            description: 'Whether content is popular',
          },
          isTopRated: {
            type: 'boolean',
            description: 'Whether content is top-rated',
          },
          isUpcoming: {
            type: 'boolean',
            description: 'Whether content is upcoming',
          },
          isNowPlaying: {
            type: 'boolean',
            description: 'Whether content is now playing',
          },
          isComingSoon: {
            type: 'boolean',
            description: 'Whether content is coming soon',
          },
          isInTheaters: {
            type: 'boolean',
            description: 'Whether content is in theaters',
          },
          streamingPlatforms: {
            type: 'array',
            maxItems: 20,
            items: {
              type: 'string',
              enum: [
                'NETFLIX',
                'HULU',
                'AMAZON_PRIME',
                'HBO_MAX',
                'SHOWTIME',
                'STARZ',
                'HGTV',
                'DISCOVERY_PLUS',
                'PEACOCK',
                'APPLE_TV',
                'DISNEY_PLUS',
                'YOUTUBE',
                'OTHER',
              ],
            },
            description: 'Available streaming platforms',
          },
        },
      },
      ContentFilters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['MOVIE', 'SERIES'],
            description: 'Content type filter',
          },
          genre: {
            type: 'string',
            description: 'Genre filter',
          },
          language: {
            type: 'string',
            description: 'Language filter',
          },
          country: {
            type: 'string',
            description: 'Country filter',
          },
          rating: {
            type: 'number',
            minimum: 0,
            maximum: 10,
            description: 'Minimum rating filter',
          },
          isFeatured: {
            type: 'boolean',
            description: 'Featured content filter',
          },
          isTrending: {
            type: 'boolean',
            description: 'Trending content filter',
          },
          isNew: {
            type: 'boolean',
            description: 'New content filter',
          },
          isPopular: {
            type: 'boolean',
            description: 'Popular content filter',
          },
          isTopRated: {
            type: 'boolean',
            description: 'Top-rated content filter',
          },
          isUpcoming: {
            type: 'boolean',
            description: 'Upcoming content filter',
          },
          isNowPlaying: {
            type: 'boolean',
            description: 'Now playing content filter',
          },
          isComingSoon: {
            type: 'boolean',
            description: 'Coming soon content filter',
          },
          isInTheaters: {
            type: 'boolean',
            description: 'In theaters content filter',
          },
          streamingPlatforms: {
            type: 'array',
            items: {
              type: 'string',
              enum: [
                'NETFLIX',
                'HULU',
                'AMAZON_PRIME',
                'HBO_MAX',
                'SHOWTIME',
                'STARZ',
                'HGTV',
                'DISCOVERY_PLUS',
                'PEACOCK',
                'APPLE_TV',
                'DISNEY_PLUS',
                'YOUTUBE',
                'OTHER',
              ],
            },
            description: 'Streaming platforms filter',
          },
          search: {
            type: 'string',
            description: 'Search query (searches title, description, genre)',
          },
          page: {
            type: 'integer',
            minimum: 1,
            default: 1,
            description: 'Page number',
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 10,
            description: 'Items per page',
          },
          sortBy: {
            type: 'string',
            default: 'createdAt',
            description: 'Sort field',
          },
          sortOrder: {
            type: 'string',
            enum: ['asc', 'desc'],
            default: 'desc',
            description: 'Sort order',
          },
        },
      },
      ContentComment: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            description: 'Comment ID',
          },
          content: {
            type: 'string',
            description: 'Comment text',
          },
          contentId: {
            type: 'string',
            format: 'uuid',
            description: 'Content UUID',
          },
          authorId: {
            type: 'integer',
            description: 'Author user ID',
          },
          parentId: {
            type: 'integer',
            description: 'Parent comment ID (for nested comments)',
          },
          imageUrl: {
            type: 'string',
            format: 'uri',
            description: 'Comment image URL',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Creation timestamp',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Last update timestamp',
          },
          author: {
            $ref: '#/components/schemas/User',
          },
          contentRef: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                format: 'uuid',
                description: 'Content UUID',
              },
              title: {
                type: 'string',
                description: 'Content title',
              },
              type: {
                type: 'string',
                enum: ['MOVIE', 'SERIES'],
                description: 'Content type',
              },
            },
          },
          _count: {
            type: 'object',
            properties: {
              likes: {
                type: 'integer',
                description: 'Number of likes',
              },
              replies: {
                type: 'integer',
                description: 'Number of replies',
              },
            },
          },
        },
      },
      ContentLike: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            description: 'Like ID',
          },
          userId: {
            type: 'integer',
            description: 'User ID who liked',
          },
          contentId: {
            type: 'string',
            format: 'uuid',
            description: 'Content UUID',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Creation timestamp',
          },
          user: {
            $ref: '#/components/schemas/User',
          },
          content: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                format: 'uuid',
                description: 'Content UUID',
              },
              title: {
                type: 'string',
                description: 'Content title',
              },
              type: {
                type: 'string',
                enum: ['MOVIE', 'SERIES'],
                description: 'Content type',
              },
            },
          },
        },
      },
      ContentShare: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            description: 'Share ID',
          },
          userId: {
            type: 'integer',
            description: 'User ID who shared',
          },
          contentId: {
            type: 'string',
            format: 'uuid',
            description: 'Content UUID',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Creation timestamp',
          },
          user: {
            $ref: '#/components/schemas/User',
          },
          content: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                format: 'uuid',
                description: 'Content UUID',
              },
              title: {
                type: 'string',
                description: 'Content title',
              },
              type: {
                type: 'string',
                enum: ['MOVIE', 'SERIES'],
                description: 'Content type',
              },
            },
          },
        },
      },
      ContentReport: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            description: 'Report ID',
          },
          reporterId: {
            type: 'integer',
            description: 'Reporter user ID',
          },
          contentId: {
            type: 'string',
            format: 'uuid',
            description: 'Content UUID',
          },
          commentId: {
            type: 'integer',
            description: 'Comment ID (if reporting a comment)',
          },
          type: {
            type: 'string',
            enum: ['SPAM', 'HARASSMENT', 'INAPPROPRIATE_CONTENT', 'COPYRIGHT_VIOLATION', 'OTHER'],
            description: 'Report type',
          },
          status: {
            type: 'string',
            enum: ['PENDING', 'REVIEWED', 'RESOLVED', 'DISMISSED'],
            description: 'Report status',
          },
          reason: {
            type: 'string',
            description: 'Report reason',
          },
          description: {
            type: 'string',
            description: 'Additional description',
          },
          reviewedBy: {
            type: 'integer',
            description: 'Reviewer user ID',
          },
          reviewedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Review timestamp',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Creation timestamp',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Last update timestamp',
          },
          reporter: {
            $ref: '#/components/schemas/User',
          },
          reviewer: {
            $ref: '#/components/schemas/User',
          },
          content: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                format: 'uuid',
                description: 'Content UUID',
              },
              title: {
                type: 'string',
                description: 'Content title',
              },
              type: {
                type: 'string',
                enum: ['MOVIE', 'SERIES'],
                description: 'Content type',
              },
            },
          },
          comment: {
            type: 'object',
            properties: {
              id: {
                type: 'integer',
                description: 'Comment ID',
              },
              content: {
                type: 'string',
                description: 'Comment text',
              },
            },
          },
        },
      },
      PaginationMeta: {
        type: 'object',
        properties: {
          page: {
            type: 'integer',
            description: 'Current page number',
          },
          limit: {
            type: 'integer',
            description: 'Items per page',
          },
          total: {
            type: 'integer',
            description: 'Total number of items',
          },
          pages: {
            type: 'integer',
            description: 'Total number of pages',
          },
        },
      },
      ContentListResponse: {
        type: 'object',
        properties: {
          content: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Content',
            },
          },
          pagination: {
            $ref: '#/components/schemas/PaginationMeta',
          },
        },
      },
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
}

const options = {
  swaggerDefinition,
  apis: ['./src/routes/*.ts', './src/routes/health.ts'], // Paths to files containing OpenAPI definitions
}

const swaggerSpec = swaggerJSDoc(options)

export { swaggerUi, swaggerSpec }
