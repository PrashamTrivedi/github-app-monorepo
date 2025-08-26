#!/bin/bash

# GitHub App Monorepo Development Setup Script

echo "🚀 Setting up GitHub App development environment..."

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is not installed. Please install pnpm first:"
    echo "   npm install -g pnpm"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Build shared package
echo "🔨 Building shared package..."
cd packages/shared && pnpm build && cd ../..

# Create environment file from sample
if [ ! -f ".env" ]; then
    echo "🔧 Creating .env file from sample..."
    cp .env.sample .env
    echo "⚠️  Please update .env with your actual values before proceeding"
fi

# Create D1 databases (development only)
echo "🗄️  Setting up D1 databases..."

# Check if wrangler is logged in
if ! wrangler whoami &> /dev/null; then
    echo "⚠️  Please login to Wrangler first:"
    echo "   wrangler login"
    echo "   Then run this script again"
    exit 1
fi

# Create development database
echo "Creating development D1 database..."
cd apps/backend
wrangler d1 create github-app-dev

echo "📋 Next steps:"
echo "1. Update your .env file with actual GitHub App credentials"
echo "2. Update wrangler.jsonc files with your D1 database IDs"
echo "3. Run database migrations:"
echo "   cd apps/backend && wrangler d1 execute github-app-dev --file=schema.sql"
echo "4. Start development servers:"
echo "   pnpm dev"
echo ""
echo "🎉 Setup complete! Happy coding!"