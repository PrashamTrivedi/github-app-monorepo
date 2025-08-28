# Gotchas

## Frontend Gotchas

### 1. Next.js Client/Server Component Separation

**Issue**: Cannot export `metadata` from client components in Next.js 14.

**Solution**: Separated layout into server component for metadata and client component for navigation.

```typescript
// ❌ This doesn't work
'use client';
export const metadata: Metadata = { ... }; // Error!

// ✅ This works
// layout.tsx (server component)
export const metadata: Metadata = { ... };

// ClientNavigation.tsx (client component)
'use client';
export function ClientNavigation() { ... }
```

### 2. TypeScript API Response Typing

**Issue**: Generic API responses need proper type casting to avoid TypeScript errors.

**Solution**: Use type assertions for API responses with proper fallbacks.

```typescript
// ❌ This causes TypeScript errors
if (response.success && response.data) {
  setInstallations(response.data); // Type error
}

// ✅ This works
if (response.success && response.data) {
  const installations = response.data as GitHubAppInstallation[];
  setInstallations(installations);
} else {
  setInstallations([]); // Always provide fallback
}
```

### 3. Environment Variable Access in Client Components

**Issue**: Environment variables need proper prefix for client-side access.

**Solution**: Use `NEXT_PUBLIC_` prefix and proper fallbacks.

```typescript
// ✅ Correct client-side environment access
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8787';
const APP_NAME = process.env.NEXT_PUBLIC_GITHUB_APP_NAME || 'your-github-app-name';
```

### 4. Real-time Updates Implementation

**Issue**: WebSocket implementation would be complex for MVP.

**Solution**: Used polling with cleanup for real-time-like updates.

```typescript
useEffect(() => {
  if (operations.some(op => op.status === 'running')) {
    const interval = setInterval(async () => {
      // Poll for updates
    }, 2000);
    
    return () => clearInterval(interval); // Important: cleanup
  }
}, [operations]);
```

### 5. Error Boundary Limitations

**Issue**: Error boundaries don't catch errors in event handlers or async code.

**Solution**: Implemented both error boundaries and try-catch patterns.

```typescript
// Error boundary for render errors
<ErrorBoundary>
  <Component />
</ErrorBoundary>

// Manual error handling for async operations
try {
  await apiCall();
} catch (error) {
  setError(error.message);
}
```

### 6. GitHub App Installation URL Generation

**Issue**: Installation URLs need proper state parameter for return navigation.

**Solution**: Dynamic URL generation with current page state.

```typescript
const getInstallUrl = () => {
  const appName = process.env.NEXT_PUBLIC_GITHUB_APP_NAME || 'your-github-app-name';
  const returnUrl = encodeURIComponent(window.location.origin + window.location.pathname);
  return `https://github.com/apps/${appName}/installations/new?state=${returnUrl}`;
};
```

### 7. Responsive Grid Layouts

**Issue**: Complex grid layouts can break on various screen sizes.

**Solution**: Progressive enhancement with Tailwind responsive utilities.

```typescript
// ✅ Progressive grid enhancement
className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
// Mobile: 1 column, Tablet: 2 columns, Desktop: 3 columns
```

### 8. Loading States Management

**Issue**: Multiple loading states can conflict and create poor UX.

**Solution**: Hierarchical loading states with proper priority.

```typescript
// Application level > Component level > Operation level
if (isLoading) return <PageLoadingSpinner />;
if (componentLoading) return <InlineLoadingSpinner />;
// Only show operation-specific loading for individual actions
```

### 9. API Error Response Handling

**Issue**: Backend API might return different error structures.

**Solution**: Defensive error handling with type guards.

```typescript
const handleApiError = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred';
};
```

### 10. Development vs Production Configuration

**Issue**: Different API endpoints and behavior needed for dev vs prod.

**Solution**: Environment-based configuration with proper fallbacks.

```typescript
// wrangler.jsonc handles environment variables
{
  "vars": {
    "NEXT_PUBLIC_API_BASE_URL": "http://localhost:8787", // Development
    "ENVIRONMENT": "development"
  },
  "env": {
    "production": {
      "vars": {
        "NEXT_PUBLIC_API_BASE_URL": "https://api.production.com",
        "ENVIRONMENT": "production"
      }
    }
  }
}
```

## Important Notes for Future Development

1. **Testing Strategy**: Components are built with testing in mind - isolated, pure functions with clear props
2. **Accessibility**: All components use semantic HTML and proper ARIA attributes
3. **Performance**: Uses Next.js optimization features (static generation, code splitting)
4. **Error Recovery**: Every error state includes user-friendly recovery options
5. **Type Safety**: Strict TypeScript configuration with no `any` types
6. **Responsive Design**: Mobile-first approach with progressive enhancement
7. **API Integration**: Full type safety between frontend and backend with proper error handling
8. **Real-time Features**: Polling-based updates that can be easily upgraded to WebSockets

## Critical Success Factors

1. **Backend Integration**: Frontend works seamlessly with the validated backend API
2. **Error Boundaries**: Comprehensive error handling prevents application crashes
3. **Loading States**: Proper loading indicators for all asynchronous operations
4. **Responsive Design**: Works on all device sizes with touch-friendly interactions
5. **GitHub App Flow**: Complete OAuth installation flow with proper state management
6. **Multi-Repository Support**: Full repository management with search and filtering
7. **Git Operations**: Visual git operation management with real-time status
8. **Settings Management**: Complete app configuration and debugging tools