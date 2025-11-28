# 🔒 SECURITY AUDIT & PIN IMPLEMENTATION PLAN

## **📋 EXECUTIVE SUMMARY**

This document identifies security vulnerabilities in the RVOIS system and provides a comprehensive plan for implementing a 4-digit PIN security feature for PWA users without breaking existing authentication flows.

---

## **🚨 IDENTIFIED SECURITY VULNERABILITIES**

### **1. AUTHENTICATION & AUTHORIZATION**

#### **🔴 CRITICAL:**
- **Missing PIN Enforcement**: PIN system exists but is bypassed (`/api/pin/verify` and `/api/pin/set` return success without validation)
- **Emergency Bypass in Production**: PIN status endpoint creates default PIN "0000" if missing (line 40-54 in `pin/status/route.ts`)
- **No Rate Limiting on PIN Attempts**: PIN verification has no brute-force protection
- **Session Storage for PIN State**: Using `sessionStorage` for PIN unlock state (cleared on tab close, not secure)

#### **🟡 HIGH:**
- **Inconsistent Auth Checks**: Some API routes check `getUser()` but don't verify role properly
- **Missing Role Verification**: Some endpoints rely on RLS but don't double-check on API level
- **Google OAuth State Management**: No explicit state parameter validation in OAuth callback
- **Password Reset Token Security**: No explicit expiration or single-use enforcement visible

#### **🟢 MEDIUM:**
- **Client-Side Role Checks**: Some role-based redirects happen client-side (can be bypassed)
- **Missing CSRF Protection**: No explicit CSRF tokens for state-changing operations
- **Session Timeout**: No explicit session timeout handling

### **2. API SECURITY**

#### **🔴 CRITICAL:**
- **Service Role Key Exposure Risk**: Service role client created in API routes (ensure env vars are secure)
- **No Input Validation on Some Endpoints**: Some routes don't validate input schemas
- **Missing Authorization Headers**: Some API calls don't include proper auth headers

#### **🟡 HIGH:**
- **Rate Limiting Gaps**: Not all endpoints have rate limiting
- **Error Message Leakage**: Some error messages might leak sensitive information

### **3. DATA SECURITY**

#### **🟡 HIGH:**
- **PIN Storage**: PINs are hashed with bcrypt (good), but emergency bypass creates weak default
- **Sensitive Data in Logs**: Console.log statements may log sensitive data
- **RLS Policy Gaps**: Need to verify all tables have proper RLS policies

### **4. CLIENT-SIDE SECURITY**

#### **🟡 HIGH:**
- **LocalStorage Usage**: Some auth tokens stored in localStorage (XSS risk)
- **No Content Security Policy**: No explicit CSP headers visible
- **PWA Security**: Need to ensure service worker doesn't cache sensitive data

---

## **📱 PIN FEATURE IMPLEMENTATION PLAN**

### **PHASE 1: DATABASE & BACKEND PREPARATION**

#### **1.1 Database Schema (Already Exists - Verify)**
```sql
-- Verify these columns exist in users table:
-- pin_hash TEXT (nullable)
-- pin_enabled BOOLEAN DEFAULT true
```

#### **1.2 Create PIN Management Functions**
- ✅ Hash PIN with bcrypt (salt rounds: 10)
- ✅ Verify PIN with bcrypt.compare
- ✅ Rate limit PIN attempts (5 attempts per 15 minutes)
- ✅ Lock account after 10 failed attempts (temporary lockout)

#### **1.3 API Endpoints to Implement/Update**

**`/api/pin/set`** - Set/Update PIN
- ✅ Verify user is authenticated
- ✅ Hash PIN with bcrypt
- ✅ Store in `pin_hash` column
- ✅ Set `pin_enabled = true`
- ✅ Return success

**`/api/pin/verify`** - Verify PIN
- ✅ Verify user is authenticated
- ✅ Check rate limiting (prevent brute force)
- ✅ Compare PIN with bcrypt
- ✅ On success: Set session flag (NOT in sessionStorage)
- ✅ Track failed attempts
- ✅ Lock account after 10 failures

**`/api/pin/status`** - Check PIN Status
- ✅ Return if PIN is enabled
- ✅ Return if PIN is set
- ✅ Return if needs setup
- ❌ **REMOVE EMERGENCY BYPASS** (line 38-54)

**`/api/pin/disable`** - Disable PIN (Optional)
- ✅ Allow user to disable PIN
- ✅ Set `pin_enabled = false`
- ✅ Clear `pin_hash` (optional, for privacy)

**`/api/pin/reset`** - Reset PIN (Admin Only)
- ✅ Admin can reset user's PIN
- ✅ Force PIN setup on next login

### **PHASE 2: FRONTEND IMPLEMENTATION**

#### **2.1 PIN Setup Flow (First Time Login)**

**Location**: After successful authentication, before role-based redirect

**Flow:**
1. User signs in (email/password or Google OAuth)
2. Check PIN status via `/api/pin/status`
3. If `needsSetup: true`:
   - Show PIN setup modal/page
   - Require 4-digit numeric PIN
   - Confirm PIN (enter twice)
   - Submit to `/api/pin/set`
   - On success, continue to dashboard
4. If `needsSetup: false`:
   - Continue to PIN verification

#### **2.2 PIN Verification Flow (Subsequent Logins)**

**Location**: After authentication, before accessing protected routes

**Flow:**
1. User signs in
2. Check PIN status
3. If `enabled: true` and `hasPin: true`:
   - Show PIN entry modal
   - User enters 4-digit PIN
   - Verify via `/api/pin/verify`
   - On success: Set secure session flag
   - On failure: Show error, allow retry (with rate limiting)
4. If `enabled: false`:
   - Skip PIN, go directly to dashboard

#### **2.3 PIN Management (Settings)**

**Location**: User settings page

**Features:**
- Enable/Disable PIN toggle
- Change PIN (requires current PIN)
- View PIN status

### **PHASE 3: INTEGRATION WITH EXISTING AUTH**

#### **3.1 Auth Flow Integration Points**

**A. Email/Password Login** (`src/lib/auth.ts` - `signIn` function)
```typescript
// After successful signIn:
1. Check PIN status
2. If needs setup → redirect to /pin/setup
3. If enabled → redirect to /pin/verify
4. If disabled → continue to role-based redirect
```

**B. Google OAuth Login** (`src/app/auth/callback/route.ts`)
```typescript
// After successful OAuth callback:
1. Check PIN status
2. If needs setup → redirect to /pin/setup?redirect=/resident/dashboard
3. If enabled → redirect to /pin/verify?redirect=/resident/dashboard
4. If disabled → continue to role-based redirect
```

**C. Auth State Change** (`src/lib/auth.ts` - `useAuth` hook)
```typescript
// In onAuthStateChange handler:
// After SIGNED_IN event:
1. Check PIN status
2. If PIN required and not verified → redirect to PIN verification
3. If PIN verified or disabled → continue normal flow
```

#### **3.2 Protected Route Guard**

**Create**: `src/components/pin-guard.tsx`
```typescript
// Wraps protected routes
// Checks if PIN is required and verified
// Redirects to PIN verification if needed
```

#### **3.3 Session Management**

**DO NOT USE:**
- ❌ `sessionStorage` (cleared on tab close, not secure)
- ❌ `localStorage` (XSS vulnerable)

**USE INSTEAD:**
- ✅ HTTP-only cookie (set by server)
- ✅ Server-side session flag in database
- ✅ JWT token with PIN verification claim

**Implementation:**
```typescript
// After PIN verification:
// Set HTTP-only cookie: pin_verified=true (expires in 24 hours)
// Or add claim to JWT: { pin_verified: true, pin_verified_at: timestamp }
```

### **PHASE 4: SECURITY ENHANCEMENTS**

#### **4.1 Rate Limiting**
- Implement rate limiting on PIN verification
- 5 attempts per 15 minutes per user
- Lock account after 10 failed attempts (30-minute lockout)

#### **4.2 Brute Force Protection**
- Track failed attempts in database
- Implement exponential backoff
- Send alert to admin after multiple failures

#### **4.3 PIN Strength**
- Enforce 4-digit numeric (already planned)
- Prevent common PINs (0000, 1234, 1111, etc.)
- Optional: Allow 6-digit for higher security

#### **4.4 Session Security**
- PIN verification valid for 24 hours
- Require re-verification after inactivity (optional)
- Clear PIN session on sign out

---

## **🔧 IMPLEMENTATION CHECKLIST**

### **Backend:**
- [ ] Remove emergency bypass from `/api/pin/status`
- [ ] Implement proper PIN hashing in `/api/pin/set`
- [ ] Implement PIN verification with rate limiting in `/api/pin/verify`
- [ ] Add rate limiting middleware
- [ ] Add failed attempt tracking
- [ ] Add account lockout mechanism
- [ ] Create PIN disable endpoint
- [ ] Add PIN reset endpoint (admin only)

### **Frontend:**
- [ ] Create PIN setup page (`/pin/setup`)
- [ ] Create PIN verification page (`/pin/verify`)
- [ ] Create PIN management component (settings)
- [ ] Integrate PIN check in auth flow
- [ ] Add PIN guard component
- [ ] Update sign-out to clear PIN session
- [ ] Add PIN status indicator

### **Integration:**
- [ ] Update `signIn` function to check PIN
- [ ] Update OAuth callback to check PIN
- [ ] Update `useAuth` hook to handle PIN
- [ ] Add PIN check to protected routes
- [ ] Test with email/password login
- [ ] Test with Google OAuth
- [ ] Test role-based redirects
- [ ] Test PIN enable/disable

### **Security:**
- [ ] Remove emergency bypass
- [ ] Implement rate limiting
- [ ] Add brute force protection
- [ ] Use HTTP-only cookies for PIN session
- [ ] Add PIN attempt logging
- [ ] Test all auth flows
- [ ] Verify no breaking changes

---

## **⚠️ CRITICAL CONSIDERATIONS**

### **1. Don't Break Existing Auth**
- ✅ PIN check happens AFTER authentication
- ✅ PIN is optional (can be disabled)
- ✅ If PIN fails, user is still authenticated (just can't access app)
- ✅ Sign out clears PIN session

### **2. Google OAuth Compatibility**
- ✅ Check PIN status after OAuth callback
- ✅ Handle redirect properly (preserve intended destination)
- ✅ Don't interfere with profile completion flow

### **3. Role-Based Access**
- ✅ PIN verification happens before role check
- ✅ PIN is role-agnostic (all roles can use it)
- ✅ Barangay users excluded (as per current code)

### **4. PWA Considerations**
- ✅ PIN works offline (cached verification)
- ✅ Service worker doesn't cache PIN
- ✅ PIN entry works on mobile devices

### **5. User Experience**
- ✅ PIN setup is one-time (after first login)
- ✅ PIN verification is quick (4 digits)
- ✅ User can disable PIN if desired
- ✅ Clear error messages
- ✅ Helpful instructions

---

## **📝 IMPLEMENTATION ORDER**

1. **Remove Emergency Bypass** (Critical security fix)
2. **Implement Backend PIN APIs** (Proper hashing, verification, rate limiting)
3. **Create PIN Setup Page** (First-time setup)
4. **Create PIN Verification Page** (Subsequent logins)
5. **Integrate with Auth Flow** (Email/password login)
6. **Integrate with OAuth Flow** (Google login)
7. **Add PIN Guard** (Protect routes)
8. **Add PIN Management** (Settings page)
9. **Testing & Security Audit**
10. **Deploy**

---

## **🧪 TESTING SCENARIOS**

### **Test Cases:**
1. ✅ First-time login → PIN setup → Dashboard access
2. ✅ Subsequent login → PIN verification → Dashboard access
3. ✅ Wrong PIN → Error message → Retry (with rate limiting)
4. ✅ Disable PIN → Login without PIN → Dashboard access
5. ✅ Enable PIN → Setup PIN → Verify on next login
6. ✅ Google OAuth → PIN setup → Dashboard access
7. ✅ Google OAuth → PIN verification → Dashboard access
8. ✅ Sign out → Clear PIN session → Login requires PIN again
9. ✅ Rate limiting → 5 failed attempts → Temporary lockout
10. ✅ Role-based redirects → PIN doesn't interfere

---

## **🔐 SECURITY BEST PRACTICES**

1. **Never store PIN in plain text** (use bcrypt)
2. **Rate limit PIN attempts** (prevent brute force)
3. **Use HTTP-only cookies** (prevent XSS)
4. **Log PIN attempts** (audit trail)
5. **Lock account after failures** (brute force protection)
6. **Clear PIN session on sign out** (security)
7. **Don't bypass PIN in production** (remove emergency code)
8. **Validate PIN format** (4 digits, numeric only)
9. **Prevent common PINs** (0000, 1234, etc.)
10. **Test all auth flows** (ensure no breaking changes)

---

## **📊 RISK ASSESSMENT**

### **Implementation Risks:**
- **LOW**: Breaking existing auth (mitigated by careful integration)
- **MEDIUM**: User confusion (mitigated by clear UI/UX)
- **LOW**: Performance impact (minimal, PIN check is fast)
- **MEDIUM**: PWA compatibility (tested thoroughly)

### **Security Risks if NOT Implemented:**
- **HIGH**: Current PIN bypass allows unauthorized access
- **HIGH**: No brute force protection
- **MEDIUM**: Weak default PIN (0000)

---

**Status: 📋 READY FOR IMPLEMENTATION**

**Next Step**: Review this plan, then proceed with Phase 1 (Backend Implementation)

