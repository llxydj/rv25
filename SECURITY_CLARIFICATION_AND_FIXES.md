# Security Clarification & Critical Fixes

## Direct Answers to Your Questions

### 1. Google OAuth Token Revocation - Metadata-Based
**Answer: NO** - Metadata-based revocation alone does NOT guarantee prevention.

**Current Protection:**
- ✅ Auth callback checks user status and blocks deactivated users
- ✅ `useAuth` hook checks status and signs out deactivated users
- ⚠️ **Gap**: If user has cached Google session token, they might access until callback/refresh runs

**Fix Needed:** Add middleware check + better session invalidation

---

### 2. Session Invalidation by Password Update
**Answer: PARTIAL** - Works for email/password users, NOT for OAuth-only users.

**Current Protection:**
- ✅ Auth callback blocks deactivated users
- ✅ `useAuth` hook blocks deactivated users
- ⚠️ **Gap**: Password update doesn't affect OAuth sessions

**Fix Needed:** Use Supabase's `banUser` or delete auth user for hard delete

---

### 3. Soft Delete → Hard Delete (30-day recovery)
**Answer: NO** - No automatic job. Manual only.

**Fix Needed:** Add scheduled job or manual cleanup process

---

### 4. Recovery Process
**Answer: YES** - Google OAuth will work after recovery, but user may need to re-authenticate if tokens were revoked.

---

### 5. Edge Case Testing
**Answer: NO** - Not tested. Code implemented but not verified with live Google OAuth deactivation.

**Fix Needed:** Test the exact scenario before production

---

## Critical Fixes Required

### Fix 1: Proper OAuth Session Invalidation
**Problem:** Password update doesn't invalidate OAuth sessions.

**Solution:** For deactivated users, we should:
1. Keep password update (for email users)
2. Add `app_metadata.disabled = true` (Supabase checks this)
3. For hard delete: Delete from Supabase Auth completely

### Fix 2: Middleware Check
**Problem:** Cached sessions might bypass checks.

**Solution:** Add status check in middleware before allowing any route access.

### Fix 3: Automatic Hard Delete Job
**Problem:** No automatic cleanup after 30 days.

**Solution:** Add scheduled job or manual process documentation.

---

## Recommended Implementation

1. **For Deactivate:** Use `app_metadata.disabled = true` (Supabase respects this)
2. **For Hard Delete:** Delete from Supabase Auth completely
3. **Add Middleware Check:** Verify user status in middleware
4. **Test Before Production:** Verify deactivated Google user cannot login

