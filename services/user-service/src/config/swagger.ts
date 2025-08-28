import swaggerJSDoc from 'swagger-jsdoc'
import swaggerUi from 'swagger-ui-express'

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'User Service API',
    version: '1.0.0',
    description: `
# User Service API

The User Service handles all user-related operations for the Videa Mozi platform:

## Features

- **User Registration** - Create new user accounts
- **Authentication** - Login, logout, token management
- **Profile Management** - Update user profiles
- **Role Management** - Admin and moderator roles
- **Security** - Password management and validation

## Authentication

All endpoints (except registration and login) require JWT authentication:

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
  "user": { ... }
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

## User Roles

- **USER** - Regular user with basic permissions
- **ADMIN** - Full administrative access
- **MODERATOR** - Content moderation capabilities

## Rate Limiting

Authentication endpoints have stricter rate limits:
- **Registration/Login**: 5 requests per 15 minutes
- **Other endpoints**: 100 requests per 15 minutes
    `,
    contact: {
      name: 'User Service API Support',
      email: 'api-support@videa-mozi.com',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: 'http://localhost:3002',
      description: 'Development server',
    },
    {
      url: 'https://user-service.videa-mozi.com',
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
          firstName: {
            type: 'string',
            description: 'User first name',
          },
          lastName: {
            type: 'string',
            description: 'User last name',
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
          updated_at: {
            type: 'string',
            format: 'date-time',
            description: 'Account last update timestamp',
          },
        },
        required: ['id', 'username', 'email', 'roles'],
      },
      UserRegistration: {
        type: 'object',
        properties: {
          username: {
            type: 'string',
            minLength: 3,
            maxLength: 20,
            description: 'Unique username (3-20 characters)',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'Valid email address',
          },
          password: {
            type: 'string',
            minLength: 6,
            description: 'Password (minimum 6 characters)',
          },
          firstName: {
            type: 'string',
            maxLength: 50,
            description: 'User first name',
          },
          lastName: {
            type: 'string',
            maxLength: 50,
            description: 'User last name',
          },
        },
        required: ['username', 'email', 'password'],
      },
      UserLogin: {
        type: 'object',
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
        required: ['email', 'password'],
      },
      Tokens: {
        type: 'object',
        properties: {
          access: {
            type: 'string',
            description: 'JWT access token',
          },
          refresh: {
            type: 'string',
            description: 'JWT refresh token',
          },
          expiresIn: {
            type: 'string',
            description: 'Access token expiration time',
          },
        },
        required: ['access', 'refresh', 'expiresIn'],
      },
      PasswordChange: {
        type: 'object',
        properties: {
          currentPassword: {
            type: 'string',
            description: 'Current password',
          },
          newPassword: {
            type: 'string',
            minLength: 6,
            description: 'New password (minimum 6 characters)',
          },
        },
        required: ['currentPassword', 'newPassword'],
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
      name: 'Authentication',
      description: 'User authentication and authorization',
    },
    {
      name: 'Users',
      description: 'User management and profiles',
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
    customSiteTitle: 'User Service API',
  }

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerOptions))

  // Serve swagger spec as JSON
  app.get('/api-docs/swagger.json', (req: any, res: any) => {
    res.setHeader('Content-Type', 'application/json')
    res.send(swaggerSpec)
  })
}

export { swaggerUi, swaggerSpec }
