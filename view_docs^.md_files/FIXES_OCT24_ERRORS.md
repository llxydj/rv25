# Bug Fixes - October 24, 2025

## Issues Fixed

### 1. ✅ Maximum Update Depth Error in `use-realtime-volunteer-locations.ts`

**Problem:**
- Infinite loop caused by improperly memoized functions in useEffect
- Functions were recreating on every render, causing the effect to run continuously
- Error: "Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render."

**Root Cause Analysis:**
The original code had callback functions without proper `useCallback` memoization or with missing dependencies. This caused:
1. Functions to be recreated on every render
2. useEffect to detect "new" functions and re-run
3. Re-running triggered state updates
4. State updates caused re-renders
5. Infinite loop

**Solution:**
Properly memoized all callback functions with correct dependency arrays:

1. **`cleanup`** - Empty deps `[]`
   - Only uses refs and setState (stable)
   - Never needs to recreate

2. **`attemptReconnect`** - Deps: `[reconnectAttempts, reconnectInterval]`
   - Only recreates when reconnection config changes
   - Uses refs and props, no closure over state

3. **`fetchVolunteers`** - Deps: `[center, radiusKm, enabled]`
   - Recreates when search parameters change
   - **This is intentional** - we WANT to refetch when location/radius changes

4. **`setupRealtimeSubscription`** - Deps: `[enabled, cleanup, fetchVolunteers, attemptReconnect]`
   - Recreates when any of its dependencies change
   - **This is intentional** - we WANT to resubscribe when search params change
   - Creates new channel with updated callbacks

5. **Main useEffect** - Deps: `[enabled, cleanup, fetchVolunteers, setupRealtimeSubscription]`
   - Runs when any search parameter changes (via function recreation)
   - Properly cleans up old subscriptions before creating new ones

**Why This Works:**
- Functions form a stable dependency chain
- When `center` or `radiusKm` changes:
  1. `fetchVolunteers` recreates (intentional - uses new params)
  2. `setupRealtimeSubscription` recreates (intentional - needs new fetchVolunteers)
  3. Main effect runs (intentional - sets up new subscription with new params)
  4. Old subscription is cleaned up, new one created
- No infinite loop because the chain only updates when actual props change

**Edge Cases Handled:**
- ✅ Search center changes → Subscription recreated with new location
- ✅ Search radius changes → Subscription recreated with new radius
- ✅ Component unmounts → Cleanup properly removes channel
- ✅ Reconnection → Uses latest config values
- ✅ Multiple rapid changes → Each change triggers proper cleanup + resubscription

---

### 2. ✅ PWA Install Banner Console Messages

**Problem:**
- Console showing: "Banner not shown: beforeinstallpromptevent.preventDefault() called. The page must call beforeinstallpromptevent.prompt() to show the banner."
- This is actually **not an error** - it's a browser informational message indicating that the default browser install banner was prevented (which is correct behavior)
- However, the implementation could be improved with better logging and error handling

**Solution:**
- Enhanced the PWA install prompt with better logging and user feedback
- Added console logs to track the install flow:
  - ✅ When the beforeinstallprompt event is captured
  - ✅ When the user accepts/dismisses the install prompt
  - ✅ When the app is installed successfully
  - ❌ When there are errors
- Improved error handling with user-friendly toast messages
- Added check to prevent showing prompt if user dismissed it in the current session
- Cleaned up deferredPrompt state after installation
- Added better null checks and early returns

**File:** `src/components/pwa-install-prompt-enhanced.tsx`

**Key Improvements:**
1. Better event handling with detailed console logs
2. Session storage check to prevent showing prompt after dismissal
3. Improved error messages for users
4. Proper cleanup of deferredPrompt state
5. More informative toast notifications

**Console Messages Explained:**
- "Banner not shown: beforeinstallpromptevent.preventDefault() called" - This is **NORMAL**. It means:
  - The browser's default install banner was prevented ✅
  - Our custom install prompt is being used instead ✅
  - When the user clicks "Install" in our custom UI, `prompt()` is called ✅

**Note:** These improvements add logging and cleanup, but don't fix any actual installation problems. The PWA installation still requires:
- Valid manifest.json
- Service worker registration
- HTTPS (or localhost)
- Meeting all PWA installability criteria

If the app isn't installable, check these requirements first, not the prompt component.

---

## Testing

To verify the fixes:

### Test 1: Realtime Volunteer Locations
1. Navigate to any page that uses the `useRealtimeVolunteerLocations` hook
2. Check the browser console - there should be **NO** "Maximum update depth exceeded" errors
3. The real-time location updates should work smoothly
4. Connection status should update properly

### Test 2: PWA Install Prompt
1. Open the app in a browser that supports PWA (Chrome, Edge, etc.)
2. Open browser DevTools console
3. Look for console messages:
   - ✅ "beforeinstallprompt event captured" - Event was caught
   - Browser message "Banner not shown..." - This is normal and expected
4. Click the "Install App" button when it appears
5. Should see: ⚙️ "Showing install prompt..."
6. Accept or dismiss the browser's install dialog
7. Should see either:
   - ✅ "User accepted the install prompt" + installation toast
   - ❌ "User dismissed the install prompt"

---

## Summary

Both issues have been resolved:
- ✅ **Infinite loop fixed** - The app will no longer freeze or crash from excessive re-renders
- ✅ **PWA install improved** - Better logging, error handling, and user experience

The console message about the banner is **not an error** - it's the browser confirming that our code is correctly preventing the default banner and using a custom install prompt instead.

---

## Files Modified

1. `src/hooks/use-realtime-volunteer-locations.ts` - Fixed infinite loop
2. `src/components/pwa-install-prompt-enhanced.tsx` - Enhanced PWA install experience

