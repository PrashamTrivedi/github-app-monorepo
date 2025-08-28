# Purpose

Integrate Swagger UI documentation and Zod validation for all backend APIs

## Original Ask
Integrate Swagger UI on backend and validate the inputs with Zod. Create two paths `/api-docs` and `/swagger` serving JSON API docs and Swagger UI respectively. Use Hono's Zod OpenAPI support and ensure all current APIs are covered with validation and swagger documentation.

## Complexity and the reason behind it
Complexity score: 4/5 
This requires significant refactoring of existing route handlers to integrate Zod validation schemas, converting from basic Hono routes to Hono OpenAPI routes, setting up proper OpenAPI documentation generation, and ensuring all endpoints maintain backward compatibility while adding comprehensive validation.

## Architectural changes required

- Migrate from basic Hono app to Hono OpenAPI app structure
- Add Zod schema definitions for all request/response types
- Integrate official Hono Swagger UI middleware for serving Swagger UI
- Create OpenAPI spec generator configuration
- Add middleware for automatic validation using Zod schemas

## Backend changes required

### Dependencies to add:
- `@hono/zod-openapi` - Hono's Zod OpenAPI integration
- `@hono/swagger-ui` - Official Hono Swagger UI middleware from honojs/middleware  
- `zod` - Schema validation library

### Route refactoring required:
1. **API Routes (`/api`)** - 4 endpoints:
   - `GET /api/installations` - Add response schema
   - `GET /api/repo/:owner/:repo` - Add path params and response schemas
   - `GET /api/repo/:owner/:repo/issues` - Add path params, query params, and response schemas
   - `POST /api/validate-repo` - Add request body and response schemas

2. **Git Routes (`/git`)** - 5 endpoints:
   - `POST /git/operation` - Add GitOperation request schema and response schema
   - `POST /git/clone` - Add clone request schema and response schema
   - `POST /git/commit` - Add commit request schema and response schema
   - `GET /git/operation/:id` - Add path params and response schema
   - `GET /git/repository/:owner/:name/operations` - Add path params and response schema

3. **Webhook Routes (`/webhooks`)** - 1 endpoint:
   - `POST /webhooks/` - Add webhook payload schemas and response schema

4. **Root Routes** - 1 endpoint:
   - `GET /` - Add health check response schema

### New endpoints to create:
- `GET /api-docs` - Serve OpenAPI JSON specification
- `GET /swagger` - Serve Swagger UI interface

### Schema organization:
- Create `src/schemas/` directory for Zod schemas
- Separate schemas by route groups (api.ts, git.ts, webhooks.ts, common.ts)
- Create reusable common schemas for ApiResponse type

### Configuration updates:
- Update main index.ts to use OpenAPIHono instead of Hono
- Configure OpenAPI metadata (title, version, description)
- Set up automatic server URL detection for different deployment environments

## Frontend changes required

None required - this is purely backend API documentation enhancement

## Acceptance Criteria

1. All existing API endpoints have Zod validation for request/response data
2. All endpoints are documented with proper OpenAPI specifications
3. `/api-docs` endpoint serves complete OpenAPI JSON specification
4. `/swagger` endpoint serves functional Swagger UI with all endpoints
5. Swagger UI works correctly on at least two different ports/addresses locally  
6. All existing functionality remains intact with no breaking changes
7. Request validation automatically returns 400 errors for invalid inputs
8. Response schemas are properly typed and validated
9. OpenAPI spec includes proper error response schemas (400, 401, 404, 500)
10. Server URL in Swagger UI automatically reflects current deployment address

## Validation

### Backend API Testing:
1. **Endpoint functionality**: All existing endpoints return same data as before
2. **Schema validation**: Invalid requests return 400 with proper error messages
3. **Documentation generation**: `/api-docs` returns valid OpenAPI JSON
4. **Swagger UI**: `/swagger` loads and displays all endpoints correctly
5. **Server detection**: Swagger UI shows correct server URL when accessed on different ports

### Test commands to run:
```bash
# Start development server
pnpm -F @github-app/backend dev

# Test API documentation endpoints
curl http://localhost:8787/api-docs
curl http://localhost:8787/swagger

# Test existing endpoints still work
curl http://localhost:8787/api/installations
curl -X POST http://localhost:8787/api/validate-repo -H "Content-Type: application/json" -d '{"url":"https://github.com/user/repo"}'

# Test validation errors
curl -X POST http://localhost:8787/api/validate-repo -H "Content-Type: application/json" -d '{"invalid":"data"}'

# Test on different port if available
wrangler dev --port 8788
# Verify swagger shows correct server URL at localhost:8788
```

### Manual testing:
1. Navigate to `http://localhost:8787/swagger` in browser
2. Verify all endpoints are visible and documented
3. Test API calls directly through Swagger UI interface
4. Test on secondary port and verify server URL updates
5. Validate error responses show proper schema documentation