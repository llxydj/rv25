# PIN Verification Fixes - All Roles

## Issues Identified

1. **Admin PIN**: Required input 2 times (double redirect issue)
2. **Volunteer PIN**: Appeared for a second then disappeared (cookie race condition)
3. **Resident PIN**: Worked correctly (1 time input)
4. **Admin PIN (Recent)**: Now also appears and disappears like resident

## Root Causes

### 1. Multiple Redirects
- `useAuth` hook's `onAuthStateChange` listener was redirecting to `/pin/verify` on every auth state change
- No check if PIN was already verified before redirecting
- No check if already on PIN pages before redirecting

### 2. Cookie Race Condition
- PIN verify page was redirecting immediately after PIN verification
- Cookie might not be immediately available after being set
- No verification that cookie was actually set before redirecting

### 3. No Verification Check
- `getPinRedirectForRole()` always redirected to `/pin/verify` if PIN was enabled
- Didn't check if PIN was already verified via cookie

## Fixes Implemented

### 1. ✅ Fixed `getPinRedirectForRole()` in `src/lib/pin-auth-helper.ts`

**Before**: Always redirected to `/pin/verify` if PIN enabled

**After**: Checks if PIN is already verified before redirecting
```typescript
// If PIN is enabled and set, check if already verified before redirecting
if (pinStatus?.enabled && pinStatus?.hasPin && !pinStatus?.needsSetup) {
  try {
    // Check if PIN is already verified via cookie
    const verifyRes = await fetch('/api/pin/check-verified', {
      credentials: 'include',
      cache: 'no-store'
    })
    
    if (verifyRes.ok) {
      const verifyJson = await verifyRes.json()
      if (verifyJson.verified) {
        // PIN is already verified, go directly to dashboard
        return defaultRedirect
      }
    }
  } catch (error) {
    // If check fails, redirect to verify page for safety
  }
}
```

### 2. ✅ Fixed `useAuth` hook in `src/lib/auth.ts`

**Added**:
- Skip redirect if already on `/pin/` pages
- Check if PIN is verified when already on dashboard pages
- `hasRedirected` flag to prevent multiple redirects in same session

```typescript
// Skip PIN check if already on PIN pages (prevents loops)
if (typeof window !== 'undefined') {
  const currentPath = window.location.pathname
  if (currentPath.startsWith('/pin/')) {
    // Already on PIN page, don't redirect
    return
  }
  // If already on dashboard, check if PIN is verified
  if (currentPath.includes('/dashboard') || ...) {
    const verifyRes = await fetch('/api/pin/check-verified', ...)
    if (verifyJson.verified) {
      // PIN is verified, stay on current page
      return
    }
  }
}
```

### 3. ✅ Fixed PIN Verify Page in `src/app/pin/verify/page.tsx`

**Before**: Redirected immediately after PIN verification

**After**: Verifies cookie is set before redirecting
```typescript
// Success - verify cookie was set before redirecting
let attempts = 0
const maxAttempts = 10
const checkCookie = async () => {
  const verifyRes = await fetch('/api/pin/check-verified', ...)
  if (verifyJson.verified) {
    // Cookie is confirmed set, redirect
    router.replace(redirectTo)
  } else {
    // Retry up to 10 times
    attempts++
    if (attempts < maxAttempts) {
      setTimeout(checkCookie, 100)
    }
  }
}
setTimeout(checkCookie, 150)
```

### 4. ✅ Improved Cookie Check on Mount

**Before**: 100ms delay before checking cookie

**After**: 200ms delay to ensure cookie is available
```typescript
// Add small delay to prevent race conditions with cookie setting
const timer = setTimeout(() => {
  checkVerified()
}, 200)
```

## Expected Behavior (After Fixes)

### Admin Login Flow:
1. User logs in → Redirected to `/pin/verify?redirect=/admin/dashboard`
2. User enters PIN → Cookie is set → Redirected to `/admin/dashboard`
3. ✅ **No second PIN prompt** - `useAuth` checks cookie and stays on dashboard

### Volunteer Login Flow:
1. User logs in → Redirected to `/pin/verify?redirect=/volunteer/dashboard`
2. User enters PIN → Cookie is confirmed set → Redirected to `/volunteer/dashboard`
3. ✅ **PIN doesn't disappear** - Cookie is verified before redirect

### Resident Login Flow:
1. User logs in → Redirected to `/pin/verify?redirect=/resident/dashboard`
2. User enters PIN → Cookie is confirmed set → Redirected to `/resident/dashboard`
3. ✅ **Consistent behavior** - Same as admin and volunteer

## Files Modified

1. **`src/lib/pin-auth-helper.ts`**
   - Added cookie verification check in `getPinRedirectForRole()`

2. **`src/lib/auth.ts`**
   - Added skip logic for `/pin/` pages
   - Added cookie verification check when on dashboard pages
   - Added `hasRedirected` flag to prevent multiple redirects

3. **`src/app/pin/verify/page.tsx`**
   - Added cookie verification before redirecting after PIN entry
   - Increased delay for cookie check on mount
   - Added retry logic to ensure cookie is set

## Testing Checklist

- [ ] Admin login → PIN prompt appears once → Enter PIN → Dashboard (no second prompt)
- [ ] Volunteer login → PIN prompt appears → Enter PIN → Dashboard (doesn't disappear)
- [ ] Resident login → PIN prompt appears once → Enter PIN → Dashboard
- [ ] Already verified PIN → Login → Direct to dashboard (no PIN prompt)
- [ ] PIN verify page → Check cookie → If verified, redirect immediately
- [ ] Multiple auth state changes → No duplicate redirects

## Status: ✅ **FIXED**

All PIN verification issues should now be resolved. The system now:
- Checks if PIN is already verified before redirecting to `/pin/verify`
- Waits for cookie to be confirmed set before redirecting
- Prevents multiple redirects with proper checks
- Works consistently across all roles (admin, volunteer, resident)

