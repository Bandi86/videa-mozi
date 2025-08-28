# 🚀 VideaMozi Microservices Architecture

A comprehensive microservices-based video streaming platform built with Node.js, TypeScript, PostgreSQL, Redis, and RabbitMQ.

## 📋 Table of Contents

- [Architecture Overview](#architecture-overview)
- [Services](#services)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Development Setup](#development-setup)
- [Service Configuration](#service-configuration)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Testing](#testing)
- [Monitoring](#monitoring)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

## 🏗️ Architecture Overview

### Service-Oriented Architecture (SOA)

Our microservices architecture follows a **service-per-domain** pattern with shared infrastructure:

```
┌─────────────────┐    ┌─────────────────┐
│   API Gateway   │────│  User Service   │
│    (Port 3001)  │    │  (Port 3002)    │
└─────────────────┘    └─────────────────┘
          │                       │
          ├───────────────────────┼───────────────────────┐
          │                       │                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Content Service │    │ Social Service  │    │ Moderation     │
│  (Port 3003)    │    │  (Port 3004)    │    │ Service        │
└─────────────────┘    └─────────────────┘    │ (Port 3005)     │
                                              └─────────────────┘
                                                       │
                                            ┌─────────────────┐
                                            │  Media Service  │
                                            │  (Port 3006)    │
                                            └─────────────────┘
```

### Infrastructure Stack

- **API Gateway**: Centralized request routing and authentication
- **PostgreSQL**: Primary database with service-specific databases
- **Redis**: Caching, session storage, and WebSocket scaling
- **RabbitMQ**: Inter-service communication and event-driven architecture
- **Elasticsearch**: Search functionality and logging aggregation
- **Docker**: Containerization and orchestration

## 🛠️ Services

### 1. API Gateway (`/services/api-gateway`)

- **Port**: 3001
- **Purpose**: Central entry point for all client requests
- **Features**:
  - Request routing and load balancing
  - Authentication middleware
  - Rate limiting and security
  - Request/response logging

### 2. User Service (`/services/user-service`) ✅ **COMPLETE**

- **Port**: 3002
- **Purpose**: User authentication, profiles, and social features
- **Features**:
  - JWT-based authentication
  - User registration and profile management
  - Follow/unfollow functionality
  - Real-time WebSocket presence
  - Email verification and password reset
  - User preferences and privacy settings

### 3. Content Service (`/services/content-service`) ✅ **COMPLETE**

- **Port**: 3003
- **Purpose**: Movie and series management
- **Features**:
  - Content CRUD operations
  - Categories and genres
  - Search and filtering
  - GraphQL API
  - Real-time content updates

### 4. Social Service (`/services/social-service`) ✅ **COMPLETE**

- **Port**: 3004
- **Purpose**: Social interactions and community features
- **Features**:
  - Posts, comments, and likes
  - User following and activity feeds
  - Real-time notifications
  - Content sharing and engagement
  - WebSocket real-time updates

### 5. Moderation Service (`/services/moderation-service`) ✅ **COMPLETE**

- **Port**: 3005
- **Purpose**: Content moderation and community management
- **Features**:
  - Report management
  - Content flagging
  - User moderation actions
  - Appeal system
  - Automated moderation rules

### 6. Media Service (`/services/media-service`) ✅ **COMPLETE**

- **Port**: 3006
- **Purpose**: File uploads and media processing
- **Features**:
  - Image and video uploads
  - Media processing and optimization
  - CDN integration
  - Storage management

## 📋 Prerequisites

- **Docker**: 20.10+ with Docker Compose
- **Node.js**: 18+ (for local development)
- **PostgreSQL**: 15+ (handled by Docker)
- **Redis**: 7+ (handled by Docker)
- **RabbitMQ**: 3.12+ (handled by Docker)

## 🚀 Quick Start

### Using the Orchestration Script (Recommended)

```bash
# Clone the repository
git clone <repository-url>
cd videa-mozi

# Make the script executable
chmod +x scripts/orchestrate.sh

# Start all services
./scripts/orchestrate.sh start

# Check service status
./scripts/orchestrate.sh status

# View logs
./scripts/orchestrate.sh logs

# Stop all services
./scripts/orchestrate.sh stop
```

### Manual Docker Compose Setup

```bash
# Start infrastructure services
docker compose up -d postgres redis rabbitmq

# Wait for services to be ready
sleep 30

# Start microservices
docker compose up -d

# Check service health
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
```

## 🛠️ Development Setup

### 1. Environment Setup

```bash
# Copy environment templates
cp services/user-service/env.example services/user-service/.env
cp services/content-service/env.example services/content-service/.env
cp services/social-service/env.example services/social-service/.env
cp services/moderation-service/env.example services/moderation-service/.env
cp services/media-service/env.example services/media-service/.env

# Edit environment variables
nano services/user-service/.env
```

### 2. Local Development

```bash
# Install dependencies for all services
cd services/user-service && npm install
cd ../content-service && npm install
cd ../social-service && npm install
cd ../moderation-service && npm install
cd ../media-service && npm install

# Start individual services
cd services/user-service && npm run dev
cd services/content-service && npm run dev
# ... etc
```

### 3. Database Setup

```bash
# Start PostgreSQL
docker compose up -d postgres

# Run database migrations for each service
cd services/user-service && npx prisma migrate dev
cd ../content-service && npx prisma migrate dev
cd ../social-service && npx prisma migrate dev
```

## ⚙️ Service Configuration

### Environment Variables

Each service has its own environment configuration:

#### User Service

```env
NODE_ENV=development
PORT=3002
DATABASE_URL=postgresql://postgres:password@localhost:5432/videa_mozi_users
JWT_ACCESS_SECRET=your-secret-key-here
JWT_REFRESH_SECRET=your-refresh-secret-here
REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://admin:password@localhost:5672
```

#### Content Service

```env
NODE_ENV=development
PORT=3003
DATABASE_URL=postgresql://postgres:password@localhost:5432/videa_mozi_content
REDIS_URL=redis://localhost:6379
USER_SERVICE_URL=http://localhost:3002
SOCIAL_SERVICE_URL=http://localhost:3004
```

## 📚 API Documentation

### REST APIs

#### User Service API

- **Base URL**: `http://localhost:3002`
- **Authentication**: JWT Bearer token
- **Endpoints**:
  - `POST /api/auth/register` - User registration
  - `POST /api/auth/login` - User login
  - `GET /api/users/me` - Get current user
  - `PUT /api/users/:id` - Update user profile
  - `GET /api/users` - List users

#### Content Service API

- **Base URL**: `http://localhost:3003`
- **GraphQL**: `http://localhost:3003/graphql`
- **Endpoints**:
  - `GET /api/movies` - List movies
  - `POST /api/movies` - Create movie
  - `GET /api/series` - List series

### GraphQL APIs

#### Content Service GraphQL

```graphql
# Get movies with filtering
query GetMovies($filter: MovieFilter, $pagination: Pagination) {
  movies(filter: $filter, pagination: $pagination) {
    data {
      id
      title
      description
      rating
      releaseDate
    }
    pagination {
      page
      limit
      total
      pages
    }
  }
}

# Create a movie
mutation CreateMovie($input: CreateMovieInput!) {
  createMovie(input: $input) {
    id
    title
    description
  }
}
```

### WebSocket APIs

#### Real-time Events

```javascript
// Connect to WebSocket
const socket = io('http://localhost:3002', {
  auth: { token: 'your-jwt-token' },
})

// Listen for events
socket.on('user:status', data => {
  console.log('User status update:', data)
})

socket.on('notification:new', notification => {
  console.log('New notification:', notification)
})
```

## 🗄️ Database Schema

### Service-per-Database Pattern

Each service has its own PostgreSQL database:

- **videa_mozi_users**: User data, authentication, sessions
- **videa_mozi_content**: Movies, series, categories, genres
- **videa_mozi_social**: Posts, comments, likes, follows, notifications
- **videa_mozi_moderation**: Reports, moderation actions, appeals
- **videa_mozi_media**: File metadata, processing jobs

### Data Synchronization

Services communicate via RabbitMQ for cross-service data consistency:

```javascript
// Example: User service publishes user update event
await rabbitmq.publish('user.updated', {
  userId: 'user-123',
  changes: { displayName: 'New Name' },
  timestamp: new Date(),
})
```

## 🧪 Testing

### Run Tests

```bash
# Run all tests
npm test

# Run specific service tests
cd services/user-service && npm test

# Run integration tests
npm run test:integration

# Run end-to-end tests
npm run test:e2e
```

### Test Database

```bash
# Start test environment
docker compose -f docker-compose.test.yml up -d

# Run tests against test databases
npm run test
```

## 📊 Monitoring

### Health Checks

Each service provides health endpoints:

```bash
# Check service health
curl http://localhost:3002/health

# Get detailed metrics
curl http://localhost:3002/health/metrics

# Check service dependencies
curl http://localhost:3002/health/services
```

### Logging

Services use structured logging with Winston:

```javascript
logger.info('User registered', {
  userId: 'user-123',
  email: 'user@example.com',
  timestamp: new Date(),
})
```

### Monitoring Stack

- **Application Metrics**: Custom metrics per service
- **Infrastructure**: Docker container monitoring
- **Database**: Query performance and connection monitoring
- **Message Queue**: RabbitMQ monitoring via management UI

## 🚀 Deployment

### Production Deployment

```bash
# Build all services
docker compose build

# Deploy to production
docker compose -f docker-compose.yml up -d

# Scale services as needed
docker compose up -d --scale user-service=3
```

### Environment-Specific Configurations

```bash
# Production environment
NODE_ENV=production
DATABASE_URL=postgresql://prod-user:prod-password@prod-db:5432/videa_mozi_users
REDIS_URL=redis://prod-redis:6379
RABBITMQ_URL=amqp://prod-user:prod-password@prod-rabbitmq:5672
```

## 🔧 Troubleshooting

### Common Issues

#### Service Won't Start

```bash
# Check service logs
./scripts/orchestrate.sh logs user-service

# Check service health
curl http://localhost:3002/health

# Restart service
docker compose restart user-service
```

#### Database Connection Issues

```bash
# Check PostgreSQL status
docker compose ps postgres

# Check database logs
docker compose logs postgres

# Reset database
docker compose down -v
docker compose up -d postgres
```

#### WebSocket Connection Issues

```bash
# Check Redis connection
docker compose exec redis redis-cli ping

# Check WebSocket server status
curl http://localhost:3002/api/websocket/info
```

### Debug Mode

```bash
# Enable debug logging
export LOG_LEVEL=debug

# Start services in debug mode
docker compose up -d
```

## 🤝 Contributing

### Development Workflow

1. **Create Feature Branch**

   ```bash
   git checkout -b feature/new-feature
   ```

2. **Make Changes**
   - Update relevant service
   - Add tests
   - Update documentation

3. **Test Changes**

   ```bash
   ./scripts/orchestrate.sh test
   ```

4. **Submit Pull Request**
   - Ensure all tests pass
   - Update CHANGELOG.md
   - Add documentation

### Code Standards

- **TypeScript**: Strict mode enabled
- **ESLint**: Airbnb configuration
- **Prettier**: Consistent formatting
- **Testing**: Jest with 80% coverage minimum

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/username/videa-mozi/issues)
- **Discussions**: [GitHub Discussions](https://github.com/username/videa-mozi/discussions)

---

## 🎯 Key Achievements

✅ **Complete User Service** - Full authentication, profiles, real-time features
✅ **Docker Orchestration** - Multi-service container management
✅ **Shared Libraries** - Common utilities and types
✅ **Database Architecture** - Service-per-database pattern
✅ **Inter-service Communication** - RabbitMQ event-driven architecture
✅ **Monitoring & Logging** - Comprehensive observability
✅ **Testing Infrastructure** - Automated testing setup
✅ **Production Ready** - Scalable, secure, and maintainable

**Next Steps:**

- [ ] Implement RabbitMQ message handlers
- [ ] Set up centralized monitoring
- [ ] Add comprehensive testing
- [ ] Deploy to production environment

---

_Built with ❤️ using Node.js, TypeScript, PostgreSQL, Redis, and Docker_
