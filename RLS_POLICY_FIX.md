# RLS Policy Fix for User Management

## 🔍 Problem Identified

The user management system has RLS (Row-Level Security) issues because:

1. **API Route (`/api/admin/users`)**: ✅ Uses `supabaseAdmin` (service role) - **WORKS CORRECTLY**
2. **User Details Page (`/admin/users/[id]`)**: ❌ Was using direct `supabase` client - **FIXED** to use API route
3. **Audit Log Page (`/admin/users/audit`)**: ❌ Uses direct `supabase` client - **NEEDS FIX**

## ✅ Current Status

### Fixed:
- ✅ User Details Page now uses `/api/admin/users` API route (bypasses RLS)
- ✅ Main User Management Page uses `/api/admin/users` API route (bypasses RLS)

### Still Needs Fix:
- ⚠️ Audit Log Page (`/admin/users/audit/page.tsx`) uses direct Supabase queries

## 🔧 Recommended RLS Policies (If You Want to Use Direct Queries)

If you prefer to use direct Supabase queries instead of API routes, you need these RLS policies:

### 1. Allow Admins to Read All Users

```sql
CREATE POLICY "Admins can read all users"
ON public.users
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
);
```

### 2. Allow Users to Read Their Own Data

```sql
CREATE POLICY "Users can read their own data"
ON public.users
FOR SELECT
TO authenticated
USING (id = auth.uid());
```

### 3. Allow Admins to Update User Status

```sql
CREATE POLICY "Admins can update user status"
ON public.users
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
);
```

### 4. Allow Admins to Read System Logs

```sql
CREATE POLICY "Admins can read system logs"
ON public.system_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
);
```

### 5. Allow Service Role Full Access (Already Handled in Code)

The service role (`SUPABASE_SERVICE_ROLE_KEY`) bypasses RLS automatically, so no policy needed.

## 🎯 Current Implementation (Recommended)

**The current implementation using API routes with service role is the BEST approach** because:

1. ✅ **Security**: Service role only runs server-side, never exposed to client
2. ✅ **No RLS Complexity**: Service role bypasses RLS automatically
3. ✅ **Centralized Logic**: All user management logic in one place (`/api/admin/users`)
4. ✅ **Easier to Maintain**: No need to manage complex RLS policies

## 📝 Fixes Applied

1. ✅ **DONE**: Fixed User Details Page (`/admin/users/[id]`) to use API route
2. ✅ **DONE**: Fixed Audit Log Page (`/admin/users/audit`) to use new API route (`/api/admin/users/audit`)
3. ✅ **DONE**: Main User Management (`/admin/users`) already uses API route
4. ✅ **DONE**: Created `/api/admin/users/audit` endpoint using service role

## 🔍 Root Cause Analysis

The issue was **NOT primarily RLS** because:
- The main API route (`/api/admin/users`) already uses `supabaseAdmin` (service role) which bypasses RLS
- The problem was in **client-side pages** using direct `supabase` client queries:
  - ❌ `/admin/users/[id]/page.tsx` - Was using `supabase.from("users").select()` directly
  - ❌ `/admin/users/audit/page.tsx` - Was using `supabase.from("users").select()` and `supabase.from("system_logs").select()` directly

**Solution**: All client-side pages now use API routes that use service role, completely bypassing RLS.

## 🧪 Testing

To verify RLS is working correctly:

1. **Test as Admin**: Should see all users
2. **Test as Resident**: Should only see own profile
3. **Test API Routes**: Should work regardless of RLS (uses service role)

## ⚠️ Important Notes

- The `users` table has a foreign key: `FOREIGN KEY (id) REFERENCES auth.users(id)`
- RLS is ON by default in Supabase
- Service role (`SUPABASE_SERVICE_ROLE_KEY`) bypasses RLS completely
- Regular authenticated clients are subject to RLS policies

## ✅ Verification Checklist

To verify everything is working:

1. **Main User Management Page** (`/admin/users`):
   - ✅ Uses `/api/admin/users` (service role)
   - ✅ Should show all users for admin

2. **User Details Page** (`/admin/users/[id]`):
   - ✅ Now uses `/api/admin/users?all=true` (service role)
   - ✅ Should show user details

3. **Audit Log Page** (`/admin/users/audit`):
   - ✅ Now uses `/api/admin/users/audit` (service role)
   - ✅ Should show audit logs

4. **All API Routes**:
   - ✅ Use `supabaseAdmin` (service role)
   - ✅ Bypass RLS completely
   - ✅ Verify admin role before allowing access

## 🎉 Result

**User Management now works correctly** because:
- All data fetching goes through API routes
- API routes use service role (bypasses RLS)
- No need to create complex RLS policies
- More secure (service role never exposed to client)

