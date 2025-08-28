# Backend Middlewares Documentation

This document provides comprehensive documentation for all middleware functions implemented in the Videa Mozi backend application.

## 📋 Middleware Overview

The application uses a well-structured middleware stack organized by functionality:

### 1. **Early Middleware (Security & Infrastructure)**

- `correlationId` - Request tracking and correlation
- `securityHeaders` - Security headers via Helmet
- `cors` - Cross-origin resource sharing
- `maintenanceMode` - System maintenance handling
- `compression` - Response compression

### 2. **Logging & Monitoring**

- `httpLogger` - HTTP request/response logging
- `performanceLogger` - Performance monitoring
- `securityLogger` - Security event logging
- `collectMetrics` - Application metrics collection

### 3. **Data Processing**

- `validation` - Request validation and sanitization
- `rateLimit` - Rate limiting with Redis support
- `cache` - Response caching

### 4. **Response Formatting**

- `responseFormat` - Standard API response formatting
- `wrapLegacyResponses` - Backward compatibility

### 5. **Authentication**

- `authenticateToken` - JWT token verification
- `authorizeRoles` - Role-based access control
- `guestOnly` - Prevent authenticated users from guest routes

## 🔧 Detailed Middleware Documentation

### Correlation ID Middleware (`correlation.ts`)

**Purpose**: Provides unique request tracking across distributed systems.

**Features**:

- Generates UUID for each request
- Accepts existing correlation IDs from headers
- Adds correlation ID to response headers
- Enables request tracing across services

**Usage**:

```typescript
import { correlationId } from './middlewares/correlation.js'

app.use(correlationId)
```

**Headers**:

- `x-correlation-id`: Request correlation ID
- `x-request-id`: Alias for correlation ID

### Security Middleware (`security.ts`)

**Purpose**: Comprehensive security hardening.

**Features**:

- **Helmet**: Security headers (CSP, HSTS, XSS protection)
- **CORS**: Configurable cross-origin policies
- **SQL Injection Protection**: Pattern-based detection
- **Brute Force Protection**: Failed attempt tracking
- **Request Size Limits**: Prevent oversized payloads
- **Input Sanitization**: HTML and XSS protection

**Usage**:

```typescript
import {
  securityHeaders,
  corsOptions,
  sqlInjectionProtection,
  bruteForceProtection,
  sanitizeInput,
} from './middlewares/security.js'

// Security headers (must be first)
app.use(securityHeaders)

// CORS configuration
app.use(cors(corsOptions))

// SQL injection protection
app.use(sqlInjectionProtection)

// Brute force protection
app.use(bruteForceProtection)

// Input sanitization
app.use(sanitizeInput)
```

### Maintenance Mode Middleware (`maintenance.ts`)

**Purpose**: Graceful system maintenance handling.

**Features**:

- Enable/disable maintenance mode
- Configurable maintenance message
- Allow specific IPs during maintenance
- Preserve access to health endpoints

**Usage**:

```typescript
import { maintenanceMode, enableMaintenance } from './middlewares/maintenance.js'

app.use(maintenanceMode)

// Enable maintenance mode
enableMaintenance({
  message: 'System upgrade in progress',
  estimatedTime: '30 minutes',
  allowedIPs: ['192.168.1.100'],
})
```

### Rate Limiting Middleware (`rateLimit.ts`)

**Purpose**: Prevent abuse and ensure fair resource usage.

**Features**:

- **Redis-backed**: Distributed rate limiting
- **Multiple Strategies**: Login, password reset, email verification, general
- **Progressive Limiting**: Increases block duration with repeated violations
- **Header Support**: Rate limit status in response headers

**Usage**:

```typescript
import {
  loginRateLimit,
  generalRateLimit,
  progressiveLoginRateLimit,
} from './middlewares/rateLimit.js'

// Login rate limiting
app.use('/auth/login', loginRateLimit)

// General API rate limiting
app.use('/api', generalRateLimit)

// Progressive rate limiting
app.use('/auth/login', progressiveLoginRateLimit)
```

### Validation Middleware (`validation.ts`)

**Purpose**: Comprehensive request validation and sanitization.

**Features**:

- **Content Type Validation**: Enforce specific content types
- **Request Size Validation**: Configurable size limits
- **Schema Validation**: Zod schema support
- **Field Validation**: Email, password, URL, UUID validation
- **Required Fields**: Ensure mandatory fields are present

**Usage**:

```typescript
import {
  validateContentType,
  validateSchema,
  validateEmail,
  validatePassword,
  validateRequired,
} from './middlewares/validation.js'

// Content type validation
app.use('/api/users', validateContentType(['application/json']))

// Schema validation
app.use('/api/users', validateSchema(userSchema))

// Field validation
app.use('/auth/register', validateEmail('email'))
app.use('/auth/change-password', validatePassword('newPassword'))

// Required fields
app.use('/api/posts', validateRequired(['title', 'content']))
```

### Compression Middleware (`compression.ts`)

**Purpose**: Reduce bandwidth usage through response compression.

**Features**:

- **Gzip Compression**: Standard compression
- **Brotli Support**: Modern compression (if available)
- **Conditional Compression**: Only compress large responses
- **Threshold Configuration**: Configurable compression thresholds

**Usage**:

```typescript
import { conditionalCompression, brotliCompression } from './middlewares/compression.js'

// Conditional gzip compression (responses > 1KB)
app.use(conditionalCompression(1024))

// Brotli compression (if supported)
app.use(brotliCompression)
```

### Caching Middleware (`cache.ts`)

**Purpose**: Improve performance through response caching.

**Features**:

- **Redis Integration**: Distributed caching
- **TTL Support**: Configurable cache expiration
- **Cache Invalidation**: Pattern-based cache clearing
- **Cache Statistics**: Monitoring cache performance

**Usage**:

```typescript
import { cache, clearCache, invalidateCache } from './middlewares/cache.js'

// Cache responses for 5 minutes
app.get('/api/users', cache(300), getUsersHandler)

// Clear cache on user update
app.put('/api/users/:id', clearCache(['cache:GET:*:*users*']), updateUserHandler)

// Manual cache invalidation
await invalidateCache(['cache:GET:*:*:*'])
```

### Metrics Middleware (`metrics.ts`)

**Purpose**: Comprehensive application performance monitoring.

**Features**:

- **Request Metrics**: Count, response times, status codes
- **Error Tracking**: Error counts and types
- **System Metrics**: Memory, CPU, uptime
- **Percentiles**: P50, P95, P99 response times
- **Health Scoring**: Overall system health calculation

**Usage**:

```typescript
import { collectMetrics, metricsEndpoint, calculateHealthScore } from './middlewares/metrics.js'

// Collect metrics for all requests
app.use(collectMetrics)

// Metrics endpoint
app.get('/metrics', metricsEndpoint)

// Get health score
const healthScore = calculateHealthScore()
```

### Response Format Middleware (`responseFormat.ts`)

**Purpose**: Standardize API responses across the application.

**Features**:

- **Consistent Structure**: Standardized success/error responses
- **Pagination Support**: Built-in pagination metadata
- **Helper Methods**: `res.success()`, `res.error()`, `res.paginate()`
- **Legacy Compatibility**: Wraps existing responses

**Usage**:

```typescript
import { extendResponse, responseFormat } from './middlewares/responseFormat.js'

// Extend response object
app.use(extendResponse)

// Standard response format
app.use(responseFormat)

// In route handlers
app.get('/api/users', (req, res) => {
  // Success response
  res.success(users, { pagination: { page: 1, limit: 10 } })

  // Error response
  res.error('VALIDATION_ERROR', 'Invalid input', 400)

  // Paginated response
  res.paginate(users, page, limit, total)
})
```

### HTTP Logger Middleware (`httpLogger.ts`)

**Purpose**: Comprehensive HTTP request/response logging.

**Features**:

- **Structured Logging**: JSON format with Winston
- **Performance Monitoring**: Response time tracking
- **Request/Response Bodies**: Optional body logging
- **Error Logging**: Detailed error information
- **Slow Request Detection**: Alert on slow responses

**Usage**:

```typescript
import {
  httpLogger,
  requestBodyLogger,
  responseBodyLogger,
  performanceLogger,
} from './middlewares/httpLogger.js'

// HTTP request logging
app.use(httpLogger)

// Performance monitoring
app.use(performanceLogger)

// Request body logging (development only)
if (process.env.NODE_ENV === 'development') {
  app.use(requestBodyLogger)
  app.use(responseBodyLogger)
}
```

## 🔄 Middleware Execution Order

The middlewares are executed in this specific order for optimal security and functionality:

1. **Correlation ID** - Request tracking
2. **Security Headers** - Security hardening
3. **CORS** - Cross-origin handling
4. **Maintenance Mode** - System availability
5. **Compression** - Bandwidth optimization
6. **HTTP Logging** - Request logging
7. **Performance Monitoring** - Response time tracking
8. **Security Logging** - Security event logging
9. **Metrics Collection** - Performance metrics
10. **Body Parsing** - Request body processing
11. **Response Extension** - Helper methods
12. **Response Formatting** - Standard formatting
13. **Legacy Wrapping** - Backward compatibility

## 🚀 Best Practices

### Security

- Always use HTTPS in production
- Regularly update CORS origins
- Monitor rate limiting effectiveness
- Enable maintenance mode during deployments

### Performance

- Use Redis for rate limiting and caching in production
- Configure appropriate cache TTL values
- Monitor memory usage with metrics
- Use compression for large responses

### Monitoring

- Set up alerts for high error rates
- Monitor response time percentiles
- Track cache hit/miss ratios
- Use correlation IDs for distributed tracing

### Development

- Enable request/response body logging for debugging
- Use the metrics endpoint for performance analysis
- Test rate limiting behavior
- Validate API responses with the formatting middleware

## 🔧 Configuration

### Environment Variables

```bash
# Security
CORS_ORIGIN=https://yourdomain.com
JWT_ACCESS_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret

# Rate Limiting
REDIS_URL=redis://localhost:6379

# Logging
LOG_REQUEST_BODY=false
LOG_RESPONSE_BODY=false

# Maintenance
MAINTENANCE_MODE=false
MAINTENANCE_MESSAGE="System under maintenance"

# Compression
COMPRESSION_THRESHOLD=1024
```

### Redis Configuration

Ensure Redis is running and accessible:

```bash
# Install Redis
sudo apt-get install redis-server

# Start Redis
redis-server

# Test connection
redis-cli ping
```

## 📊 Monitoring Endpoints

- `/health` - Overall health status
- `/health/live` - Liveness probe
- `/health/ready` - Readiness probe
- `/health/metrics` - Application metrics
- `/health/dashboard` - HTML dashboard
- `/metrics` - Detailed metrics (new)

## 🆘 Troubleshooting

### Common Issues

1. **Rate Limiting Not Working**
   - Check Redis connection
   - Verify middleware order
   - Check rate limit headers in responses

2. **CORS Errors**
   - Verify allowed origins in configuration
   - Check request headers
   - Ensure preflight requests are handled

3. **Compression Not Working**
   - Check client Accept-Encoding header
   - Verify response size threshold
   - Check server logs for compression errors

4. **Metrics Not Collecting**
   - Ensure middleware is placed correctly
   - Check Redis connection for metrics storage
   - Verify endpoint paths

## 📚 Additional Resources

- [Express Middleware Documentation](https://expressjs.com/en/guide/writing-middleware.html)
- [Helmet Security Headers](https://helmetjs.github.io/)
- [Rate Limiting Best Practices](https://tools.ietf.org/html/rfc6585)
- [API Response Standards](https://jsonapi.org/)

---

**This middleware stack provides enterprise-grade security, performance, and observability for your application! 🛡️📊**
