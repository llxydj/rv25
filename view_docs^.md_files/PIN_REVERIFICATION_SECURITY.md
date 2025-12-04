# PIN Re-Verification Security Policy

## Overview
The PIN security system now requires re-verification in specific security scenarios to protect sensitive operations and prevent unauthorized access.

## When PIN Re-Verification is Required

### 1. ✅ **Initial Login** (Always Required)
- **When**: Every time a user logs in
- **Duration**: PIN is valid for **24 hours** after verification
- **Location**: `/pin/verify` page

### 2. ✅ **Inactivity Timeout** (30 Minutes)
- **When**: After **30 minutes of inactivity**
- **How it works**: 
  - System tracks last activity timestamp
  - If no activity for 30 minutes, PIN verification expires
  - User must re-enter PIN to continue
- **Activity tracking**: 
  - Any page navigation or API call updates activity timestamp
  - Calling `/api/pin/check-verified` updates activity
- **Location**: Automatic check on any protected route access

### 3. ✅ **Session Expiration** (24 Hours)
- **When**: After **24 hours** from initial PIN verification
- **How it works**: 
  - PIN verification cookie expires after 24 hours
  - User must re-enter PIN even if active
- **Location**: Automatic check on any protected route access

### 4. ✅ **Sensitive Operations** (Immediate Re-Verification Required)

#### **Password Changes**
- **When**: Before changing password
- **Location**: `src/app/admin/settings/page.tsx` - `handleChangePassword()`
- **Behavior**: 
  - Checks PIN verification before allowing password change
  - If not verified, redirects to `/pin/verify`
  - After password change, requires PIN re-verification

#### **User Deactivation/Deletion** (Admin Only)
- **When**: Before deactivating or deleting a user
- **Location**: `src/app/api/admin/users/route.ts`
- **Behavior**: 
  - Should check PIN verification before allowing action
  - Requires PIN re-verification after action

#### **Admin Settings Changes**
- **When**: Before modifying critical admin settings
- **Behavior**: 
  - PIN verification required for sensitive settings
  - Settings that require PIN:
    - Password changes
    - PIN changes
    - Account deletion
    - Security settings

#### **PIN Changes**
- **When**: Before changing PIN
- **Behavior**: 
  - Requires current PIN verification
  - After PIN change, requires new PIN verification

### 5. ✅ **After Logout**
- **When**: User signs out
- **Behavior**: 
  - All PIN verification cookies are cleared
  - Next login requires PIN entry

### 6. ✅ **User Switch**
- **When**: Different user logs in on same device
- **Behavior**: 
  - Previous user's PIN session is cleared
  - New user must enter PIN

## Implementation Details

### API Endpoints

#### `/api/pin/check-verified` (GET)
- **Purpose**: Check if PIN is currently verified
- **Returns**: 
  ```json
  {
    "verified": true/false,
    "reason": "session_expired" | "inactivity_timeout" | "not_verified",
    "message": "Description of status"
  }
  ```
- **Activity Tracking**: Updates `pin_last_activity` cookie on each call

#### `/api/pin/require-reverify` (POST)
- **Purpose**: Force PIN re-verification for sensitive operations
- **Behavior**: Clears all PIN verification cookies
- **Use Case**: Called before/after sensitive operations

### Configuration

**PIN Session Duration**: 24 hours
- Location: `src/app/api/pin/check-verified/route.ts`
- Constant: `PIN_SESSION_DURATION_HOURS = 24`

**Inactivity Timeout**: 30 minutes
- Location: `src/app/api/pin/check-verified/route.ts`
- Constant: `PIN_INACTIVITY_TIMEOUT_MINUTES = 30`

### Helper Functions

**Location**: `src/lib/pin-security-helper.ts`

#### `checkPinVerified()`
- Checks current PIN verification status
- Returns verification status and reason

#### `requirePinReverify()`
- Forces PIN re-verification
- Clears verification cookies

#### `checkPinBeforeSensitiveOperation(redirectTo?)`
- Checks PIN before sensitive operation
- Redirects to PIN verify if not verified
- Returns `true` if verified, `false` otherwise

#### `updatePinActivity()`
- Updates last activity timestamp
- Should be called during active use

## Security Flow Examples

### Example 1: Password Change
```
1. User clicks "Change Password"
2. System checks: Is PIN verified? (within 30 min activity + 24h session)
3. If NO → Redirect to /pin/verify
4. If YES → Allow password change form
5. User enters current password + new password
6. System verifies current password
7. System updates password
8. System calls /api/pin/require-reverify (clears PIN cookies)
9. User must re-enter PIN on next action
```

### Example 2: Inactivity Timeout
```
1. User logs in → Enters PIN → Active for 25 minutes
2. User leaves computer (no activity)
3. After 30 minutes of inactivity:
   - System checks: Last activity = 30+ minutes ago
   - PIN verification expires
4. User returns and tries to access protected route
5. System redirects to /pin/verify
6. User must re-enter PIN
```

### Example 3: Session Expiration
```
1. User logs in at 9:00 AM → Enters PIN
2. User works actively all day
3. Next day at 9:01 AM (24 hours later):
   - PIN session expires
4. User tries to access protected route
5. System redirects to /pin/verify
6. User must re-enter PIN
```

## Activity Tracking

### How Activity is Tracked
- **Cookie**: `pin_last_activity` (HTTP-only, secure)
- **Updated**: On every call to `/api/pin/check-verified`
- **Updated**: On every page navigation (via middleware/guard)
- **Updated**: On every API call that checks PIN

### Preventing Inactivity Timeout
- System automatically updates activity on:
  - Page navigation
  - API calls that check PIN
  - Any protected route access
- **Manual Update**: Call `updatePinActivity()` from `pin-security-helper.ts`

## Best Practices

### For Developers

1. **Before Sensitive Operations**:
   ```typescript
   import { checkPinBeforeSensitiveOperation } from '@/lib/pin-security-helper'
   
   const handleSensitiveAction = async () => {
     const isVerified = await checkPinBeforeSensitiveOperation()
     if (!isVerified) {
       // User was redirected to PIN verify
       return
     }
     // Proceed with sensitive operation
   }
   ```

2. **After Sensitive Operations**:
   ```typescript
   import { requirePinReverify } from '@/lib/pin-security-helper'
   
   const handlePasswordChange = async () => {
     // ... change password ...
     await requirePinReverify() // Force re-verification
   }
   ```

3. **Activity Tracking**:
   - Activity is automatically tracked
   - No manual intervention needed for normal use
   - Only call `updatePinActivity()` if needed for custom scenarios

## User Experience

### What Users See

1. **PIN Prompt After Inactivity**:
   - Message: "PIN verification required due to inactivity."
   - Redirect to `/pin/verify` page

2. **PIN Prompt Before Sensitive Operations**:
   - Message: "PIN verification required for security. Please verify your PIN first."
   - Redirect to `/pin/verify` page

3. **PIN Prompt After Session Expiration**:
   - Message: "PIN session expired. Please verify again."
   - Redirect to `/pin/verify` page

## Testing Checklist

- [ ] PIN required on initial login
- [ ] PIN expires after 30 minutes of inactivity
- [ ] PIN expires after 24 hours (even if active)
- [ ] PIN required before password change
- [ ] PIN required before user deactivation
- [ ] PIN cleared on logout
- [ ] PIN cleared on user switch
- [ ] Activity tracking updates on page navigation
- [ ] Activity tracking updates on API calls
- [ ] Sensitive operations require PIN verification

## Status: ✅ **IMPLEMENTED**

All PIN re-verification security features are now implemented and active.

