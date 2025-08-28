# Social Features Setup Guide

## ✅ Prerequisites Completed

- ✅ Database schema designed and implemented
- ✅ Controllers created for all social features
- ✅ API routes and endpoints created
- ✅ Input validation with Zod schemas
- ✅ Business logic extracted into service classes
- ✅ Database migration applied
- ✅ Prisma client generated

## 🔧 Environment Setup

### 1. Create Environment File

Since `.env` files are blocked by globalIgnore, create the environment file manually:

```bash
# Navigate to backend directory
cd app/backend

# Create .env file
touch .env
```

### 2. Configure Environment Variables

Add these variables to your `.env` file:

```bash
# Application
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3031

# Database - REQUIRED: Update with your actual database URL
DATABASE_URL="postgresql://username:password@localhost:5432/videa_mozi_dev"

# JWT Secrets - REQUIRED: Generate strong secrets
JWT_ACCESS_SECRET=your-super-secure-access-secret-key-here-make-it-very-long-and-random
JWT_REFRESH_SECRET=your-super-secure-refresh-secret-key-here-make-it-very-long-and-random
JWT_ACCESS_EXPIRE=15m
JWT_REFRESH_EXPIRE=7d

# Redis (Optional)
REDIS_URL=redis://localhost:6379

# Email (Optional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=your-email@gmail.com

# Logging
LOG_LEVEL=debug
LOG_REQUEST_BODY=true
LOG_RESPONSE_BODY=false

# Security
SESSION_SECRET=your-super-secure-session-secret-key-here
```

### 3. Database Setup

Ensure your PostgreSQL database is running and accessible. Update the `DATABASE_URL` with your actual credentials:

```bash
# Example for local PostgreSQL
DATABASE_URL="postgresql://postgres:mypassword@localhost:5432/videa_mozi_dev"
```

### 4. Generate Secure JWT Secrets

Use one of these methods to generate secure secrets:

```bash
# Using openssl
openssl rand -base64 32

# Using node
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## 🚀 Running the Application

### Start the Backend Server

```bash
# Navigate to backend directory
cd app/backend

# Install dependencies (if needed)
pnpm install

# Start development server
pnpm dev
```

The server will start on `http://localhost:3001`

### API Documentation

Once running, access the API documentation at:

- **Swagger UI**: `http://localhost:3001/api-docs`
- **Swagger JSON**: `http://localhost:3001/api-docs/swagger.json`

## 📋 Available Social Features API

### Posts

- `POST /api/v1/posts` - Create post
- `GET /api/v1/posts` - Get all posts (with filtering/pagination)
- `GET /api/v1/posts/:id` - Get single post
- `PUT /api/v1/posts/:id` - Update post
- `DELETE /api/v1/posts/:id` - Delete post
- `GET /api/v1/posts/user/:userId` - Get user's posts

### Comments

- `POST /api/v1/comments` - Create comment
- `GET /api/v1/comments` - Get all comments
- `GET /api/v1/comments/post/:postId` - Get post comments
- `PUT /api/v1/comments/:id` - Update comment
- `DELETE /api/v1/comments/:id` - Delete comment

### Likes

- `POST /api/v1/likes` - Like post/comment
- `DELETE /api/v1/likes/:id` - Unlike
- `GET /api/v1/likes/post/:postId` - Get post likes
- `GET /api/v1/likes/user/:userId` - Get user likes

### Followers

- `POST /api/v1/followers/follow` - Follow user
- `DELETE /api/v1/followers/unfollow/:id` - Unfollow user
- `GET /api/v1/followers/user/:userId/followers` - Get followers
- `GET /api/v1/followers/user/:userId/following` - Get following

### Shares

- `POST /api/v1/shares` - Share post
- `DELETE /api/v1/shares/:id` - Remove share
- `GET /api/v1/shares/post/:postId` - Get post shares

### Reports (Admin)

- `POST /api/v1/reports` - Report content
- `GET /api/v1/reports` - View reports (admin only)
- `PUT /api/v1/reports/:id` - Update report (admin only)

### Categories & Tags (Admin)

- `GET /api/v1/categories` - Get all categories
- `POST /api/v1/categories` - Create category (admin)
- `GET /api/v1/tags` - Get all tags
- `POST /api/v1/tags` - Create tag (admin)

## 🔍 Testing the API

### 1. Register a User

```bash
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123",
    "confirmPassword": "password123"
  }'
```

### 2. Login

```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### 3. Create a Post

```bash
curl -X POST http://localhost:3001/api/v1/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "title": "My First Post",
    "content": "This is my first social media post!",
    "status": "PUBLISHED"
  }'
```

## 🐛 Troubleshooting

### Database Connection Issues

- Ensure PostgreSQL is running
- Verify DATABASE_URL is correct
- Check database user permissions

### JWT Token Issues

- Ensure JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are set
- Verify token format in Authorization header: `Bearer <token>`

### Port Already in Use

- Change PORT in .env file
- Kill process using the port: `lsof -ti:3001 | xargs kill -9`

### Migration Issues

```bash
# Reset database (WARNING: This will delete all data)
pnpm prisma migrate reset

# Reapply migrations
pnpm prisma migrate dev
```

## 📚 Next Steps

1. **Frontend Integration**: Use the API endpoints in your frontend application
2. **Testing**: Run the test suite to ensure everything works
3. **Production Deployment**: Set up production environment variables
4. **Monitoring**: Configure logging and monitoring
5. **Security**: Review and enhance security measures

## 🎯 What's Been Accomplished

✅ **Complete Social Features Backend**

- Posts management with categories and tags
- Nested comments system
- Like/unlike functionality
- Follow/unfollow users
- Share posts
- Report content (moderation)
- Admin controls for categories and tags

✅ **Production-Ready Architecture**

- Comprehensive input validation
- Rate limiting and security
- Logging and monitoring
- Swagger documentation
- Database migrations
- Service layer abstraction

The social features backend is now ready for frontend integration! 🚀
