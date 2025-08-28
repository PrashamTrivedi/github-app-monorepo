# Remove Dummy Installation Task

## Purpose
Remove dummy/mock installation data and ensure the application uses actual GitHub App installations provided via secrets

## Original Ask
Remove dummy installation, and then use actual installation which is provided via secrets

## Complexity and the reason behind it
**Complexity: 4/5**

This task has high complexity because:
- Multiple files need modification with interconnected dummy data
- Requires careful handling of fallback mechanisms and error conditions
- Must ensure production readiness while maintaining development functionality
- Involves authentication flows and GitHub API integration
- Database operations and caching mechanisms are affected
- Risk of breaking existing functionality if not handled properly

## Architectural changes required

**No major architectural changes required.** The current architecture already supports real GitHub App installations via secrets. The changes are primarily about removing fallback mock data and ensuring proper error handling when credentials are missing.

## Backend changes required

### 1. GitHub Authentication (`apps/backend/src/lib/github-auth.ts`)
- Remove mock token generation in `generateInstallationToken()` (lines 107-121)
- Remove mock repositories in `getInstallationRepositories()` (lines 321-354)
- Remove mock installation ID in `checkRepositoryInstallation()` (lines 448, 433-465)
- Remove mock installations in `getAllInstallationsFromGitHub()` (lines 660-683)
- Update error handling to properly fail when credentials are missing instead of returning mock data
- Ensure proper validation of required environment variables

### 2. Database Operations (`apps/backend/src/lib/database.ts`)
- Remove mock installation data in `getAllInstallations()` (lines 135-145)
- Remove mock repository data in `getRepositoryByName()` (lines 178-201)
- Remove mock installation status in `checkRepositoryInstallationStatus()` (lines 380-405)
- Update error handling to return proper errors instead of mock data when database is unavailable

### 3. Environment Validation
- Add strict validation that GitHub App credentials are required
- Ensure proper error messages when secrets are not configured
- Update logging to clearly indicate when required credentials are missing

### 4. Configuration Review
- Verify secrets configuration in `wrangler.jsonc` is correct
- Ensure proper binding of environment variables:
  - `GITHUB_APP_ID`
  - `GITHUB_WEBHOOK_SECRET`
  - `GITHUB_PRIVATE_KEY_CHUNK_1`
  - `GITHUB_PRIVATE_KEY_CHUNK_2`

## Frontend changes required

**No frontend changes required.** The frontend already handles API errors appropriately and will properly display errors when the backend fails due to missing credentials.

## Acceptance Criteria

1. **Mock Data Removal**:
   - All dummy/mock installation data removed from codebase
   - No fallback to mock tokens, repositories, or installations
   - All mock installation IDs (12345) removed

2. **Error Handling**:
   - Clear error messages when GitHub App credentials are not configured
   - Proper HTTP error responses (401/403) for authentication failures
   - No silent fallbacks to mock data

3. **Production Readiness**:
   - Application works correctly with real GitHub App installations
   - Real GitHub API integration functions properly
   - Database operations work with actual installation data

4. **Development Experience**:
   - Clear documentation about required secrets for local development
   - Proper error messages guide developers to configure credentials
   - No breaking changes to existing APIs

## Validation

### Backend API Testing
**Commands to run:**
```bash
# Start development server
pnpm -F @github-app/backend dev

# Test endpoints with missing credentials
curl -X GET http://localhost:8787/api/installations
# Should return proper error (not mock data)

curl -X GET http://localhost:8787/api/repositories
# Should return proper error when no installations exist

# Test with actual credentials configured
wrangler secret put GITHUB_APP_ID --env development
wrangler secret put GITHUB_WEBHOOK_SECRET --env development
wrangler secret put GITHUB_PRIVATE_KEY_CHUNK_1 --env development
wrangler secret put GITHUB_PRIVATE_KEY_CHUNK_2 --env development

# Re-test endpoints - should work with real GitHub API
curl -X GET http://localhost:8787/api/installations
# Should return actual installations or proper error if none exist
```

### Database Testing
```bash
# Test database operations
cd apps/backend
wrangler d1 execute github-app-dev --command="SELECT * FROM installations"
# Should show real installations, not mock data

# Test repository queries
wrangler d1 execute github-app-dev --command="SELECT * FROM repositories WHERE full_name = 'test/repo'"
# Should return real data or null, not mock repositories
```

### Integration Testing Cases
1. **No Credentials**: Verify proper error responses without fallback to mock data
2. **Invalid Credentials**: Verify GitHub API error handling
3. **Valid Credentials**: Verify real installations and repositories are fetched
4. **Database Unavailable**: Verify proper error handling without mock fallbacks
5. **GitHub API Failures**: Verify appropriate error responses

### Frontend Validation (user steps)
1. Access application with missing backend credentials
2. Verify error messages are displayed appropriately
3. Configure proper credentials and verify installation flow works
4. Test repository access with real GitHub App installations