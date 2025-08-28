# Purpose

Debug and fix broken Swagger UI integration that's returning 500 errors from /api-docs endpoint

## Original Ask
PLAN for this. - The current Swagger implementation shows "Failed to load API definition" because the /api-docs endpoint returns HTTP 500 Internal Server Error with just `{}` instead of valid OpenAPI JSON spec.

## Complexity and the reason behind it
Complexity score: 3/5
The issue involves runtime errors in OpenAPI schema compilation with complex TypeScript typing conflicts between Zod schemas and Hono's OpenAPI implementation. Multiple interconnected route files with schema validations are failing to compile properly at runtime.

## Architectural changes required

**Root Cause Analysis:**
1. **Schema Type Conflicts**: The Zod schemas are causing TypeScript compilation issues that translate to runtime errors
2. **OpenAPI Route Definitions**: Complex `openapi()` route configurations are failing during spec generation
3. **Generic Schema Approach**: Using `z.any()` in ApiResponseSchema breaks the OpenAPI spec generation

**Fix Strategy:**
- Simplify OpenAPI integration to use basic functional approach
- Replace complex generic schemas with specific, concrete schemas
- Use incremental approach: start with minimal working implementation, then add complexity

## Backend changes required

### Phase 1: Create Minimal Working Implementation
1. **Simplify main app configuration**:
   - Remove complex route imports temporarily
   - Create simple test OpenAPI route to verify basic functionality
   - Test `/api-docs` endpoint returns valid JSON

2. **Fix schema definitions**:
   - Replace generic `ApiResponseSchema` with specific schemas per endpoint
   - Remove `z.any()` which breaks OpenAPI compilation
   - Create concrete schemas that OpenAPI can properly serialize

3. **Incremental route conversion**:
   - Start with health check endpoint only
   - Add one route group at a time (api -> git -> webhooks)
   - Test `/api-docs` after each addition to isolate failures

### Phase 2: Systematic Route Fixing
1. **API Routes** (`/api/*`):
   - Fix installations endpoint with proper Installation array schema
   - Fix repository endpoint with concrete GitHub repository schema
   - Fix issues endpoint with concrete Issues array schema
   - Fix validate-repo with simple request/response schemas

2. **Git Routes** (`/git/*`):
   - Simplify GitOperation schemas to match database exactly
   - Remove complex union types that break compilation
   - Use basic string/number/boolean types for stability

3. **Webhook Routes** (`/webhooks/*`):
   - Simplify webhook payload to basic object schema
   - Remove complex union types for different webhook events
   - Focus on core functionality over complete schema validation

### Phase 3: Validation & Testing
1. **Verify OpenAPI generation**:
   - Ensure `/api-docs` returns valid OpenAPI 3.0 JSON
   - Test that Swagger UI can parse and display the specification
   - Validate all endpoints appear in Swagger interface

2. **Runtime testing**:
   - Test each endpoint through Swagger UI "Try it out" functionality
   - Verify request validation works correctly
   - Ensure response schemas match actual API responses

## Frontend changes required

None required - this is purely backend API documentation issue

## Acceptance Criteria

1. `/api-docs` endpoint returns valid OpenAPI 3.0.0 JSON specification (not 500 error)
2. Swagger UI loads at `/swagger` without errors and displays all API endpoints
3. All 11 existing endpoints are documented with:
   - Correct HTTP methods and paths
   - Request parameter/body schemas where applicable  
   - Response schemas for success and error cases
   - Proper tags for logical grouping
4. Swagger UI "Try it out" functionality works for at least 3 representative endpoints
5. All existing API functionality remains unchanged (backward compatibility)
6. TypeScript compilation passes without OpenAPI-related errors

## Validation

### Backend API Testing:
1. **OpenAPI Specification Generation**:
   ```bash
   # Test API docs endpoint returns valid JSON
   curl http://localhost:8787/api-docs | jq .
   
   # Validate it's proper OpenAPI spec (should have openapi, info, paths keys)
   curl -s http://localhost:8787/api-docs | jq 'keys'
   ```

2. **Swagger UI Loading**:
   ```bash
   # Test Swagger UI loads without errors  
   curl -s http://localhost:8787/swagger | grep -i "failed\|error" || echo "✅ No errors found"
   ```

3. **Endpoint Documentation**:
   - Navigate to `http://localhost:8787/swagger` in browser
   - Verify all endpoint groups are visible: Health, Installations, Repositories, Git Operations, Webhooks
   - Check each endpoint shows proper method, parameters, and response schemas

4. **Functional Testing**:
   ```bash
   # Test endpoints still work normally
   curl http://localhost:8787/ # Health check
   curl http://localhost:8787/api/installations # API endpoint
   
   # Test request validation (should return 400 for invalid data)
   curl -X POST http://localhost:8787/api/validate-repo -H "Content-Type: application/json" -d '{"invalid":"data"}'
   ```

5. **TypeScript Compilation**:
   ```bash
   cd apps/backend
   pnpm type-check # Should pass without errors
   ```

### Manual browser testing:
1. Open `http://localhost:8787/swagger`
2. Verify Swagger UI loads successfully (no "Failed to load API definition" error)
3. Expand different endpoint groups and verify they show request/response schemas
4. Test "Try it out" functionality on simple endpoints like health check
5. Verify server URL in Swagger reflects current environment