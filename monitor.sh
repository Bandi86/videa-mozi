#!/bin/bash

# Videa Mozi Monitoring Script
# This script provides real-time monitoring of the application health and metrics

set -e

echo "📊 Videa Mozi Monitoring Dashboard"
echo "==================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}[MONITOR]${NC} $1"
}

# Check service health
check_health() {
    print_header "Checking service health..."

    # Backend health
    if curl -s -f http://localhost:3001/health > /dev/null 2>&1; then
        echo "✅ Backend: $(curl -s http://localhost:3001/health | jq -r '.status') ($(curl -s http://localhost:3001/health | jq -r '.uptime')s uptime)"
    else
        echo "❌ Backend: DOWN"
    fi

    # Database health
    if curl -s http://localhost:3001/health | jq -r '.services.database.status' 2>/dev/null | grep -q "up"; then
        echo "✅ Database: UP ($(curl -s http://localhost:3001/health | jq -r '.services.database.responseTime')ms)"
    else
        echo "❌ Database: DOWN"
    fi

    # Redis health (if available)
    if curl -s http://localhost:6379 2>/dev/null | grep -q "PONG"; then
        echo "✅ Redis: UP"
    else
        echo "⚠️  Redis: Not available"
    fi
}

# Show metrics
show_metrics() {
    print_header "Application Metrics"

    metrics=$(curl -s http://localhost:3001/health/metrics)

    echo "📈 Requests:"
    echo "   Total: $(echo $metrics | jq -r '.requests.total')"
    echo "   Successful: $(echo $metrics | jq -r '.requests.successful')"
    echo "   Failed: $(echo $metrics | jq -r '.requests.failed')"
    echo "   Avg Response Time: $(echo $metrics | jq -r '.requests.averageResponseTime | . * 100 | round / 100')ms"

    echo ""
    echo "🧠 System Resources:"
    memory_used=$(echo $metrics | jq -r '.performance.memoryUsage.used')
    memory_total=$(echo $metrics | jq -r '.performance.memoryUsage.total')
    memory_percent=$(echo $metrics | jq -r '.performance.memoryUsage.percentage')
    cpu_usage=$(echo $metrics | jq -r '.performance.cpuUsage.usage')

    echo "   Memory: ${memory_used}MB / ${memory_total}MB (${memory_percent}%)"
    echo "   CPU: ${cpu_usage}%"
    echo "   Uptime: $(echo $metrics | jq -r '.performance.uptime') seconds"
}

# Show logs
show_logs() {
    service=${2:-backend}
    lines=${3:-50}

    print_header "Recent $service logs (last $lines lines)"
    if command -v docker-compose &> /dev/null; then
        docker-compose logs --tail="$lines" "$service" 2>/dev/null || echo "Docker Compose not available or service not running"
    else
        print_warning "Docker Compose not available"
    fi
}

# Continuous monitoring
monitor_continuous() {
    print_header "Starting continuous monitoring (Ctrl+C to stop)"
    echo ""

    while true; do
        clear
        echo "📊 Videa Mozi Monitoring Dashboard - $(date)"
        echo "==============================================="
        check_health
        echo ""
        show_metrics
        echo ""
        echo "🔄 Refreshing in 10 seconds... (Ctrl+C to stop)"
        sleep 10
    done
}

# Test endpoints
test_endpoints() {
    print_header "Testing all endpoints..."

    endpoints=(
        "GET /health"
        "GET /health/live"
        "GET /health/ready"
        "GET /health/metrics"
        "GET /"
        "GET /api/v1/users"
        "GET /api-docs"
    )

    for endpoint in "${endpoints[@]}"; do
        method=$(echo $endpoint | cut -d' ' -f1)
        path=$(echo $endpoint | cut -d' ' -f2)

        if curl -s -f -X $method "http://localhost:3001$path" > /dev/null 2>&1; then
            echo "✅ $method $path"
        else
            echo "❌ $method $path"
        fi
    done
}

# Main script
case "${1:-status}" in
    "status")
        check_health
        echo ""
        show_metrics
        ;;
    "logs")
        show_logs "$@"
        ;;
    "test")
        test_endpoints
        ;;
    "continuous"|"watch")
        monitor_continuous
        ;;
    "help"|*)
        echo "Usage: $0 {status|logs|test|continuous|watch}"
        echo ""
        echo "Commands:"
        echo "  status      Show current health and metrics"
        echo "  logs        Show recent application logs"
        echo "  test        Test all endpoints"
        echo "  continuous  Continuous monitoring mode"
        echo "  watch       Alias for continuous"
        echo ""
        ;;
esac
