# Purpose

Create a monorepo with 2 Cloudflare Workers demonstrating **GitHub App
(Installation)** authentication and repository operations.

## Architecture: Cloudflare Workers Monorepo

**Structure:**

```
/apps
  /ui (Next.js Cloudflare Worker)
  /backend (Hono API Cloudflare Worker)
/packages (shared types/utils)
```

## Key Architecture Decision: GitHub App vs OAuth App

**Use GitHub App (Installation)** - NOT OAuth App:

- GitHub Apps act independently with their own identity
- Better for server-side automation and repository operations
- More secure with fine-grained, repository-specific permissions

**Concept Explainer:**
[GitHub Apps Documentation](https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/about-creating-github-apps)

## Worker 1: UI (Next.js)

**Framework:** Next.js on Cloudflare Pages/Workers **Features:**

- GitHub repository URL input form
- Repository dashboard (name, description, language, stars)
- Issues list and detail views
- Git operations status panel
- GitHub App installation flow interface

## Worker 2: Backend API (Hono + Cloudflare Container)

**Framework:** Hono Worker + Cloudflare Container for git operations
**Database:** Cloudflare D1 (SQLite) **Container:** Cloudflare Container with
filesystem support

**Core Dependencies:**

- **@octokit/app** - GitHub App authentication
  - Repo: https://github.com/octokit/app.js
- **@octokit/rest** - GitHub API operations
  - Repo: https://github.com/octokit/rest.js
- **@cloudflare/containers** - Container management
  - Repo: https://github.com/cloudflare/containers

**Features:**

- **Hono Worker:** GitHub App webhooks, API endpoints, database operations
- **Container:** Direct git operations (clone, pull, push, status) with
  filesystem
- Repository information API endpoints
- Issues CRUD operations

## Repository Operations

**Container-Based Git Operations:**

- **Direct git commands:** Use `container.exec()` for git clone, pull, push,
  status
- **Filesystem access:** Full Linux filesystem in containers for repository
  storage
- **Authentication:** Use GitHub App installation tokens for git HTTPS
  authentication
- **Git operations:** Real git commands instead of GitHub Contents API

**Example Container Integration:**

```javascript
export class GitContainer extends Container {
    async cloneRepo(repoUrl, token) {
        const command = this.exec(
            `git clone https://x-access-token:${token}@${repoUrl}`,
        );
        await command.print();
    }
}
```

**Required GitHub App Permissions:**

- `contents: read/write` - File operations
- `issues: read/write` - Issues management
- `metadata: read` - Repository details
- `pull_requests: read` - PR information

## Environment Variables

```
# Backend Worker
GITHUB_APP_ID=your_app_id
GITHUB_PRIVATE_KEY=your_private_key
GITHUB_WEBHOOK_SECRET=your_webhook_secret

# Both Workers
DATABASE_URL=d1_database_url

# Container
WORKSPACE_DIR=/app/workspace
```

## What to Scaffold

**Monorepo Setup:**

- Turborepo or pnpm workspace
- Shared TypeScript configuration
- Shared types package

**UI Worker:**

- Next.js app with Cloudflare Pages adapter
- GitHub OAuth integration for app installation
- Repository dashboard components
- API client for backend worker

**Backend Worker + Container:**

- Hono API with Cloudflare Workers runtime
- **Cloudflare Container** with git and Node.js installed
- D1 database schema for installations
- GitHub webhook endpoints
- Octokit integration for GitHub App operations
- Container-based git operations with filesystem persistence

**Container Configuration:**

- Dockerfile with git, Node.js, and necessary tools
- Container class extending Cloudflare Container
- Git operations via `container.exec()` method
- Workspace directory management for repository checkouts

## Success Criteria

- Working GitHub App installable on repositories
- UI shows repository information and issues
- Backend performs **real git operations** (clone, pull, push) via Cloudflare
  Container
- Container has persistent filesystem for repository storage
- Both workers deployed on Cloudflare infrastructure with Container integration
