#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
    echo -e "${BLUE}==> $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check prerequisites
print_step "Checking prerequisites"
if ! command -v wrangler &> /dev/null; then
    print_error "Wrangler CLI is not installed. Please install it with: npm install -g wrangler"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker to build the container image"
    exit 1
fi

print_success "Prerequisites check passed"

# Environment setup
ENVIRONMENTS=("dev" "staging" "production")
DATABASE_NAMES=("github-app-dev" "github-app-staging" "github-app-prod")
KV_NAMES=("TOKEN_CACHE" "TOKEN_CACHE_STAGING" "TOKEN_CACHE_PROD")

# Create D1 Databases
print_step "Creating D1 Databases"

for i in "${!ENVIRONMENTS[@]}"; do
    env="${ENVIRONMENTS[$i]}"
    db_name="${DATABASE_NAMES[$i]}"
    
    print_step "Creating database: $db_name"
    
    # Create database (this will show ID in output)
    wrangler d1 create "$db_name" || print_warning "Database $db_name might already exist"
    
    # For dev environment, also create preview database
    if [ "$env" = "dev" ]; then
        wrangler d1 create "${db_name}-preview" || print_warning "Preview database ${db_name}-preview might already exist"
    fi
done

print_success "D1 databases created"

# Create KV Namespaces
print_step "Creating KV Namespaces"

for i in "${!ENVIRONMENTS[@]}"; do
    env="${ENVIRONMENTS[$i]}"
    kv_name="${KV_NAMES[$i]}"
    
    print_step "Creating KV namespace: $kv_name"
    
    if [ "$env" = "dev" ]; then
        # Create both production and preview for dev
        wrangler kv:namespace create "$kv_name" || print_warning "KV namespace $kv_name might already exist"
        wrangler kv:namespace create "$kv_name" --preview || print_warning "Preview KV namespace $kv_name might already exist"
    else
        wrangler kv:namespace create "$kv_name" || print_warning "KV namespace $kv_name might already exist"
    fi
done

print_success "KV namespaces created"

# Build Docker container
print_step "Building custom git container"
cd docker/

if [ ! -f Dockerfile ]; then
    print_error "Dockerfile not found in docker/ directory"
    exit 1
fi

# Build the container
docker build -t github-git-container:latest .

print_success "Container built successfully"

# Tag for registry (user needs to update with their registry)
print_warning "Remember to tag and push to your container registry:"
echo "  docker tag github-git-container:latest your-registry/github-git-container:latest"
echo "  docker push your-registry/github-git-container:latest"
echo ""

cd ..

# Apply database schema
print_step "Applying database schema"

for i in "${!ENVIRONMENTS[@]}"; do
    env="${ENVIRONMENTS[$i]}"
    db_name="${DATABASE_NAMES[$i]}"
    
    print_step "Applying schema to $db_name"
    
    cd apps/backend
    if wrangler d1 execute "$db_name" --file=./schema.sql; then
        print_success "Schema applied to $db_name"
    else
        print_error "Failed to apply schema to $db_name"
    fi
    cd ../..
done

# Instructions for secrets
print_step "Setting up secrets"
print_warning "You need to manually set the following secrets for each environment:"
echo ""
echo "Development secrets:"
echo "  wrangler secret put GITHUB_APP_ID"
echo "  wrangler secret put GITHUB_PRIVATE_KEY"
echo "  wrangler secret put GITHUB_WEBHOOK_SECRET"
echo "  wrangler secret put GITHUB_CLIENT_ID"
echo "  wrangler secret put GITHUB_CLIENT_SECRET"
echo ""
echo "Staging secrets (add --env staging to each command above)"
echo "Production secrets (add --env production to each command above)"
echo ""

# Instructions for wrangler.jsonc updates
print_step "Updating wrangler.jsonc files"
print_warning "Please update the following IDs in your wrangler.jsonc files:"
echo ""
echo "1. Update database IDs in apps/backend/wrangler.jsonc:"
echo "   - Replace 'your-dev-db-id' with actual dev database ID"
echo "   - Replace 'your-staging-db-id' with actual staging database ID"
echo "   - Replace 'your-production-db-id' with actual production database ID"
echo ""
echo "2. Update KV namespace IDs in apps/backend/wrangler.jsonc:"
echo "   - Replace 'your-dev-token-cache-id' with actual dev KV ID"
echo "   - Replace 'your-staging-token-cache-id' with actual staging KV ID"
echo "   - Replace 'your-prod-token-cache-id' with actual production KV ID"
echo ""
echo "3. Update container image in apps/backend/wrangler.jsonc:"
echo "   - Replace 'your-registry/github-git-container:latest' with your actual image URL"
echo ""

# Validation commands
print_step "Validation commands"
echo ""
echo "After updating wrangler.jsonc and setting secrets, run these commands to validate:"
echo ""
echo "1. Test database connection:"
echo "   cd apps/backend"
echo "   wrangler d1 execute github-app-dev --command=\"SELECT name FROM sqlite_master WHERE type='table';\""
echo ""
echo "2. Test local development:"
echo "   cd apps/backend"
echo "   wrangler dev --compatibility-date=2024-01-15"
echo ""
echo "3. Deploy to staging:"
echo "   cd apps/backend"
echo "   wrangler deploy --env staging"
echo ""
echo "4. Deploy to production:"
echo "   cd apps/backend"
echo "   wrangler deploy --env production"
echo ""

print_success "Infrastructure setup completed!"
print_warning "Don't forget to:"
echo "1. Push your container image to a registry"
echo "2. Update the wrangler.jsonc files with actual IDs"
echo "3. Set up all environment secrets"
echo "4. Test the deployment with the validation commands"