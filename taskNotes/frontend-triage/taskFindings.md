# Purpose

Triage and fix frontend issues including progress bar loading state and missing dark theme functionality

## Original Ask
Triage current frontend. Already running on localhost 3000. The site doesn't go beyond progressbar, doesn't have dark theme

## Complexity and the reason behind it
Complexity score: **2/5**
- **Progress bar issue**: Actually normal behavior (1/5 complexity)
- **Dark theme issue**: Missing configuration but straightforward fix (2/5 complexity)
- No complex state management or architectural changes required
- Mainly configuration and UI implementation work

## Architectural changes required

No major architectural changes required. This is primarily a configuration and feature completion task:
- Add theme provider context for dark mode state management
- Implement theme persistence using localStorage
- Update layout structure to support dynamic theming

## Backend changes required

None required. Backend API is working correctly:
- `/api/installations` endpoint returning proper responses
- CORS configured properly for frontend communication
- Database queries working as expected

## Frontend changes required

### 1. Progress Bar Issue Resolution
**Status**: No action needed - this is correct behavior
- App correctly shows loading spinner while fetching installations
- When no installations exist, it displays installation flow
- User needs to install GitHub App to proceed past this step

### 2. Dark Theme Implementation

**Required Changes**:

1. **Tailwind Configuration** (`apps/ui/tailwind.config.ts`):
   ```typescript
   const config: Config = {
     darkMode: 'class', // Add this line
     // ... existing config
   }
   ```

2. **Theme Provider** (`src/contexts/ThemeContext.tsx`):
   - Create React context for theme state
   - Implement localStorage persistence
   - System preference detection

3. **Layout Updates** (`src/app/layout.tsx`):
   - Remove hardcoded `bg-gray-50` 
   - Add dynamic theme classes
   - Integrate theme provider

4. **Navigation Enhancement** (`src/app/ClientNavigation.tsx`):
   - Add dark mode toggle button
   - Update navigation styling for dark theme

5. **Component Updates**:
   - Verify all existing `dark:` classes work correctly
   - Update any missing dark mode styles

## Acceptance Criteria

Not applicable - complexity score is 2/5

## Validation

### Progress Bar Issue:
1. **Current State Verification**:
   - Confirm API call to `/api/installations` returns `{"success":true,"data":[]}`
   - Verify loading spinner displays correctly
   - Check that installation flow appears when no installations exist

2. **Expected Behavior**:
   - Install a GitHub App to test full flow
   - Verify transition from loading → installation → repositories → dashboard

### Dark Theme Implementation:
1. **Configuration Testing**:
   ```bash
   # After updating tailwind.config.ts
   cd apps/ui
   pnpm run build
   ```

2. **Functionality Testing**:
   - Manually add `dark` class to `<html>` element in browser dev tools
   - Verify dark theme styles activate across all components
   - Test theme toggle functionality
   - Verify localStorage persistence

3. **User Experience Testing**:
   - Toggle between light/dark themes
   - Refresh page and verify theme persists
   - Test system preference detection (if implemented)

### Commands to Run:
```bash
# Development testing
cd apps/ui
pnpm dev

# Build testing
pnpm build

# Type checking
pnpm type-check

# Linting
pnpm lint
```

### Test Cases:
1. **Theme Toggle**: Click dark mode button → verify UI switches to dark
2. **Persistence**: Refresh page → verify theme remains the same
3. **System Preference**: Set OS to dark mode → verify app respects setting (optional)
4. **Component Coverage**: Check all major components render properly in both themes
5. **Navigation**: Verify breadcrumbs and navigation work in both themes