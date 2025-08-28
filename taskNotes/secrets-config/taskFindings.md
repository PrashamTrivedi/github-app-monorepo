# Purpose

Configure wrangler secrets for GitHub App credentials across all environments and add comprehensive logging for GitHub API calls

## Original Ask
Add these as wrangler secrets, shared between the environments. and add logs to check if we are calling actual github apis or not.

## Complexity and the reason behind it
Complexity score: 3 out of 5

**Reasons:**
- **Medium complexity** due to multiple environment configurations (dev, staging, production)
- Requires careful secret management using Cloudflare's wrangler secrets system
- Need to add comprehensive logging across multiple GitHub API integration points
- Must ensure backward compatibility while transitioning from environment variables to secrets
- Logging implementation needs to be informative but not leak sensitive information

## Architectural changes required

**Secret Management Architecture:**
- Migrate from environment variables in `wrangler.jsonc` to Cloudflare Workers secrets
- Use single set of wrangler secrets shared across ALL environments (dev, staging, production)
- Simplified configuration - same GitHub App credentials used for all environments
- Maintain fallback behavior for development mode when secrets are not available

**Logging Architecture:**
- Add structured logging for all GitHub API calls
- Include request metadata (endpoint, method, response status)
- Add performance monitoring (response times)
- Ensure logs don't expose sensitive information (tokens, keys)

## Backend changes required

**1. Wrangler Secrets Configuration:**
- Remove GitHub credentials from `wrangler.jsonc` vars sections
- Use `wrangler secret put` commands (shared across all environments):
  - `GITHUB_APP_ID`
  - `GITHUB_PRIVATE_KEY` 
  - `GITHUB_WEBHOOK_SECRET`
- No per-environment secret configuration needed - same credentials for all envs

**2. GitHub Authentication Library (`src/lib/github-auth.ts`):**
- Add comprehensive logging to `generateAppJWT()` function
- Add logging to `generateInstallationToken()` with API call tracking
- Add logging to `getInstallation()` and `getInstallationRepositories()`
- Include performance metrics and error tracking

**3. API Routes (`src/routes/api.ts`):**
- Enhanced logging in `/installations` endpoint to track GitHub API vs database fallback
- Add request/response logging for GitHub API calls
- Include environment detection logs

**4. Webhook Routes (`src/routes/webhooks.ts`):**
- Add logging for webhook signature verification
- Track incoming webhook events and GitHub API responses

## Frontend changes required

No frontend changes required - this is purely a backend configuration and logging enhancement.

## Acceptance Criteria

**Secret Management:**
- [ ] GitHub App credentials are stored as wrangler secrets (not in wrangler.jsonc)
- [ ] Single set of secrets shared across ALL environments (simplified configuration)
- [ ] Development environment gracefully handles missing secrets with appropriate warnings
- [ ] No sensitive credentials are logged or exposed in application logs

**Logging Implementation:**
- [ ] All GitHub API calls are logged with endpoint, method, and response status
- [ ] API call performance metrics are captured (response time)
- [ ] Clear distinction between GitHub API calls vs database fallback operations
- [ ] Environment-specific logging shows which configuration is being used
- [ ] Error conditions are properly logged without exposing sensitive data

**Backward Compatibility:**
- [ ] System continues to work during transition from env vars to secrets
- [ ] Development mode maintains mock token behavior when secrets unavailable
- [ ] No breaking changes to existing API contracts

## Validation

**Commands to test secret configuration:**
```bash
# Set secrets (shared across all environments)
cd apps/backend
wrangler secret put GITHUB_APP_ID
wrangler secret put GITHUB_PRIVATE_KEY
wrangler secret put GITHUB_WEBHOOK_SECRET

# Verify secrets are set
wrangler secret list

# Test in development
pnpm dev
curl http://localhost:8787/api/debug/env

# Test installations endpoint
curl http://localhost:8787/api/installations
```

**Logging verification:**
```bash
# Check wrangler dev logs for GitHub API calls
pnpm -F @github-app/backend dev

# In another terminal, trigger API calls
curl http://localhost:8787/api/installations

# Verify logs show:
# - "Calling GitHub API: GET /app/installations"
# - Response status and timing
# - Environment detection
# - Fallback behavior (if applicable)
```

**Environment testing:**
```bash
# Test staging environment (uses same secrets)
wrangler deploy --env staging

# Test production environment (uses same secrets)
wrangler deploy --env production
```

**Integration testing:**
- Navigate to frontend (localhost:3000)
- Verify installations are loaded correctly
- Check browser network tab for API calls
- Confirm backend logs show GitHub API interactions
- Test GitHub App installation flow end-to-end