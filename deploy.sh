#!/bin/bash

# Videa Mozi Deployment Script
# This script helps deploy the full-stack application using Docker Compose

set -e

echo "🚀 Videa Mozi Deployment Script"
echo "================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
}

# Check if environment file exists
check_env_file() {
    if [ ! -f ".env.production" ]; then
        print_warning "Production environment file not found!"
        if [ -f "env-production-template" ]; then
            print_status "Found template file. Copying to .env.production..."
            cp env-production-template .env.production
            print_warning "Please edit .env.production with your actual values before deploying!"
            exit 1
        else
            print_error "No environment template found. Please create .env.production manually."
            exit 1
        fi
    fi
}

# Build and deploy
deploy() {
    print_status "Building and deploying Videa Mozi..."

    # Stop existing containers
    print_status "Stopping existing containers..."
    docker-compose down || true

    # Build the application
    print_status "Building Docker images..."
    docker-compose build --no-cache

    # Start services
    print_status "Starting services..."
    docker-compose up -d

    # Wait for services to be ready
    print_status "Waiting for services to start..."
    sleep 10

    # Check service health
    print_status "Checking service health..."
    if curl -f http://localhost:3001/health/live &>/dev/null; then
        print_status "✅ Backend is healthy!"
    else
        print_error "❌ Backend health check failed"
        exit 1
    fi

    if curl -f http://localhost:80/health/live &>/dev/null; then
        print_status "✅ Nginx proxy is working!"
    else
        print_warning "⚠️ Nginx proxy might not be ready yet"
    fi

    print_status "🎉 Deployment completed successfully!"
    echo ""
    echo "🌐 Available services:"
    echo "   • Backend API: http://localhost:3001"
    echo "   • API Documentation: http://localhost:3001/api-docs"
    echo "   • Health Dashboard: http://localhost:3001/health/dashboard"
    echo "   • Nginx Proxy: http://localhost:80"
    echo ""
    echo "📊 To view logs:"
    echo "   docker-compose logs -f backend"
    echo ""
    echo "🛑 To stop services:"
    echo "   docker-compose down"
}

# View logs
logs() {
    if [ -z "$2" ]; then
        docker-compose logs -f
    else
        docker-compose logs -f "$2"
    fi
}

# Stop services
stop() {
    print_status "Stopping all services..."
    docker-compose down
    print_status "✅ Services stopped"
}

# Update deployment
update() {
    print_status "Updating deployment..."
    docker-compose pull
    docker-compose build --no-cache
    docker-compose up -d
    print_status "✅ Deployment updated"
}

# Scale the application
scale() {
    if [ -z "$2" ]; then
        print_error "Please specify number of instances: $0 scale <number>"
        exit 1
    fi

    print_status "Scaling backend to $2 instances..."
    docker-compose up -d --scale backend="$2"
    print_status "✅ Backend scaled to $2 instances"
}

# Show status
status() {
    print_header "Service Status"

    echo "🐳 Docker Containers:"
    docker-compose ps

    echo ""
    echo "🔍 Health Checks:"
    check_health

    echo ""
    echo "📊 Resource Usage:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"
}

# Main script
case "${1:-help}" in
    "deploy")
        check_docker
        check_env_file
        deploy
        ;;
    "logs")
        logs "$@"
        ;;
    "stop")
        stop
        ;;
    "update")
        check_docker
        update
        ;;
    "scale")
        scale "$@"
        ;;
    "status")
        status
        ;;
    "help"|*)
        echo "Usage: $0 {deploy|logs|stop|update|scale|status}"
        echo ""
        echo "Commands:"
        echo "  deploy    Build and deploy the application"
        echo "  logs      View application logs (optionally specify service name)"
        echo "  stop      Stop all services"
        echo "  update    Update the deployment with latest changes"
        echo "  scale     Scale backend instances: $0 scale <number>"
        echo "  status    Show current deployment status and health"
        echo ""
        ;;
esac
