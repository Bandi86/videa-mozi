# 🚀 Advanced Monitoring (APM) System

## 📊 Overview

The Videa Mozi backend now includes a comprehensive **Application Performance Monitoring (APM)** system that provides real-time insights into system health, performance metrics, and error tracking.

## 🎯 Key Features

### ✅ Real-time Performance Monitoring

- **Request tracking** with response times and status codes
- **Endpoint performance analytics** grouped by route
- **Throughput monitoring** (requests per second)
- **Slow request detection** (>1s threshold)
- **Performance profiling** with detailed metrics

### ✅ System Health Monitoring

- **Memory usage** tracking and alerts
- **CPU usage** monitoring
- **Load average** tracking
- **Uptime** monitoring
- **Health score calculation** (0-100)

### ✅ Database Performance Monitoring

- **Query execution time** tracking
- **Slow query detection** (>100ms threshold)
- **Connection pool monitoring**
- **Database performance analytics**
- **Query pattern analysis**

### ✅ Error Tracking & Alerting

- **Application error monitoring**
- **Security event tracking**
- **Traffic anomaly detection**
- **Real-time alerting system**
- **Error rate calculation**

## 🌐 Available Endpoints

### 📊 Monitoring Dashboard (HTML)

```
GET /health/monitoring/dashboard/html
```

- **Interactive dashboard** with real-time metrics
- **Visual health score** display
- **Performance charts** and tables
- **Active alerts** display
- **Auto-refresh** capability

### 📈 API Endpoints

#### Main Dashboard

```
GET /health/monitoring/dashboard?hours=24
```

Returns comprehensive monitoring data including:

- System health metrics
- Performance statistics
- Database analytics
- Error summaries
- Active alerts

#### Performance Analytics

```
GET /health/monitoring/performance?hours=24
```

Returns detailed performance metrics grouped by endpoint:

- Average response time
- Error rates
- Request counts
- Success rates

#### Database Analytics

```
GET /health/monitoring/database?hours=24
```

Returns database performance metrics:

- Query execution times
- Slow query analysis
- Connection pool usage
- Query pattern statistics

#### Health Score

```
GET /health/monitoring/health-score
```

Returns overall system health score:

- Score (0-100)
- Status (excellent/good/fair/poor/critical)
- Contributing factors

## 🎨 Dashboard Features

### Visual Indicators

- **Health Score**: Large display with color-coded status
- **Status Badges**: Color-coded system status
- **Metric Cards**: Organized system, performance, database, and error metrics
- **Alert System**: Color-coded alerts with severity levels
- **Performance Tables**: Recent requests and slow queries

### Real-time Updates

- **Auto-refresh**: Optional 30-second refresh prompts
- **Manual refresh**: Button to reload dashboard
- **Timestamp display**: Shows last update time

### Navigation

- **Basic Health Dashboard**: Link to simple health view
- **API Documentation**: Direct link to Swagger docs

## 📋 Monitoring Metrics

### System Health Metrics

- **Memory Usage**: Heap used/total percentage
- **CPU Usage**: User + system time
- **System Load**: 1, 5, 15-minute averages
- **Uptime**: Server uptime in hours
- **Free Memory**: Available system memory

### Performance Metrics

- **Average Response Time**: Mean response time across all requests
- **95th/99th Percentiles**: Response time distribution
- **Total Requests**: Request count in time period
- **Error Rate**: Percentage of failed requests
- **Throughput**: Requests per second

### Database Metrics

- **Query Execution Time**: Average time per query
- **Slow Query Rate**: Percentage of slow queries
- **Connection Count**: Active database connections
- **Query Patterns**: Most common query types

### Error Metrics

- **Total Errors**: Error count in time period
- **Unique Errors**: Distinct error types
- **Most Common Error**: Most frequent error message
- **Error Rate**: Errors per unit time

## 🚨 Alert System

### Alert Types

- **Error**: Critical issues requiring immediate attention
- **Warning**: Performance issues or high resource usage
- **Info**: Informational alerts and system status

### Alert Triggers

- **High Error Rate**: >10% error rate
- **Slow Response Time**: >2000ms average response time
- **High Memory Usage**: >80% memory usage
- **High Slow Query Rate**: >20% slow queries

### Alert Severity

- **9-10**: Critical system issues
- **7-8**: High priority performance issues
- **5-6**: Medium priority warnings
- **1-4**: Low priority informational alerts

## 🛠️ Configuration

### Environment Variables

```bash
# Monitoring Settings
MONITORING_ENABLED=true
MONITORING_RETENTION_HOURS=24
SLOW_QUERY_THRESHOLD=100
SLOW_REQUEST_THRESHOLD=1000
MEMORY_ALERT_THRESHOLD=0.8
ERROR_RATE_ALERT_THRESHOLD=0.1
```

### Customization Options

- **Metrics Retention**: Configure how long to keep metrics
- **Alert Thresholds**: Adjust alert trigger levels
- **Dashboard Refresh**: Modify auto-refresh intervals
- **Performance Baselines**: Set custom performance targets

## 📊 Usage Examples

### Check System Health

```bash
curl http://localhost:3001/health/monitoring/health-score
```

### View Performance Analytics

```bash
curl http://localhost:3001/health/monitoring/performance?hours=1
```

### Monitor Database Performance

```bash
curl http://localhost:3001/health/monitoring/database?hours=24
```

### Access Visual Dashboard

```
Open in browser: http://localhost:3001/health/monitoring/dashboard/html
```

## 🔧 Integration Points

### Automatic Integration

The monitoring system is automatically integrated into:

- **Express middleware**: Tracks all HTTP requests
- **Error handlers**: Captures application errors
- **Database queries**: Monitors query performance
- **Security events**: Tracks security-related activities

### Manual Integration

For custom monitoring, you can use:

```typescript
import MonitoringService from '../services/monitoringService.js'

// Track custom metrics
MonitoringService.recordDatabaseQuery(query, executionTime)

// Record custom errors
MonitoringService.recordError(error, endpoint, method, userId)

// Start custom request tracking
const requestId = MonitoringService.startRequest(requestId, endpoint, method)
MonitoringService.endRequest(requestId, statusCode, userId)
```

## 🎯 Best Practices

### Monitoring Strategy

1. **Set Baselines**: Establish normal performance ranges
2. **Monitor Trends**: Track performance over time
3. **Set Alerts**: Configure appropriate alert thresholds
4. **Regular Review**: Check dashboard regularly for issues
5. **Performance Testing**: Use monitoring during load testing

### Alert Response

1. **Prioritize by Severity**: Address critical alerts first
2. **Investigate Root Cause**: Use detailed metrics for diagnosis
3. **Implement Fixes**: Apply performance optimizations
4. **Monitor Results**: Verify improvements with monitoring

### Maintenance

1. **Regular Cleanup**: Monitor metric storage size
2. **Adjust Thresholds**: Tune alert levels based on normal operations
3. **Update Baselines**: Adjust performance expectations over time
4. **Security Review**: Regularly review security monitoring rules

## 🚀 Production Deployment

### Scaling Considerations

- **Metrics Storage**: Consider external storage for high-traffic apps
- **Alert Integration**: Integrate with external alerting systems
- **Dashboard Access**: Secure dashboard access in production
- **Data Retention**: Configure appropriate data retention policies

### Security Best Practices

- **Access Control**: Restrict monitoring endpoints in production
- **Data Sanitization**: Ensure sensitive data is not exposed in metrics
- **Rate Limiting**: Apply rate limiting to monitoring endpoints
- **Audit Logging**: Log access to monitoring data

---

## 📈 Summary

The Advanced Monitoring (APM) system provides **enterprise-grade observability** with:

✅ **Real-time performance tracking**
✅ **System health monitoring**
✅ **Database performance analytics**
✅ **Comprehensive error tracking**
✅ **Interactive visual dashboard**
✅ **Intelligent alerting system**
✅ **Production-ready scalability**

**Access your monitoring dashboard at:** `http://localhost:3001/health/monitoring/dashboard/html`

**🎉 Your application now has professional-grade monitoring capabilities!**
