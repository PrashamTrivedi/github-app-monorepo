# Purpose

Fix installation validation to properly check GitHub App installation status and return appropriate errors when app is not installed on repositories.

## Original Ask
When checking installation, right now we either do not check from github, or it's not returning any error for the app already installed in a couple of repos.

## Complexity and the reason behind it
Complexity score: 3 out of 5

The complexity is moderate because:
- Need to understand the current installation checking flow across both backend and frontend
- Multiple integration points: GitHub API, database, and UI components
- Requires proper error handling and validation logic
- Frontend needs to handle different installation states gracefully

## Architectural changes required

No major architectural changes required. The existing GitHub App authentication and API integration architecture is sound. However, we need to enhance the validation logic in the installation checking flow.

## Backend changes required

1. **Enhanced Installation Validation in API Routes** (`apps/backend/src/routes/api.ts`)
   - Improve the `/installations` endpoint to properly validate against GitHub API
   - Add better error handling when GitHub API calls fail vs when app is truly not installed
   - Implement proper fallback logic between GitHub API and database sources

2. **Repository Installation Checking** 
   - Add validation function to check if app is installed on specific repositories
   - Enhance repository endpoints to return proper error codes when app is not installed
   - Improve error messages to distinguish between "repository not found" vs "app not installed"

3. **GitHub Auth Library Enhancement** (`apps/backend/src/lib/github-auth.ts`)
   - Add function to validate installation status for specific repositories
   - Improve error handling in `getInstallationRepositories` function
   - Add installation validation before performing operations

## Frontend changes required

1. **InstallationFlow Component** (`apps/ui/src/components/InstallationFlow.tsx`)
   - Better error handling for different installation states
   - Clear messaging when app is not installed vs other errors
   - Improved user guidance for installation process

2. **Repository Management Components**
   - Add installation status checking before allowing repository operations
   - Display appropriate messages when app is not installed on selected repositories
   - Provide clear path for users to install app on additional repositories

## Acceptance Criteria

1. **Backend API Validation**
   - `/installations` endpoint returns accurate installation data from GitHub API
   - Repository endpoints return proper 404 with "app not installed" message when appropriate
   - Clear distinction between "repository not found" and "app not installed" errors

2. **Frontend User Experience**
   - Users see clear messaging when app is not installed on repositories
   - Installation flow guides users through proper app installation
   - Repository operations are blocked with helpful messages when app is not installed

3. **Error Handling**
   - Proper HTTP status codes for different error scenarios
   - Meaningful error messages for debugging and user feedback
   - Graceful fallback when GitHub API is unavailable

## Validation

**Backend Testing:**
- Test `/api/installations` endpoint with and without GitHub credentials
- Test repository endpoints for installed vs non-installed repositories
- Verify proper error codes and messages are returned
- Test fallback behavior when GitHub API is unavailable

**Frontend Testing:**
- Navigate to application with no installations
- Install app on one repository, verify it appears in UI
- Try to access repository operations for non-installed repositories
- Verify installation flow works correctly from GitHub callback

**Commands to run:**
```bash
# Backend testing
pnpm -F @github-app/backend dev
curl http://localhost:8787/api/installations
curl http://localhost:8787/api/repo/owner/non-installed-repo

# Frontend testing  
pnpm -F @github-app/ui dev
# Manual UI testing in browser

# Type checking and linting
pnpm type-check
pnpm lint
```