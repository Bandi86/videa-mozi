# Videa Mozi Backend

A robust Node.js/Express backend API for the Videa Mozi application with authentication, security, and database integration.

## Features

- 🔐 **Authentication & Authorization**
  - JWT-based authentication
  - Refresh token rotation
  - Role-based access control
  - Email verification

- 🛡️ **Security**
  - Helmet for security headers
  - Rate limiting
  - Input sanitization
  - SQL injection protection
  - CORS configuration
  - Brute force protection

- 📧 **Email Integration**
  - Email verification
  - Password reset
  - Notification emails

- 🗄️ **Database**
  - PostgreSQL with Prisma ORM
  - Database migrations
  - Type-safe queries

- 🧪 **Testing**
  - Jest for unit and integration tests
  - Supertest for API testing
  - Test coverage reporting

## Prerequisites

- Node.js 18+
- PostgreSQL 12+
- pnpm (recommended) or npm

## Installation

1. Install dependencies:

```bash
pnpm install
```

2. Set up the database:

```bash
# Generate Prisma client
pnpm prisma:generate

# Run migrations
pnpm prisma:migrate
```

3. Create your `.env` file based on the template:

```bash
cp .env.template .env
```

## Environment Variables

Create a `.env` file in the backend directory with the following variables:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/videa_mozi_db"

# JWT Configuration
JWT_ACCESS_SECRET="your-super-secret-access-key-change-this-in-production"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-change-this-in-production"
JWT_ACCESS_EXPIRE="15m"
JWT_REFRESH_EXPIRE="7d"

# Server Configuration
PORT=3001
NODE_ENV="development"
DEBUG="false"

# Frontend URL (for CORS and email links)
FRONTEND_URL="http://localhost:3031"

# Email Configuration
EMAIL_HOST="smtp.gmail.com"
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER="your-email@gmail.com"
EMAIL_PASS="your-app-password"

# Security
API_KEY="your-optional-api-key"
```

## Development

```bash
# Start development server with hot reload
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

## Testing

```bash
# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run tests in watch mode
pnpm test:watch
```

## API Endpoints

### Authentication

- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login user
- `POST /api/v1/auth/logout` - Logout user
- `POST /api/v1/auth/refresh-token` - Refresh access token
- `POST /api/v1/auth/forgot-password` - Request password reset
- `POST /api/v1/auth/reset-password` - Reset password
- `POST /api/v1/auth/verify-email` - Verify email address
- `POST /api/v1/auth/change-password` - Change password (authenticated)
- `GET /api/v1/auth/profile` - Get user profile (authenticated)

### Users

- `GET /api/v1/users` - Get all users (admin only)
- Other user endpoints to be implemented

## Project Structure

```
src/
├── config/          # Database and configuration
├── controllers/     # Route handlers
├── middlewares/     # Express middlewares
├── routes/          # API routes
├── services/        # Business logic
├── utils/           # Utility functions
├── validators/      # Input validation schemas
└── types/           # TypeScript type definitions

tests/               # Test files
├── controllers/
├── middlewares/
├── services/
└── utils/
```

## Security Features

- **Helmet**: Security headers
- **Rate Limiting**: Prevents abuse with configurable limits
- **Input Validation**: Zod schemas for all inputs
- **SQL Injection Protection**: Basic pattern matching
- **Brute Force Protection**: IP-based blocking
- **CORS**: Configured for frontend origin
- **Password Hashing**: bcrypt with salt rounds
- **JWT Tokens**: Secure token-based authentication

## Database Schema

The application uses two main models:

- **Users**: User accounts with email verification
- **Auth**: JWT tokens and authentication data

Run `pnpm prisma:studio` to view and manage your database.

## Contributing

1. Follow the existing code style
2. Add tests for new features
3. Update documentation as needed
4. Ensure all tests pass before submitting

## License

ISC
