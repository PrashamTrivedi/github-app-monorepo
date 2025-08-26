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

# Test functions
test_database_connection() {
    local db_name="$1"
    local env_flag="$2"
    
    print_step "Testing database connection: $db_name"
    
    cd apps/backend
    
    if wrangler d1 execute "$db_name" --command="SELECT name FROM sqlite_master WHERE type='table';" $env_flag; then
        print_success "Database $db_name is accessible"
        
        # Test table creation
        if wrangler d1 execute "$db_name" --command="SELECT COUNT(*) FROM installations;" $env_flag 2>/dev/null; then
            print_success "Database schema is properly applied"
        else
            print_error "Database schema is missing or incomplete"
        fi
    else
        print_error "Cannot access database $db_name"
    fi
    
    cd ../..
}

test_local_development() {
    print_step "Testing local development setup"
    
    cd apps/backend
    
    # Start wrangler dev in background
    print_step "Starting local development server..."
    wrangler dev --compatibility-date=2024-01-15 --port 8787 > /tmp/wrangler-dev.log 2>&1 &
    WRANGLER_PID=$!
    
    # Wait for server to start
    sleep 10
    
    # Test health endpoint
    if curl -s http://localhost:8787/api/health > /dev/null 2>&1; then
        print_success "Local development server is running"
        
        # Test database endpoint
        if curl -s http://localhost:8787/api/installations > /dev/null 2>&1; then
            print_success "API endpoints are accessible"
        else
            print_warning "API endpoints might not be fully configured"
        fi
    else
        print_error "Local development server is not responding"
    fi
    
    # Kill the background process
    kill $WRANGLER_PID 2>/dev/null || true
    wait $WRANGLER_PID 2>/dev/null || true
    
    cd ../..
}

test_container_config() {
    print_step "Validating container configuration"
    
    # Check if custom image is configured
    if grep -q "your-registry" apps/backend/wrangler.jsonc; then
        print_warning "Container image still uses placeholder. Update with your actual registry"
    else
        print_success "Container image configuration looks good"
    fi
    
    # Check if container binding exists
    if grep -q "GIT_CONTAINER" apps/backend/wrangler.jsonc; then
        print_success "Container binding is configured"
    else
        print_error "Container binding is missing"
    fi
}

test_secrets_config() {
    print_step "Checking secrets configuration"
    
    cd apps/backend
    
    # Test secrets (this will show which ones are missing)
    if wrangler secret list 2>/dev/null | grep -q "GITHUB_APP_ID"; then
        print_success "GitHub App ID secret is set"
    else
        print_warning "GITHUB_APP_ID secret is not set"
    fi
    
    if wrangler secret list 2>/dev/null | grep -q "GITHUB_PRIVATE_KEY"; then
        print_success "GitHub private key secret is set"
    else
        print_warning "GITHUB_PRIVATE_KEY secret is not set"
    fi
    
    if wrangler secret list 2>/dev/null | grep -q "GITHUB_WEBHOOK_SECRET"; then
        print_success "GitHub webhook secret is set"
    else
        print_warning "GITHUB_WEBHOOK_SECRET secret is not set"
    fi
    
    cd ../..
}

test_ui_config() {
    print_step "Validating UI configuration"
    
    # Check if API URLs are properly configured
    if grep -q "localhost:8787" apps/ui/wrangler.jsonc; then
        print_success "Development API URL is configured"
    else
        print_warning "Development API URL might be missing"
    fi
    
    # Check for placeholder URLs
    if grep -q "your-subdomain" apps/ui/wrangler.jsonc; then
        print_warning "UI configuration still uses placeholders. Update with your actual domains"
    else
        print_success "UI configuration looks good"
    fi
}

run_integration_tests() {
    print_step "Running integration tests"
    
    # Test git operation endpoints (mock)
    print_step "Testing git operation endpoints..."
    
    cd apps/backend
    
    # Start server for testing
    wrangler dev --compatibility-date=2024-01-15 --port 8787 > /tmp/wrangler-test.log 2>&1 &
    WRANGLER_PID=$!
    
    sleep 10
    
    # Test clone endpoint (should fail gracefully without proper setup)
    if curl -s -X POST http://localhost:8787/git/clone \
        -H "Content-Type: application/json" \
        -d '{"repository":"https://github.com/octocat/Hello-World.git","branch":"main"}' \
        | grep -q "error\|success"; then
        print_success "Git clone endpoint is responding"
    else
        print_warning "Git clone endpoint might not be properly configured"
    fi
    
    # Clean up
    kill $WRANGLER_PID 2>/dev/null || true
    wait $WRANGLER_PID 2>/dev/null || true
    
    cd ../..
}

show_next_steps() {
    print_step "Next Steps"
    echo ""
    print_warning "Manual tasks remaining:"
    echo "1. Update container image URL in apps/backend/wrangler.jsonc"
    echo "2. Set all GitHub App secrets using wrangler secret put"
    echo "3. Update domain placeholders in apps/ui/wrangler.jsonc"
    echo "4. Test webhook delivery from GitHub"
    echo "5. Deploy to staging and production environments"
    echo ""
    echo "Deployment commands:"
    echo "  cd apps/backend && wrangler deploy --env staging"
    echo "  cd apps/backend && wrangler deploy --env production"
    echo "  cd apps/ui && wrangler pages deploy --env staging"
    echo "  cd apps/ui && wrangler pages deploy --env production"
    echo ""
}

# Main execution
print_step "Cloudflare Infrastructure Validation"
print_step "===================================="
echo ""

# Check prerequisites
if ! command -v wrangler &> /dev/null; then
    print_error "Wrangler CLI is not installed"
    exit 1
fi

if ! command -v curl &> /dev/null; then
    print_error "curl is not installed"
    exit 1
fi

# Run tests
test_database_connection "github-app-dev" ""
test_container_config
test_secrets_config  
test_ui_config
test_local_development
run_integration_tests

print_success "Infrastructure validation completed"
show_next_steps