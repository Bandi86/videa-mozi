import swaggerJSDoc from 'swagger-jsdoc'
import swaggerUi from 'swagger-ui-express'

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Videa Mozi Microservices API Gateway',
    version: '1.0.0',
    description: `
# Videa Mozi Microservices API

This API Gateway provides unified access to all Videa Mozi microservices:

## Services Overview

- **User Service** - Authentication, user management, and profiles
- **Content Service** - Movie and series catalog management
- **Social Service** - Posts, comments, likes, shares, and followers
- **Moderation Service** - Reports and content moderation
- **Media Service** - Image and file uploads
- **Monitoring Service** - System health and performance monitoring

## Authentication

All API endpoints (except health checks) require authentication via JWT token:

\`\`\`
Authorization: Bearer <your-jwt-token>
\`\`\`

## Response Format

All responses follow a consistent format:

**Success Response:**
\`\`\`json
{
  "message": "Operation successful",
  "data": { ... },
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

## Rate Limiting

API endpoints are rate limited:
- **Authentication**: 5 requests per 15 minutes
- **API calls**: 100 requests per 15 minutes
- **Content operations**: 10 requests per minute

## Monitoring

Real-time monitoring is available at:
- **Dashboard**: \`/health/monitoring/dashboard/html\`
- **API**: \`/health/monitoring/dashboard\`
- **Health Score**: \`/health/monitoring/health-score\`
    `,
    contact: {
      name: 'Videa Mozi API Support',
      email: 'api-support@videa-mozi.com',
      url: 'https://videa-mozi.com',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
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
            enum: ['USER', 'ADMIN', 'MODERATOR'],
            description: 'User role',
          },
          isEmailVerified: {
            type: 'boolean',
            description: 'Email verification status',
          },
          created_at: {
            type: 'string',
            format: 'date-time',
            description: 'Account creation timestamp',
          },
        },
        required: ['id', 'username', 'email', 'roles'],
      },
      HealthStatus: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['healthy', 'unhealthy', 'degraded'],
            description: 'Overall system health',
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'Health check timestamp',
          },
          uptime: {
            type: 'number',
            description: 'System uptime in seconds',
          },
          memory: {
            type: 'object',
            properties: {
              used: {
                type: 'number',
                description: 'Memory used in bytes',
              },
              total: {
                type: 'number',
                description: 'Total memory in bytes',
              },
              usage: {
                type: 'number',
                description: 'Memory usage percentage',
              },
            },
          },
          services: {
            type: 'object',
            description: 'Status of individual services',
            additionalProperties: {
              type: 'boolean',
            },
          },
        },
        required: ['status', 'timestamp'],
      },
    },
    parameters: {
      PageParam: {
        name: 'page',
        in: 'query',
        schema: {
          type: 'integer',
          minimum: 1,
          default: 1,
        },
        description: 'Page number for pagination',
      },
      LimitParam: {
        name: 'limit',
        in: 'query',
        schema: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          default: 20,
        },
        description: 'Number of items per page',
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
      name: 'Health',
      description: 'System health and monitoring endpoints',
    },
    {
      name: 'Authentication',
      description: 'User authentication and authorization',
    },
    {
      name: 'Users',
      description: 'User management and profiles',
    },
    {
      name: 'Content',
      description: 'Movie and series catalog management',
    },
    {
      name: 'Categories',
      description: 'Content categories and genres',
    },
    {
      name: 'Posts',
      description: 'Social posts and discussions',
    },
    {
      name: 'Comments',
      description: 'Comments on posts and content',
    },
    {
      name: 'Likes',
      description: 'Content and post likes',
    },
    {
      name: 'Shares',
      description: 'Content and post sharing',
    },
    {
      name: 'Followers',
      description: 'User following system',
    },
    {
      name: 'Tags',
      description: 'Content tagging system',
    },
    {
      name: 'Reports',
      description: 'Content reporting and moderation',
    },
    {
      name: 'Images',
      description: 'Image upload and management',
    },
    {
      name: 'Monitoring',
      description: 'System monitoring and analytics',
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
      responseInterceptor: (res: any) => {
        // Log responses in development
        if (process.env.NODE_ENV === 'development') {
          console.log('API Response:', res)
        }
        return res
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
    customSiteTitle: 'Videa Mozi Microservices API',
    customfavIcon: '/favicon.ico',
  }

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerOptions))

  // Serve swagger spec as JSON
  app.get('/api-docs/swagger.json', (_req: any, res: any) => {
    res.setHeader('Content-Type', 'application/json')
    res.send(swaggerSpec)
  })
}

export { swaggerUi, swaggerSpec }
