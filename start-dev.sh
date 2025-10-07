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
PRODUCTION_MODE=false

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
    local mode_suffix=""
    if [[ "$PRODUCTION_MODE" == "true" ]]; then
        mode_suffix=" (production mode)"
        print_status "Setting up production environment..."
    else
        mode_suffix=" (development mode)"
        print_status "Setting up development environment..."
    fi
    
    # Create .env from example if it doesn't exist
    if [[ ! -f "$ENV_FILE" ]]; then
        print_warning ".env file not found. Creating from template..."
        cp "$ENV_EXAMPLE" "$ENV_FILE"
        
        # Generate secure secrets
        AUTH_SECRET=$(openssl rand -base64 32)
        REALTIME_TOKEN=$(openssl rand -base64 32)
        CRON_SECRET=$(openssl rand -base64 32)
        
        if [[ "$PRODUCTION_MODE" == "true" ]]; then
            # Production environment setup
            sed -i.bak \
                -e "s/change-me-with-a-long-random-string/$AUTH_SECRET/g" \
                -e "s/replace-with-realtime-token/$REALTIME_TOKEN/g" \
                -e "s/replace-with-cron-secret/$CRON_SECRET/g" \
                -e "s/NEXTAUTH_URL=https:\/\/devtheater.beegreenx.de/NEXTAUTH_URL=http:\/\/localhost:3000/g" \
                -e "s/NEXT_PUBLIC_BASE_URL=https:\/\/devtheater.beegreenx.de/NEXT_PUBLIC_BASE_URL=http:\/\/localhost:3000/g" \
                -e "s/CORS_ORIGIN=https:\/\/devtheater.beegreenx.de/CORS_ORIGIN=http:\/\/localhost:3000/g" \
                -e "s/NEXT_PUBLIC_PWA_ENABLED=0/NEXT_PUBLIC_PWA_ENABLED=1/g" \
                -e "s/NEXT_PUBLIC_AUTH_DEV_NO_DB=0/NEXT_PUBLIC_AUTH_DEV_NO_DB=0/g" \
                -e "s/DATABASE_URL=postgresql:\/\/postgres:postgres@localhost:5432\/theater?schema=public/DATABASE_URL=postgresql:\/\/postgres:postgres@localhost:5432\/theater_prod?schema=public/g" \
                "$ENV_FILE"
        else
            # Development environment setup
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
        fi
        
        rm "$ENV_FILE.bak" 2>/dev/null || true
        
        print_status "Created .env with secure random secrets$mode_suffix ✓"
        print_warning "Please review .env and adjust settings as needed!"
    else
        print_status ".env file exists$mode_suffix ✓"
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
    
    # Clean up any existing containers (project-specific)
    docker compose down > /dev/null 2>&1 || true
    
    # Start the app container which will handle the startup automatically
    docker compose up --build app
}

start_production() {
    print_status "Starting production environment..."
    
    # Clean up any existing containers (project-specific)
    docker compose -f docker-compose.yml -f docker-compose.hosting.yml down > /dev/null 2>&1 || true
    
    print_status "Building and starting production services..."
    # Use production compose configuration
    docker compose -f docker-compose.yml -f docker-compose.hosting.yml up --build -d
    
    # Show running services
    print_success "Production environment is running!"
    print_info "Visit: http://localhost:3000"
    print_info "View logs: docker compose -f docker-compose.yml -f docker-compose.hosting.yml logs -f"
    print_info "Stop services: docker compose -f docker-compose.yml -f docker-compose.hosting.yml down"
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
            print_status "Resetting environment..."
            docker compose down -v
            rm -rf node_modules .next 2>/dev/null || true
            ;;
        --clean)
            print_status "Cleaning environment..."
            docker compose down --volumes --remove-orphans
            docker compose rm -f
            # Only remove images built for this project
            docker image rm $(docker compose config --images) 2>/dev/null || true
            rm -rf node_modules .next 2>/dev/null || true
            ;;
        --prod|--production)
            print_status "Starting in production mode..."
            PRODUCTION_MODE=true
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo
            echo "Options:"
            echo "  --prod     Start production build (optimized, no dev features)"
            echo "  --reset    Reset everything (containers, volumes, node_modules)"
            echo "  --clean    Deep clean (project containers, images, volumes, node_modules)" 
            echo "  --help     Show this help message"
            echo
            echo "Development mode (default):"
            echo "  1. Check requirements (Docker, Node.js, pnpm)"
            echo "  2. Setup .env file with secure defaults"
            echo "  3. Install Node.js dependencies (for Prisma client)"
            echo "  4. Start PostgreSQL and Mailpit services via Docker"
            echo "  5. Start the app container (includes DB setup and seeding)"
            echo "  6. Follow application logs"
            echo
            echo "Production mode (--prod):"
            echo "  1. Check requirements and build production image"
            echo "  2. Start optimized production containers"
            echo "  3. No hot-reload, no dev tools, optimized for performance"
            exit 0
            ;;
    esac
    
    # Run setup steps
    check_requirements
    setup_environment
    install_dependencies
    
    if [[ "$PRODUCTION_MODE" == "true" ]]; then
        # Production workflow: different service startup and no setup_database (handled by container)
        print_status "Running in production mode - using optimized containers..."
        start_production
    else
        # Development workflow: full setup with services and database preparation
        start_services
        setup_database
        start_development
    fi
}

# Only run main if script is executed directly (not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi