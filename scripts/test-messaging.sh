#!/bin/bash

# Test Messaging Script for VideaMozi Microservices
# This script tests the RabbitMQ messaging system between services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if RabbitMQ is running
check_rabbitmq() {
    log_info "Checking RabbitMQ status..."
    if ! docker ps | grep -q rabbitmq; then
        log_error "RabbitMQ is not running. Please start the services first:"
        echo "  ./scripts/orchestrate.sh infrastructure"
        exit 1
    fi

    # Wait for RabbitMQ to be ready
    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if docker exec $(docker ps -q --filter ancestor=rabbitmq:3.12-management-alpine) rabbitmq-diagnostics ping >/dev/null 2>&1; then
            log_success "RabbitMQ is ready!"
            return 0
        fi

        log_info "Waiting for RabbitMQ... (attempt $attempt/$max_attempts)"
        sleep 2
        ((attempt++))
    done

    log_error "RabbitMQ failed to start properly"
    exit 1
}

# Test publishing a message
test_publish_message() {
    log_info "Testing message publishing..."

    # Create a test message
    local test_message='{
        "eventId": "test-'$(date +%s)'",
        "eventType": "test.message",
        "timestamp": "'$(date -Iseconds)'",
        "source": "test-script",
        "version": "1.0",
        "data": {
            "message": "Hello from test script!",
            "timestamp": "'$(date -Iseconds)'"
        }
    }'

    # Publish to RabbitMQ using the management API
    local response=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -d "$test_message" \
        http://guest:guest@localhost:15672/api/exchanges/%2f/videamozi-events/publish)

    if [ "$response" = "200" ]; then
        log_success "Message published successfully"
    else
        log_error "Failed to publish message (HTTP $response)"
        return 1
    fi
}

# Test creating a queue and binding
test_queue_binding() {
    log_info "Testing queue creation and binding..."

    # Create a test queue
    local response=$(curl -s -o /dev/null -w "%{http_code}" \
        -X PUT \
        -H "Content-Type: application/json" \
        -d '{"durable": true}' \
        http://guest:guest@localhost:15672/api/queues/%2f/test-queue)

    if [ "$response" = "201" ] || [ "$response" = "204" ]; then
        log_success "Test queue created"
    else
        log_error "Failed to create test queue (HTTP $response)"
        return 1
    fi

    # Bind queue to exchange
    response=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -d '{"routing_key": "test-service"}' \
        http://guest:guest@localhost:15672/api/bindings/%2f/e/videamozi-events/q/test-queue)

    if [ "$response" = "201" ]; then
        log_success "Queue bound to exchange"
    else
        log_error "Failed to bind queue (HTTP $response)"
        return 1
    fi
}

# Test consuming messages
test_consume_message() {
    log_info "Testing message consumption..."

    # Publish a test message to our test queue
    local test_message='{
        "properties": {},
        "routing_key": "test-service",
        "payload": "{\"message\": \"Test message\", \"timestamp\": \"'$(date -Iseconds)'\"}",
        "payload_encoding": "string"
    }'

    local response=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -d "$test_message" \
        http://guest:guest@localhost:15672/api/exchanges/%2f/videamozi-events/publish)

    if [ "$response" = "200" ]; then
        log_success "Test message published to queue"
    else
        log_error "Failed to publish test message (HTTP $response)"
        return 1
    fi

    # Check if message was received (wait a moment)
    sleep 2

    local queue_info=$(curl -s http://guest:guest@localhost:15672/api/queues/%2f/test-queue)
    local message_count=$(echo "$queue_info" | grep -o '"messages":[0-9]*' | cut -d':' -f2)

    if [ "$message_count" -gt 0 ]; then
        log_success "Message successfully received in queue ($message_count messages)"
    else
        log_warning "No messages found in queue (this might be normal if consumed quickly)"
    fi
}

# Test service-specific queues
test_service_queues() {
    log_info "Testing service-specific queues..."

    local services=("user-service" "content-service" "social-service" "moderation-service" "media-service")

    for service in "${services[@]}"; do
        local queue_name="${service}-queue"

        # Create service queue
        local response=$(curl -s -o /dev/null -w "%{http_code}" \
            -X PUT \
            -H "Content-Type: application/json" \
            -d '{"durable": true}' \
            "http://guest:guest@localhost:15672/api/queues/%2f/$queue_name")

        if [ "$response" = "201" ] || [ "$response" = "204" ]; then
            log_success "$service queue ready"
        else
            log_error "Failed to create $service queue (HTTP $response)"
        fi

        # Bind service queue to exchange
        response=$(curl -s -o /dev/null -w "%{http_code}" \
            -X POST \
            -H "Content-Type: application/json" \
            -d "{\"routing_key\": \"$service\"}" \
            "http://guest:guest@localhost:15672/api/bindings/%2f/e/videamozi-events/q/$queue_name")

        if [ "$response" = "201" ]; then
            log_success "$service queue bound to exchange"
        else
            log_error "Failed to bind $service queue (HTTP $response)"
        fi
    done
}

# Show RabbitMQ overview
show_rabbitmq_overview() {
    log_info "RabbitMQ Overview:"

    echo ""
    echo "=== Exchanges ==="
    curl -s http://guest:guest@localhost:15672/api/exchanges/%2f | jq -r '.[] | select(.name != "") | "\(.name) (\(.type))"' 2>/dev/null || echo "Install jq to see formatted output"

    echo ""
    echo "=== Queues ==="
    curl -s http://guest:guest@localhost:15672/api/queues/%2f | jq -r '.[].name' 2>/dev/null || echo "Install jq to see formatted output"

    echo ""
    echo "=== Connections ==="
    local connections=$(curl -s http://guest:guest@localhost:15672/api/connections/%2f | jq length 2>/dev/null || echo "unknown")
    echo "Active connections: $connections"

    echo ""
    echo "RabbitMQ Management UI: http://localhost:15672"
    echo "Username: guest"
    echo "Password: guest"
}

# Cleanup test resources
cleanup_test_resources() {
    log_info "Cleaning up test resources..."

    # Delete test queue
    curl -s -o /dev/null \
        -X DELETE \
        http://guest:guest@localhost:15672/api/queues/%2f/test-queue >/dev/null 2>&1

    log_success "Test resources cleaned up"
}

# Show help
show_help() {
    echo "VideaMozi Messaging Test Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  all         Run all messaging tests"
    echo "  publish     Test message publishing"
    echo "  queue       Test queue creation and binding"
    echo "  consume     Test message consumption"
    echo "  services    Set up service-specific queues"
    echo "  overview    Show RabbitMQ overview"
    echo "  cleanup     Clean up test resources"
    echo "  help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 all          # Run complete test suite"
    echo "  $0 publish      # Test message publishing only"
    echo "  $0 overview     # Show RabbitMQ status"
}

# Main command handling
main() {
    local command=${1:-"help"}

    case $command in
        "all")
            check_rabbitmq
            test_publish_message
            test_queue_binding
            test_consume_message
            test_service_queues
            show_rabbitmq_overview
            ;;
        "publish")
            check_rabbitmq
            test_publish_message
            ;;
        "queue")
            check_rabbitmq
            test_queue_binding
            ;;
        "consume")
            check_rabbitmq
            test_consume_message
            ;;
        "services")
            check_rabbitmq
            test_service_queues
            ;;
        "overview")
            check_rabbitmq
            show_rabbitmq_overview
            ;;
        "cleanup")
            cleanup_test_resources
            ;;
        "help"|*)
            show_help
            ;;
    esac
}

# Run main function with all arguments
main "$@"
