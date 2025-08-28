#!/bin/bash

# VideaMozi Microservices Orchestration Script
# This script helps manage all microservices in the project

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICES=("user-service" "content-service" "social-service" "moderation-service" "media-service" "api-gateway")

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

# Check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
}

# Check if docker-compose is available
check_docker_compose() {
    if ! command -v docker-compose >/dev/null 2>&1 && ! docker compose version >/dev/null 2>&1; then
        log_error "docker-compose is not installed."
        exit 1
    fi
}

# Get docker compose command
get_compose_command() {
    if docker compose version >/dev/null 2>&1; then
        echo "docker compose"
    else
        echo "docker-compose"
    fi
}

# Start all infrastructure services (database, redis, rabbitmq)
start_infrastructure() {
    log_info "Starting infrastructure services..."
    local compose_cmd=$(get_compose_command)

    $compose_cmd up -d postgres redis rabbitmq elasticsearch kibana

    log_info "Waiting for infrastructure services to be healthy..."

    # Wait for PostgreSQL
    log_info "Waiting for PostgreSQL..."
    timeout=60
    while [ $timeout -gt 0 ]; do
        if $compose_cmd exec -T postgres pg_isready -U postgres >/dev/null 2>&1; then
            log_success "PostgreSQL is ready!"
            break
        fi
        sleep 2
        timeout=$((timeout-2))
    done

    if [ $timeout -le 0 ]; then
        log_error "PostgreSQL failed to start"
        exit 1
    fi

    # Wait for Redis
    log_info "Waiting for Redis..."
    timeout=30
    while [ $timeout -gt 0 ]; do
        if $compose_cmd exec -T redis redis-cli ping >/dev/null 2>&1; then
            log_success "Redis is ready!"
            break
        fi
        sleep 2
        timeout=$((timeout-2))
    done

    if [ $timeout -le 0 ]; then
        log_error "Redis failed to start"
        exit 1
    fi

    # Wait for RabbitMQ
    log_info "Waiting for RabbitMQ..."
    timeout=60
    while [ $timeout -gt 0 ]; do
        if $compose_cmd exec -T rabbitmq rabbitmq-diagnostics ping >/dev/null 2>&1; then
            log_success "RabbitMQ is ready!"
            break
        fi
        sleep 2
        timeout=$((timeout-2))
    done

    if [ $timeout -le 0 ]; then
        log_error "RabbitMQ failed to start"
        exit 1
    fi

    log_success "Infrastructure services are ready!"
}

# Initialize databases
init_databases() {
    log_info "Initializing databases..."
    local compose_cmd=$(get_compose_command)

    # Run database initialization
    $compose_cmd exec -T postgres psql -U postgres -f /docker-entrypoint-initdb.d/init-databases.sql

    log_success "Databases initialized!"
}

# Build all services
build_services() {
    log_info "Building all services..."
    local compose_cmd=$(get_compose_command)

    for service in "${SERVICES[@]}"; do
        log_info "Building $service..."
        if [ -d "$PROJECT_ROOT/services/$service" ]; then
            cd "$PROJECT_ROOT/services/$service"
            npm install
            npm run build
            log_success "$service built successfully"
        else
            log_warning "Service $service not found, skipping..."
        fi
    done

    log_success "All services built!"
}

# Start all services
start_services() {
    log_info "Starting all services..."
    local compose_cmd=$(get_compose_command)

    $compose_cmd up -d "${SERVICES[@]}"

    log_success "All services started!"
}

# Stop all services
stop_services() {
    log_info "Stopping all services..."
    local compose_cmd=$(get_compose_command)

    $compose_cmd down

    log_success "All services stopped!"
}

# Show service status
show_status() {
    log_info "Service Status:"
    local compose_cmd=$(get_compose_command)

    $compose_cmd ps

    echo ""
    log_info "Service Health Checks:"

    # Check each service health
    for service in "${SERVICES[@]}"; do
        if $compose_cmd ps "$service" | grep -q "Up"; then
            echo -n "$service: "
            if curl -f -s "http://localhost:$(get_service_port $service)/health" >/dev/null 2>&1; then
                log_success "HEALTHY"
            else
                log_warning "RUNNING (health check failed)"
            fi
        else
            log_error "STOPPED"
        fi
    done
}

# Get service port
get_service_port() {
    local service=$1
    case $service in
        "api-gateway") echo "3001" ;;
        "user-service") echo "3002" ;;
        "content-service") echo "3003" ;;
        "social-service") echo "3004" ;;
        "moderation-service") echo "3005" ;;
        "media-service") echo "3006" ;;
        *) echo "3000" ;;
    esac
}

# Test all services
test_services() {
    log_info "Testing all services..."

    for service in "${SERVICES[@]}"; do
        local port=$(get_service_port $service)
        log_info "Testing $service on port $port..."

        # Test health endpoint
        if curl -f -s "http://localhost:$port/health" >/dev/null 2>&1; then
            log_success "$service health check passed"
        else
            log_error "$service health check failed"
        fi

        # Test service-specific endpoints
        case $service in
            "user-service")
                # Test user registration endpoint exists
                if curl -f -s "http://localhost:$port/api/auth/register" -X OPTIONS >/dev/null 2>&1; then
                    log_success "$service auth endpoints accessible"
                fi
                ;;
            "content-service")
                # Test GraphQL endpoint
                if curl -f -s "http://localhost:$port/graphql" >/dev/null 2>&1; then
                    log_success "$service GraphQL endpoint accessible"
                fi
                ;;
            "social-service")
                # Test WebSocket endpoint
                if curl -f -s "http://localhost:$port/api/websocket/info" >/dev/null 2>&1; then
                    log_success "$service WebSocket info accessible"
                fi
                ;;
        esac
    done

    log_success "Service testing completed!"
}

# View logs
view_logs() {
    local service=${1:-""}
    local compose_cmd=$(get_compose_command)

    if [ -n "$service" ]; then
        log_info "Viewing logs for $service..."
        $compose_cmd logs -f "$service"
    else
        log_info "Viewing logs for all services..."
        $compose_cmd logs -f
    fi
}

# Clean up
cleanup() {
    log_info "Cleaning up..."
    local compose_cmd=$(get_compose_command)

    $compose_cmd down -v --remove-orphans
    docker system prune -f

    log_success "Cleanup completed!"
}

# Show help
show_help() {
    echo "VideaMozi Microservices Orchestration Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  start          Start all services (infrastructure + microservices)"
    echo "  stop           Stop all services"
    echo "  restart        Restart all services"
    echo "  build          Build all services"
    echo "  status         Show service status"
    echo "  test           Test all services"
    echo "  logs [service] View logs (optionally for specific service)"
    echo "  infrastructure Start only infrastructure services"
    echo "  databases      Initialize databases"
    echo "  cleanup        Clean up containers and volumes"
    echo "  help           Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 start           # Start everything"
    echo "  $0 logs user-service # View user service logs"
    echo "  $0 test            # Test all services"
}

# Main command handling
main() {
    local command=${1:-"help"}

    check_docker
    check_docker_compose

    case $command in
        "start")
            start_infrastructure
            init_databases
            build_services
            start_services
            sleep 10
            test_services
            log_success "All services started and tested!"
            ;;
        "stop")
            stop_services
            ;;
        "restart")
            stop_services
            sleep 5
            start_infrastructure
            start_services
            ;;
        "build")
            build_services
            ;;
        "status")
            show_status
            ;;
        "test")
            test_services
            ;;
        "logs")
            view_logs "$2"
            ;;
        "infrastructure")
            start_infrastructure
            ;;
        "databases")
            init_databases
            ;;
        "cleanup")
            cleanup
            ;;
        "help"|*)
            show_help
            ;;
    esac
}

# Run main function with all arguments
main "$@"
