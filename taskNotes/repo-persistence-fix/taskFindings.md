# Purpose

Fix frontend repository persistence and eliminate redundant API calls in Dashboard component

## Original Ask

"When repo is loaded, there are continuous calls between repo and issues. And after refresh, repo is not being saved in the database"

## Complexity and the reason behind it

Complexity score: **2/5**

**Reasoning:**
- **Frontend State Issue**: Repository selection is not persisted across browser refreshes (localStorage missing)
- **Dual API Calls**: Dashboard component unnecessarily makes two sequential API calls for the same repository
- **Component State Management**: Selected repository state is lost during page navigation/refresh
- Simple frontend fixes - no backend architectural changes needed

## Architectural changes required

**None** - This is purely a frontend state management and API call optimization issue.

## Backend changes required

**None** - The backend is working correctly. The issue is in the frontend component logic.

## Frontend changes required

**Component Fixes (`apps/ui/src/components/`):**

1. **Dashboard.tsx (`lines 24-64`)**:
   - Issue: Makes separate API calls for repository info and issues
   - Fix: Can be optimized but both calls are actually needed for different data
   - Real issue: Calls are triggered on every `parsedRepo` change

2. **RepositoryManager.tsx**: 
   - Issue: No persistence of selected repository
   - Fix: Add localStorage to persist `selectedRepository`

3. **page.tsx (`lines 15-24`)**:
   - Issue: `selectedRepository` state is lost on refresh
   - Fix: Restore repository from localStorage on component mount

**Specific Changes Needed:**

1. **Add Repository Persistence**: Store selected repository in localStorage
2. **Optimize API Calls**: Prevent duplicate API calls in Dashboard useEffect
3. **State Restoration**: Restore selected repository from storage on page load

## Acceptance Criteria

**Functionality Criteria:**
- [ ] Selected repository persists across browser refreshes
- [ ] No unnecessary duplicate API calls in Dashboard component  
- [ ] Repository selection restored from localStorage on page load

**User Experience:**
- [ ] Smooth navigation between repositories
- [ ] Repository selection maintained during browser refresh
- [ ] No performance issues from redundant API calls

## Validation

**Frontend Testing:**  
1. **State Persistence Testing**:
   - Select repository → refresh browser → verify repository remains selected
   - Test localStorage persistence works across browser sessions
   - Verify selected repository restored on page load

2. **Performance Testing**:
   - Check Dashboard component doesn't make redundant API calls
   - Verify useEffect dependencies are optimized
   - Test no unnecessary re-renders cause API call loops

**Commands to run and verify changes:**
```bash
# Frontend testing  
cd apps/ui
pnpm dev
# Navigate to repository, refresh browser, verify state persistence
# Check browser DevTools Network tab for API call patterns
```

**Simple Test Cases:**
1. Select repository → refresh browser → verify repository remains selected
2. Navigate between repositories → verify smooth transitions
3. Check DevTools Network → verify no redundant API calls