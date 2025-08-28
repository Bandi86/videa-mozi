import swaggerJSDoc from 'swagger-jsdoc'
import swaggerUi from 'swagger-ui-express'

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Content Service API',
    version: '1.0.0',
    description: `
# Content Service API

The Content Service manages all content-related operations for the Videa Mozi platform:

## Features

- **Movie Management** - Create, update, delete, and search movies
- **Series Management** - Manage TV series with seasons and episodes
- **Category Management** - Organize content with categories and genres
- **Search & Discovery** - Advanced search and recommendation features
- **Content Analytics** - Popularity tracking and analytics
- **GraphQL API** - Flexible query and mutation capabilities
- **REST API** - Traditional endpoint-based access
- **WebSocket API** - Real-time communication and live updates

## Content Types

- **Movies**: Feature films with metadata, ratings, and media
- **Series**: TV shows with seasons, episodes, and detailed information
- **Categories**: Content organization and classification
- **Genres**: Content genre classification and tagging

## Authentication

All write operations (POST, PUT, DELETE) require authentication:

\`\`\`
Authorization: Bearer <your-jwt-token>
\`\`\`

## GraphQL API

The Content Service provides both REST and GraphQL APIs:

### GraphQL Endpoint
\`\`\`
POST http://localhost:3003/graphql
\`\`\`

### GraphQL Playground (Development)
\`\`\`
🌐 http://localhost:3003/graphql
\`\`\`

### Example GraphQL Query
\`\`\`graphql
query GetFeaturedMovies {
  featuredMovies(limit: 5) {
    id
    title
    rating
    posterUrl
    categories {
      name
    }
  }
}
\`\`\`

## WebSocket API

The Content Service provides real-time communication through WebSocket connections:

### WebSocket Endpoint
\`\`\`
ws://localhost:3003
\`\`\`

### Connection
\`\`\`javascript
import io from 'socket.io-client'

// Connect with authentication
const socket = io('ws://localhost:3003', {
  auth: {
    token: 'your-jwt-token' // Optional, anonymous connections allowed
  }
})
\`\`\`

### Example WebSocket Events
\`\`\`javascript
// Join movie room for real-time updates
socket.emit('movie:join', 'movie-123')

// Rate a movie
socket.emit('movie:rate', {
  movieId: 'movie-123',
  rating: 9
})

// Listen for rating updates
socket.on('movie:rating:updated', (data) => {
  console.log('Movie rating updated:', data)
})

// Search content in real-time
socket.emit('content:search', 'action movies')

socket.on('content:search:results', (results) => {
  console.log('Search results:', results)
})
\`\`\`

## Response Format

All responses follow a consistent format:

**Success Response:**
\`\`\`json
{
  "message": "Operation successful",
  "data": { ... },
  "movie": { ... },
  "pagination": { ... }
}
\`\`\`

**Error Response:**
\`\`\`json
{
  "error": "Error type",
  "message": "Detailed error message",
  "details": [ ... ]
}
\`\`\`

## Content Status

- **DRAFT**: Content in creation/editing
- **IN_PRODUCTION**: Content being produced
- **POST_PRODUCTION**: Content in post-production
- **RELEASED**: Content available to users
- **CANCELLED**: Content cancelled

## Rating System

Movies and series use a 1-10 rating system with vote counting for community feedback.

## Search & Filtering

Advanced search supports:
- Text search across titles, descriptions, cast, directors
- Genre filtering
- Category filtering
- Date range filtering
- Rating and popularity sorting
- Featured content filtering
    `,
    contact: {
      name: 'Content Service API Support',
      email: 'api-support@videa-mozi.com',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: 'http://localhost:3003',
      description: 'Development server',
    },
    {
      url: 'http://localhost:3003/graphql',
      description: 'GraphQL API Endpoint',
    },
    {
      url: 'ws://localhost:3003',
      description: 'WebSocket Real-time API',
    },
    {
      url: 'https://content-service.videa-mozi.com',
      description: 'Production server',
    },
    {
      url: 'https://content-service.videa-mozi.com/graphql',
      description: 'Production GraphQL API',
    },
    {
      url: 'wss://content-service.videa-mozi.com',
      description: 'Production WebSocket API',
    },
  ],
  security: [
    {
      bearerAuth: [],
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token obtained from authentication endpoints',
      },
    },
    schemas: {
      // Common schemas
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'string',
            description: 'Error type identifier',
          },
          message: {
            type: 'string',
            description: 'Human-readable error message',
          },
          details: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Additional error details',
          },
        },
        required: ['error', 'message'],
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
        required: ['page', 'limit', 'total', 'pages'],
      },
      Movie: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Movie unique identifier',
          },
          title: {
            type: 'string',
            description: 'Movie title',
          },
          description: {
            type: 'string',
            description: 'Movie description',
          },
          releaseDate: {
            type: 'string',
            format: 'date',
            description: 'Movie release date',
          },
          duration: {
            type: 'integer',
            description: 'Movie duration in minutes',
          },
          language: {
            type: 'string',
            description: 'Movie language (ISO 639-1)',
          },
          country: {
            type: 'string',
            description: 'Movie production country (ISO 3166-1)',
          },
          posterUrl: {
            type: 'string',
            format: 'uri',
            description: 'Movie poster image URL',
          },
          backdropUrl: {
            type: 'string',
            format: 'uri',
            description: 'Movie backdrop image URL',
          },
          trailerUrl: {
            type: 'string',
            format: 'uri',
            description: 'Movie trailer video URL',
          },
          videoUrl: {
            type: 'string',
            format: 'uri',
            description: 'Movie full video URL',
          },
          rating: {
            type: 'number',
            minimum: 0,
            maximum: 10,
            description: 'Movie average rating',
          },
          voteCount: {
            type: 'integer',
            description: 'Number of votes',
          },
          popularity: {
            type: 'number',
            description: 'Movie popularity score',
          },
          genre: {
            type: 'string',
            description: 'Movie genre',
          },
          director: {
            type: 'string',
            description: 'Movie director',
          },
          cast: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Movie cast members',
          },
          productionCompany: {
            type: 'string',
            description: 'Production company',
          },
          isAdult: {
            type: 'boolean',
            description: 'Adult content flag',
          },
          isFeatured: {
            type: 'boolean',
            description: 'Featured content flag',
          },
          status: {
            type: 'string',
            enum: ['DRAFT', 'IN_PRODUCTION', 'POST_PRODUCTION', 'RELEASED', 'CANCELLED'],
            description: 'Movie production status',
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
          categories: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Category',
            },
            description: 'Movie categories',
          },
        },
        required: ['id', 'title', 'status'],
      },
      Series: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Series unique identifier',
          },
          title: {
            type: 'string',
            description: 'Series title',
          },
          description: {
            type: 'string',
            description: 'Series description',
          },
          firstAirDate: {
            type: 'string',
            format: 'date',
            description: 'Series first air date',
          },
          lastAirDate: {
            type: 'string',
            format: 'date',
            description: 'Series last air date',
          },
          language: {
            type: 'string',
            description: 'Series language (ISO 639-1)',
          },
          country: {
            type: 'string',
            description: 'Series production country (ISO 3166-1)',
          },
          posterUrl: {
            type: 'string',
            format: 'uri',
            description: 'Series poster image URL',
          },
          backdropUrl: {
            type: 'string',
            format: 'uri',
            description: 'Series backdrop image URL',
          },
          trailerUrl: {
            type: 'string',
            format: 'uri',
            description: 'Series trailer video URL',
          },
          rating: {
            type: 'number',
            minimum: 0,
            maximum: 10,
            description: 'Series average rating',
          },
          voteCount: {
            type: 'integer',
            description: 'Number of votes',
          },
          popularity: {
            type: 'number',
            description: 'Series popularity score',
          },
          genre: {
            type: 'string',
            description: 'Series genre',
          },
          creator: {
            type: 'string',
            description: 'Series creator',
          },
          network: {
            type: 'string',
            description: 'Broadcasting network',
          },
          productionCompany: {
            type: 'string',
            description: 'Production company',
          },
          numberOfSeasons: {
            type: 'integer',
            description: 'Total number of seasons',
          },
          numberOfEpisodes: {
            type: 'integer',
            description: 'Total number of episodes',
          },
          episodeRuntime: {
            type: 'array',
            items: {
              type: 'integer',
            },
            description: 'Episode runtime in minutes',
          },
          status: {
            type: 'string',
            enum: ['PLANNED', 'IN_PRODUCTION', 'PILOT', 'ENDED', 'CANCELLED', 'RETURNING_SERIES'],
            description: 'Series status',
          },
          isAdult: {
            type: 'boolean',
            description: 'Adult content flag',
          },
          isFeatured: {
            type: 'boolean',
            description: 'Featured content flag',
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
          categories: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Category',
            },
            description: 'Series categories',
          },
        },
        required: ['id', 'title', 'status'],
      },
      Category: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Category unique identifier',
          },
          name: {
            type: 'string',
            description: 'Category name',
          },
          description: {
            type: 'string',
            description: 'Category description',
          },
          slug: {
            type: 'string',
            description: 'URL-friendly category identifier',
          },
          type: {
            type: 'string',
            enum: ['MOVIE', 'SERIES', 'BOTH'],
            description: 'Content type this category applies to',
          },
          posterUrl: {
            type: 'string',
            format: 'uri',
            description: 'Category poster image URL',
          },
          isActive: {
            type: 'boolean',
            description: 'Category active status',
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
        },
        required: ['id', 'name', 'slug', 'type'],
      },
      CreateMovieRequest: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            minLength: 1,
            maxLength: 500,
            description: 'Movie title',
          },
          description: {
            type: 'string',
            maxLength: 2000,
            description: 'Movie description',
          },
          releaseDate: {
            type: 'string',
            format: 'date',
            description: 'Movie release date',
          },
          duration: {
            type: 'integer',
            minimum: 1,
            description: 'Movie duration in minutes',
          },
          language: {
            type: 'string',
            minLength: 2,
            maxLength: 2,
            description: 'Movie language (ISO 639-1)',
          },
          country: {
            type: 'string',
            minLength: 2,
            maxLength: 2,
            description: 'Movie production country (ISO 3166-1)',
          },
          posterUrl: {
            type: 'string',
            format: 'uri',
            description: 'Movie poster image URL',
          },
          backdropUrl: {
            type: 'string',
            format: 'uri',
            description: 'Movie backdrop image URL',
          },
          trailerUrl: {
            type: 'string',
            format: 'uri',
            description: 'Movie trailer video URL',
          },
          videoUrl: {
            type: 'string',
            format: 'uri',
            description: 'Movie full video URL',
          },
          genre: {
            type: 'string',
            description: 'Movie genre',
          },
          director: {
            type: 'string',
            description: 'Movie director',
          },
          cast: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Movie cast members',
          },
          productionCompany: {
            type: 'string',
            description: 'Production company',
          },
          isAdult: {
            type: 'boolean',
            description: 'Adult content flag',
            default: false,
          },
          isFeatured: {
            type: 'boolean',
            description: 'Featured content flag',
            default: false,
          },
          categories: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Category IDs to associate with the movie',
          },
        },
        required: ['title'],
      },
      MoviesResponse: {
        type: 'object',
        properties: {
          movies: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Movie',
            },
          },
          pagination: {
            $ref: '#/components/schemas/PaginationMeta',
          },
        },
        required: ['movies', 'pagination'],
      },
      HealthStatus: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['healthy', 'unhealthy'],
            description: 'Service health status',
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'Health check timestamp',
          },
          uptime: {
            type: 'number',
            description: 'Service uptime in seconds',
          },
          service: {
            type: 'string',
            description: 'Service name',
          },
          version: {
            type: 'string',
            description: 'Service version',
          },
          environment: {
            type: 'string',
            description: 'Environment (development/production)',
          },
          database: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['healthy', 'unhealthy'],
              },
              connectionTime: {
                type: 'number',
                description: 'Database connection time in milliseconds',
              },
            },
          },
          redis: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['healthy', 'unhealthy'],
              },
              connectionTime: {
                type: 'number',
                description: 'Redis connection time in milliseconds',
              },
            },
          },
          metrics: {
            type: 'object',
            properties: {
              totalMovies: {
                type: 'integer',
                description: 'Total number of movies',
              },
              totalSeries: {
                type: 'integer',
                description: 'Total number of series',
              },
              totalCategories: {
                type: 'integer',
                description: 'Total number of categories',
              },
              featuredMovies: {
                type: 'integer',
                description: 'Number of featured movies',
              },
            },
          },
        },
        required: ['status', 'timestamp'],
      },
    },
    responses: {
      BadRequest: {
        description: 'Bad Request',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
          },
        },
      },
      Unauthorized: {
        description: 'Unauthorized',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
          },
        },
      },
      Forbidden: {
        description: 'Forbidden',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
          },
        },
      },
      NotFound: {
        description: 'Not Found',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
          },
        },
      },
      InternalServerError: {
        description: 'Internal Server Error',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
          },
        },
      },
    },
  },
  tags: [
    {
      name: 'Movies',
      description: 'Movie management operations',
    },
    {
      name: 'Series',
      description: 'TV series management operations',
    },
    {
      name: 'Categories',
      description: 'Content category management',
    },
    {
      name: 'Health',
      description: 'Service health and monitoring',
    },
  ],
}

const options = {
  swaggerDefinition,
  apis: ['./src/routes/*.ts', './src/routes/health.ts'],
}

const swaggerSpec = swaggerJSDoc(options)

export const setupSwagger = (app: any) => {
  // Swagger UI options
  const swaggerOptions = {
    explorer: true,
    swaggerOptions: {
      url: '/api-docs/swagger.json',
      displayRequestDuration: true,
      docExpansion: 'none',
      filter: false,
      showExtensions: true,
      showCommonExtensions: true,
      syntaxHighlight: {
        activate: true,
        theme: 'arta',
      },
      tryItOutEnabled: true,
      requestInterceptor: (req: any) => {
        // Add auth token if available
        if (localStorage.getItem('authToken')) {
          req.headers.Authorization = `Bearer ${localStorage.getItem('authToken')}`
        }
        return req
      },
    },
    customCss: `
      .swagger-ui .topbar { display: none; }
      .swagger-ui .info .title { color: #667eea; }
      .swagger-ui .scheme-container { background: #f8f9fa; }
      .swagger-ui .opblock-tag { background: #667eea; color: white; }
      .swagger-ui .opblock-summary-method { background: #667eea; }
      .swagger-ui .response-col_status { color: #667eea; }
    `,
    customSiteTitle: 'Content Service API',
  }

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerOptions))

  // Serve swagger spec as JSON
  app.get('/api-docs/swagger.json', (_req: any, res: any) => {
    res.setHeader('Content-Type', 'application/json')
    res.send(swaggerSpec)
  })
}

export { swaggerUi, swaggerSpec }
