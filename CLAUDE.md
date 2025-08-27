# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GitHub App monorepo with Cloudflare Workers backend and Next.js frontend, using Cloudflare Containers for git operations. Built with pnpm workspace and TypeScript.

## Architecture

- **Monorepo Structure**: pnpm workspace with shared packages
- **Backend** (`apps/backend`): Hono API on Cloudflare Workers with D1 database and KV storage
- **Frontend** (`apps/ui`): Next.js on Cloudflare Pages
- **Container Integration**: Cloudflare Containers for direct git operations with filesystem access

## Essential Commands

### Development
```bash
pnpm dev                    # Start all dev servers in parallel
pnpm -F @github-app/backend dev    # Backend only (wrangler dev)
pnpm -F @github-app/ui dev         # Frontend only (next dev)
```

### Build & Deploy
```bash
pnpm build                  # Build all apps
pnpm -F @github-app/backend deploy # Deploy backend worker
pnpm -F @github-app/ui deploy      # Deploy to Cloudflare Pages
```

### Type Checking & Linting
```bash
pnpm type-check            # TypeScript check all packages
pnpm lint                  # Lint all packages
```

### Database Operations
```bash
cd apps/backend
wrangler d1 execute github-app-dev --file=schema.sql  # Run migrations
wrangler d1 execute github-app-dev --command="SELECT * FROM installations"  # Query database
```

### Wrangler Commands
```bash
cd apps/backend
wrangler types             # Generate Cloudflare types
wrangler dev               # Start local development server
wrangler deploy            # Deploy to Cloudflare Workers
```

## Key Dependencies & Frameworks

- **Backend**: Hono framework, @octokit/app, @octokit/rest, jsonwebtoken
- **Frontend**: Next.js 14, React 18, Tailwind CSS
- **Infrastructure**: Cloudflare Workers, D1 (SQLite), KV storage, Containers

## Configuration Files

- **Backend**: `apps/backend/wrangler.jsonc` - Worker configuration with D1, KV, and Container bindings
- **Frontend**: `apps/ui/wrangler.jsonc` - Pages configuration with environment variables
- **Database**: `apps/backend/schema.sql` - D1 database schema with installations, repositories, webhook_events, and git_operations tables

## Environment Setup

1. Run `./setup-dev.sh` for initial setup
2. Update `.env` with GitHub App credentials
3. Configure wrangler.jsonc files with actual resource IDs
4. Run database migrations

## Key Architecture Patterns

- **GitHub App Authentication**: Uses installation tokens via @octokit/app
- **Container Operations**: Git commands executed via Cloudflare Container with filesystem persistence
- **Database Schema**: Tracks installations, repositories, webhook events, and git operations
- **Error Handling**: Middleware validates bindings and provides consistent error responses
- **Environment Validation**: Checks for required bindings (DB, GIT_CONTAINER) per route group

## Container Integration

The backend uses Cloudflare Containers for git operations:
- Container binding: `GIT_CONTAINER` 
- Git operations via container.fetch() to execute commands
- Filesystem persistence for repository storage
- See `apps/backend/src/lib/git-container.ts` for implementation
- Never generate cloudflare binding types by hand. Run `cf-typegen` from package.json, and ask user if it's not available