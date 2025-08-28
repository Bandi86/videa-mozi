# Horizontal Scaling Guide

This guide explains how to scale the Videa Mozi backend application for production workloads.

## 🚀 Architecture Overview

The application is designed with horizontal scaling in mind:

### Stateless Design

- **JWT Authentication**: No server-side sessions required
- **External Token Storage**: Refresh tokens stored in database
- **Shared Database**: All instances share the same database

### Scalable Components

- **Rate Limiting**: Redis-backed for distributed rate limiting
- **Caching**: Redis available for session and cache storage
- **Health Checks**: Comprehensive health monitoring
- **Load Balancing**: Ready for reverse proxy setup

## 📊 Scaling Strategies

### 1. Horizontal Scaling with Docker Compose

#### Multi-Instance Setup

```yaml
version: '3.8'
services:
  backend:
    image: videa-mozi-backend:latest
    deploy:
      replicas: 3
      restart_policy:
        condition: on-failure
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
    environment:
      - NODE_ENV=production
    depends_on:
      - postgres
      - redis

  nginx:
    image: nginx:alpine
    ports:
      - '80:80'
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - backend
```

### 2. Load Balancer Configuration

#### Nginx Upstream Configuration

```nginx
upstream backend {
    least_conn;
    server backend:3001;
    server backend:3002;
    server backend:3003;

    keepalive 32;
}

server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Health check for load balancer
        health_check interval=10s fails=3 passes=2 uri=/health/live;
    }

    # Sticky sessions (optional - for session-based features)
    # ip_hash;
}
```

### 3. Database Scaling

#### Connection Pooling

PostgreSQL handles connection pooling automatically. Configure in your connection string:

```
postgresql://user:password@host:5432/db?sslmode=require&connection_limit=10&pool_timeout=20
```

#### Read Replicas (Future Enhancement)

```yaml
services:
  postgres-primary:
    # Primary database
  postgres-replica:
    # Read replica for scaling reads
```

### 4. Redis Scaling

#### Redis Cluster (for high availability)

```yaml
services:
  redis:
    image: redis:7-alpine
    command: redis-server --cluster-enabled yes --cluster-config-file nodes.conf --cluster-node-timeout 5000
    ports:
      - '6379:6379'
      - '16379:16379'
```

### 5. Rate Limiting at Scale

The application uses Redis-backed rate limiting:

```typescript
// Automatic Redis fallback
if (process.env.REDIS_URL) {
  // Uses Redis for distributed rate limiting
} else {
  // Falls back to in-memory (single instance only)
}
```

## 📈 Monitoring & Observability

### Health Checks

- `/health` - Overall health status
- `/health/live` - Liveness probe
- `/health/ready` - Readiness probe
- `/health/metrics` - Application metrics

### Key Metrics to Monitor

- **Response Time**: Average response time per endpoint
- **Error Rate**: 4xx and 5xx error percentages
- **Database Connections**: Active connection count
- **Memory Usage**: Heap usage and garbage collection
- **Rate Limiting**: Blocked requests per minute

## 🔧 Environment Configuration

### Production Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/db?sslmode=require

# Redis (Required for scaling)
REDIS_URL=redis://redis:6379

# Application
NODE_ENV=production
PORT=3001

# Security
JWT_ACCESS_SECRET=your-secure-access-secret
JWT_REFRESH_SECRET=your-secure-refresh-secret

# CORS
FRONTEND_URL=https://yourdomain.com
```

### Instance-Specific Configuration

Each instance should have:

- Unique instance ID for logging
- Same database and Redis connection
- Same JWT secrets (for token validation across instances)

## 🚦 Deployment Strategies

### Blue-Green Deployment

```bash
# Deploy new version
docker-compose up -d backend-new

# Switch load balancer to new version
# nginx config update...

# Remove old version
docker-compose stop backend-old
docker-compose rm backend-old
```

### Rolling Update

```bash
# Update with zero downtime
docker-compose up -d --scale backend=3 --no-recreate
```

### Canary Deployment

```bash
# Deploy 1 instance of new version
docker-compose up -d --scale backend=1 backend-new

# Gradually increase traffic to new version
# Monitor metrics before full rollout
```

## 🔍 Troubleshooting Scaling Issues

### Common Issues

#### 1. Session Inconsistency

**Problem**: Users getting logged out when hitting different instances
**Solution**: Ensure Redis is properly configured for session storage

#### 2. Rate Limiting Not Working

**Problem**: Rate limits not shared across instances
**Solution**: Verify Redis connection and rate limiter configuration

#### 3. Database Connection Pool Exhausted

**Problem**: Too many database connections
**Solution**: Configure appropriate connection pool limits

#### 4. Memory Leaks

**Problem**: Memory usage increasing over time
**Solution**: Monitor heap usage, implement proper cleanup

### Monitoring Commands

```bash
# Check container resource usage
docker stats

# View application logs
docker-compose logs -f backend

# Check database connections
docker-compose exec postgres psql -U postgres -d videa_mozi -c "SELECT count(*) FROM pg_stat_activity;"

# Redis monitoring
docker-compose exec redis redis-cli info
```

## 📊 Performance Benchmarks

### Single Instance Baseline

- **Requests/second**: ~500-1000
- **Response Time**: <100ms average
- **Memory Usage**: ~50-100MB
- **Database Connections**: 2-5 active

### Scaling Expectations

- **Linear Scaling**: Performance scales with instance count
- **Database Bottleneck**: May need read replicas for >10 instances
- **Redis Performance**: Can handle 10k+ operations/second

## 🔐 Security Considerations

### Network Security

- Use internal Docker networks
- Implement proper firewall rules
- Use HTTPS termination at load balancer

### Application Security

- Same JWT secrets across all instances
- Centralized logging and monitoring
- Regular security updates

## 📚 Additional Resources

- [Docker Compose Scaling](https://docs.docker.com/compose/scale/)
- [Nginx Load Balancing](https://docs.nginx.com/nginx/admin-guide/load-balancer/)
- [Redis Clustering](https://redis.io/topics/cluster-tutorial)
- [PostgreSQL Connection Pooling](https://www.postgresql.org/docs/current/libpq-connect.html)

---

**Ready to scale! 🚀**
