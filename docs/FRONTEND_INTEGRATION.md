# Frontend Integration Guide

This guide helps frontend developers integrate with the Videa Mozi Backend API.

## 🚀 Quick Start

### Base URL

- **Development**: `http://localhost:3001`
- **Production**: `https://api.videa-mozi.com`

### API Documentation

- **Swagger UI**: `http://localhost:3001/api-docs/`
- **OpenAPI JSON**: Available through Swagger UI

## 🔐 Authentication Flow

### 1. User Registration

```javascript
const response = await fetch('/api/v1/auth/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    username: 'johndoe',
    email: 'john@example.com',
    password: 'SecurePass123!',
    confirmPassword: 'SecurePass123!',
  }),
})

const data = await response.json()
if (response.ok) {
  // Registration successful - check email for verification
  console.log('Registration successful:', data)
} else {
  // Handle error
  console.error('Registration failed:', data)
}
```

### 2. Email Verification

```javascript
const response = await fetch('/api/v1/auth/verify-email', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    token: 'verification-token-from-email',
  }),
})

const data = await response.json()
// Handle response...
```

### 3. User Login

```javascript
const response = await fetch('/api/v1/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'john@example.com',
    password: 'SecurePass123!',
  }),
})

const data = await response.json()
if (response.ok) {
  // Store tokens securely (localStorage, secure cookie, etc.)
  localStorage.setItem('accessToken', data.tokens.accessToken)
  localStorage.setItem('refreshToken', data.tokens.refreshToken)

  // Set token expiration time
  const expirationTime = new Date(data.tokens.expiresAt).getTime()
  localStorage.setItem('tokenExpiration', expirationTime.toString())
} else {
  console.error('Login failed:', data)
}
```

### 4. Making Authenticated Requests

```javascript
// Helper function to get valid access token
async function getValidAccessToken() {
  const accessToken = localStorage.getItem('accessToken')
  const refreshToken = localStorage.getItem('refreshToken')
  const expirationTime = localStorage.getItem('tokenExpiration')

  // Check if token is expired or will expire in next 5 minutes
  if (!accessToken || Date.now() >= parseInt(expirationTime) - 300000) {
    // Token is expired or will expire soon, refresh it
    const refreshResponse = await fetch('/api/v1/auth/refresh-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refreshToken: refreshToken,
      }),
    })

    if (refreshResponse.ok) {
      const refreshData = await refreshResponse.json()
      localStorage.setItem('accessToken', refreshData.tokens.accessToken)
      localStorage.setItem('refreshToken', refreshData.tokens.refreshToken)
      const newExpirationTime = new Date(refreshData.tokens.expiresAt).getTime()
      localStorage.setItem('tokenExpiration', newExpirationTime.toString())
      return refreshData.tokens.accessToken
    } else {
      // Refresh failed, redirect to login
      window.location.href = '/login'
      return null
    }
  }

  return accessToken
}

// Make authenticated API call
async function apiCall(endpoint, options = {}) {
  const token = await getValidAccessToken()
  if (!token) return // Will redirect to login

  const defaultOptions = {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  }

  const finalOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  }

  return fetch(endpoint, finalOptions)
}
```

### 5. Get User Profile

```javascript
const response = await apiCall('/api/v1/auth/profile')
const userData = await response.json()
console.log('User profile:', userData.user)
```

### 6. Password Management

```javascript
// Change password (authenticated)
const response = await apiCall('/api/v1/auth/change-password', {
  method: 'POST',
  body: JSON.stringify({
    currentPassword: 'CurrentPass123!',
    newPassword: 'NewSecurePass123!',
    confirmNewPassword: 'NewSecurePass123!',
  }),
})

// Forgot password
const response = await fetch('/api/v1/auth/forgot-password', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'john@example.com',
  }),
})

// Reset password with token
const response = await fetch('/api/v1/auth/reset-password', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    token: 'reset-token-from-email',
    password: 'NewSecurePass123!',
    confirmPassword: 'NewSecurePass123!',
  }),
})
```

## 📊 Health Monitoring

### Health Check Endpoints

```javascript
// Overall health status
const health = await fetch('/health').then(r => r.json())

// Liveness probe (always returns 200 if server is running)
const live = await fetch('/health/live').then(r => r.json())

// Readiness probe (checks database, etc.)
const ready = await fetch('/health/ready').then(r => r.json())

// Detailed metrics
const metrics = await fetch('/health/metrics').then(r => r.json())

// HTML Dashboard
// Open http://localhost:3001/health/dashboard in browser
```

## 🛡️ Error Handling

All API responses follow a consistent error format:

```javascript
{
  "error": "ErrorType",
  "message": "Human readable message",
  "details": {} // Optional additional details
}
```

### Common HTTP Status Codes

- **200**: Success
- **201**: Created
- **400**: Bad Request (validation errors)
- **401**: Unauthorized (invalid/missing token)
- **403**: Forbidden (insufficient permissions)
- **404**: Not Found
- **409**: Conflict (user already exists)
- **429**: Too Many Requests (rate limited)
- **500**: Internal Server Error

## 🔧 Environment Variables

For frontend applications, you may need to configure:

```javascript
const config = {
  API_BASE_URL: process.env.REACT_APP_API_URL || 'http://localhost:3001',
  FRONTEND_URL: process.env.REACT_APP_FRONTEND_URL || 'http://localhost:3031',
}
```

## 📚 API Endpoints Summary

### Authentication

- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/logout` - Logout user
- `POST /api/v1/auth/refresh-token` - Refresh access token
- `POST /api/v1/auth/verify-email` - Verify email address
- `POST /api/v1/auth/forgot-password` - Request password reset
- `POST /api/v1/auth/reset-password` - Reset password
- `POST /api/v1/auth/change-password` - Change password (authenticated)
- `GET /api/v1/auth/profile` - Get user profile (authenticated)

### Users

- `GET /api/v1/users` - Get all users (admin only)

### Health & Monitoring

- `GET /health` - Overall health status
- `GET /health/live` - Liveness probe
- `GET /health/ready` - Readiness probe
- `GET /health/metrics` - Application metrics
- `GET /health/dashboard` - HTML dashboard

### Documentation

- `GET /api-docs/` - Swagger UI
- `GET /` - API info

## 🚀 Production Deployment

When deploying to production:

1. Update API base URLs in your frontend configuration
2. Use HTTPS endpoints
3. Implement proper token storage (httpOnly cookies recommended)
4. Handle token refresh automatically
5. Implement proper error boundaries
6. Add loading states for better UX
7. Consider implementing request interceptors for authentication

## 📞 Support

- **API Documentation**: Visit `/api-docs/` for interactive API explorer
- **Health Dashboard**: Visit `/health/dashboard` for real-time monitoring
- **Logs**: Check application logs for detailed error information

---

**Happy coding! 🎉**
