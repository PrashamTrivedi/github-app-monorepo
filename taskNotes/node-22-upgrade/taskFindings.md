# Node.js 22 Upgrade

## Purpose

Upgrade Node.js runtime from version 18 to 22 and leverage native features

## Original Ask
"We are using node 18. We must use node 22 with node 22 native features."

## Complexity and the reason behind it
**Score: 2/5** - Primarily a version upgrade with minimal code changes:
- Docker base image update (straightforward)
- Package.json engine constraints update
- @types/node version bump
- Most existing code should work without changes
- Low risk since Node 22 maintains backwards compatibility

## Architectural changes required

- **Docker Container**: Update from `node:18-alpine` to `node:22-alpine`
- **Package Engine Requirements**: Update all package.json engine constraints
- **TypeScript Types**: Upgrade @types/node to match Node 22
- **Cloudflare Workers**: Verify nodejs_compat flag supports Node 22

## Backend changes required

- Update wrangler.jsonc compatibility settings if needed
- Test container operations with new Node version
- Validate all dependencies work with Node 22
- Update any Node version-specific code

## Frontend changes required

- Update Next.js build process for Node 22
- Test all build and deployment scripts
- Update development environment setup

## Native Features Integration Opportunities

**Note**: Analysis shows the codebase doesn't currently use WebSocket, test runners, or glob patterns that would benefit from Node 22 native features.

- **WebSocket**: Not currently used in the project (GitHub App doesn't require WebSocket)
- **Native Test Runner**: No existing test framework to replace (could be added later)
- **glob/globSync**: No current glob usage found in dependencies
- **Watch Mode**: Handled by wrangler dev and next dev, no need to change

## Acceptance Criteria

- All package.json engines specify Node 22
- Docker container runs on Node 22
- All tests pass on new version
- Build and deployment work correctly
- No breaking dependency issues
- Development and production environments updated

## Validation

**Commands to test:**
```bash
node --version  # Should show 22.x
pnpm type-check  # All TypeScript should compile
pnpm build      # All packages should build
pnpm test       # If tests exist, they should pass
pnpm dev        # Development servers should start
```

**Docker testing:**
```bash
docker build -f docker/Dockerfile .
# Container should build and start successfully
```

**Deployment testing:**
```bash
cd apps/backend && wrangler deploy --dry-run
cd apps/ui && wrangler pages deploy --dry-run
```