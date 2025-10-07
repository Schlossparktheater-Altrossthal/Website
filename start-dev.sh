#!/bin/bash

# Theater Website - Development Environment Starter
# =================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.yml"
ENV_FILE=".env"
ENV_EXAMPLE=".env.example"

print_header() {
    echo -e "${BLUE}"
    echo "🎭 Theater Website Development Environment"
    echo "=========================================${NC}"
    echo
}

print_status() {
    echo -e "${GREEN}➤${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

check_requirements() {
    print_status "Checking requirements..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Check Docker Compose
    if ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not available. Please ensure Docker Compose is installed."
        exit 1
    fi
    
    # Check pnpm
    if ! command -v pnpm &> /dev/null; then
        print_error "pnpm is not installed. Please install pnpm first."
        echo "You can install it with: npm install -g pnpm"
        exit 1
    fi
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js first."
        exit 1
    fi
    
    print_status "All requirements satisfied ✓"
}

setup_environment() {
    print_status "Setting up environment..."
    
    # Create .env from example if it doesn't exist
    if [[ ! -f "$ENV_FILE" ]]; then
        print_warning ".env file not found. Creating from template..."
        cp "$ENV_EXAMPLE" "$ENV_FILE"
        
        # Generate secure secrets
        AUTH_SECRET=$(openssl rand -base64 32)
        REALTIME_TOKEN=$(openssl rand -base64 32)
        CRON_SECRET=$(openssl rand -base64 32)
        
        # Replace placeholder values for Docker-based development
        sed -i.bak \
            -e "s/change-me-with-a-long-random-string/$AUTH_SECRET/g" \
            -e "s/replace-with-realtime-token/$REALTIME_TOKEN/g" \
            -e "s/replace-with-cron-secret/$CRON_SECRET/g" \
            -e "s/NEXTAUTH_URL=https:\/\/devtheater.beegreenx.de/NEXTAUTH_URL=http:\/\/localhost:3000/g" \
            -e "s/NEXT_PUBLIC_BASE_URL=https:\/\/devtheater.beegreenx.de/NEXT_PUBLIC_BASE_URL=http:\/\/localhost:3000/g" \
            -e "s/CORS_ORIGIN=https:\/\/devtheater.beegreenx.de/CORS_ORIGIN=http:\/\/localhost:3000/g" \
            -e "s/NEXT_PUBLIC_PWA_ENABLED=0/NEXT_PUBLIC_PWA_ENABLED=1/g" \
            -e "s/NEXT_PUBLIC_AUTH_DEV_NO_DB=0/NEXT_PUBLIC_AUTH_DEV_NO_DB=1/g" \
            -e "s/DATABASE_URL=postgresql:\/\/postgres:postgres@localhost:5432\/theater?schema=public/DATABASE_URL=postgresql:\/\/postgres:postgres@localhost:5432\/theater_dev?schema=public/g" \
            "$ENV_FILE"
        
        rm "$ENV_FILE.bak" 2>/dev/null || true
        
        print_status "Created .env with secure random secrets ✓"
        print_warning "Please review .env and adjust settings as needed!"
    else
        print_status ".env file exists ✓"
    fi
}

install_dependencies() {
    print_status "Installing Node.js dependencies..."
    
    if [[ ! -d "node_modules" ]] || [[ ! -f "pnpm-lock.yaml" ]]; then
        pnpm install
    else
        print_status "Dependencies already installed ✓"
    fi
}

start_services() {
    print_status "Starting Docker services..."
    
    # Start database and mailpit first
    docker compose up -d db mailpit
    
    # Wait for database to be ready
    print_status "Waiting for database to be ready..."
    timeout=60
    while ! docker compose exec -T db pg_isready -U postgres > /dev/null 2>&1; do
        sleep 1
        timeout=$((timeout - 1))
        if [[ $timeout -eq 0 ]]; then
            print_error "Database startup timeout!"
            exit 1
        fi
    done
    
    print_status "Database ready ✓"
}

setup_database() {
    print_status "Setting up database..."
    
    # Generate Prisma client locally
    pnpm prisma:generate
    
    print_status "Database setup will be handled by Docker container startup ✓"
}

start_development() {
    print_status "Starting development server..."
    
    # Start the app container which includes database setup and migration
    docker compose up -d app
    
    echo
    echo -e "${GREEN}🚀 Development Environment Ready!${NC}"
    echo
    echo "📍 Application URLs:"
    echo "   • Main App:    http://localhost:3000"
    echo "   • Mail UI:     http://localhost:8025"
    echo "   • Database:    localhost:5432"
    echo
    echo "🔧 Useful commands:"
    echo "   • Stop services: docker compose down"
    echo "   • View logs:     docker compose logs -f app"
    echo "   • Reset DB:      docker compose down -v && ./start-dev.sh"
    echo "   • Shell into app: docker compose exec app sh"
    echo
    echo "Following application logs (Ctrl+C to stop)..."
    echo
    
    # Follow the app container logs
    docker compose logs -f app
}

cleanup() {
    print_status "Shutting down services..."
    docker compose down
    print_status "Development environment stopped ✓"
}

# Trap script exit to cleanup
trap cleanup EXIT

# Main execution flow
main() {
    print_header
    
    # Parse command line arguments
    case "${1:-}" in
        --reset)
            print_status "Resetting development environment..."
            docker compose down -v
            rm -rf node_modules .next 2>/dev/null || true
            ;;
        --clean)
            print_status "Cleaning development environment..."
            docker compose down --volumes --remove-orphans
            docker compose rm -f
            # Only remove images built for this project
            docker image rm $(docker compose config --images) 2>/dev/null || true
            rm -rf node_modules .next 2>/dev/null || true
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo
            echo "Options:"
            echo "  --reset    Reset everything (containers, volumes, node_modules)"
            echo "  --clean    Deep clean (project containers, images, volumes, node_modules)" 
            echo "  --help     Show this help message"
            echo
            echo "The script will:"
            echo "  1. Check requirements (Docker, Node.js, pnpm)"
            echo "  2. Setup .env file with secure defaults"
            echo "  3. Install Node.js dependencies (for Prisma client)"
            echo "  4. Start PostgreSQL and Mailpit services via Docker"
            echo "  5. Start the app container (includes DB setup and seeding)"
            echo "  6. Follow application logs"
            exit 0
            ;;
    esac
    
    # Run setup steps
    check_requirements
    setup_environment
    install_dependencies
    start_services
    setup_database
    start_development
}

# Only run main if script is executed directly (not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi