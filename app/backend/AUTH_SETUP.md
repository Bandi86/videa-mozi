# 🚀 Authentication Setup Guide

## 5-Step Setup Process

### Step 1: Environment Configuration

Create a `.env` file in the backend directory with these essential variables:

```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/videa_mozi"

# JWT Security
JWT_ACCESS_SECRET="your-super-secure-access-secret-key-here"
JWT_REFRESH_SECRET="your-super-secure-refresh-secret-key-here"

# Email Service
EMAIL_USER="your-email@gmail.com"
EMAIL_PASS="your-app-password"
FRONTEND_URL="http://localhost:3031"
```

### Step 2: Database Setup

```bash
# Create PostgreSQL database
createdb videa_mozi

# Run migrations
cd app/backend
npx prisma migrate dev
npx prisma generate
```

### Step 3: Email Configuration

**For Gmail:**

1. Enable 2-factor authentication
2. Generate App Password (not regular password)
3. Use App Password in EMAIL_PASS

### Step 4: Start the Server

```bash
cd app/backend
npm run dev
```

Server will be available at: `http://localhost:3001`

### Step 5: Test Authentication Flow

```bash
# 1. Register user
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"TestPass123","confirmPassword":"TestPass123"}'

# 2. Verify email (use token from email)

# 3. Login
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123"}'

# 4. Access protected route
curl -X GET http://localhost:3001/api/v1/auth/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## 🔗 API Endpoints

### Public

- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/forgot-password` - Password reset request
- `POST /api/v1/auth/verify-email` - Email verification
- `POST /api/v1/auth/refresh-token` - Token refresh

### Protected

- `GET /api/v1/auth/profile` - User profile
- `POST /api/v1/auth/logout` - User logout
- `POST /api/v1/auth/change-password` - Password change

## 🛡️ Security Features

✅ **JWT Authentication** with access & refresh tokens
✅ **Password Hashing** with bcrypt
✅ **Rate Limiting** prevents brute force attacks
✅ **Email Verification** prevents fake accounts
✅ **Input Validation** with Zod schemas
✅ **CORS Protection** with configurable origins
✅ **Security Headers** via Helmet.js
✅ **SQL Injection Protection** via input sanitization

## ⚡ Quick Commands

```bash
# Development
npm run dev

# Production build
npm run build && npm start

# Database management
npx prisma studio
npx prisma migrate dev

# Testing
npm test
```

## 🔧 Troubleshooting

**Database Issues:** Ensure PostgreSQL is running and DATABASE_URL is correct
**Email Issues:** Check EMAIL_PASS uses Gmail App Password (not regular password)
**Token Issues:** Verify JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are set
**Port Issues:** Change PORT in .env if 3001 is occupied

---

**🎉 Setup Complete!** Your authentication system is ready for frontend integration.
