# 🚨 URGENT FIXES - Run These Now

**Date:** 2025-01-31

---

## ✅ **1. FIXED: Syntax Error in `incident-timeline.ts`**

**Status:** ✅ **FIXED** - No action needed, code is corrected.

The syntax error with nested try-catch blocks has been fixed.

---

## 🔧 **2. FIX RLS POLICY - Run This SQL NOW**

**Problem:** The diagnostic shows a policy "Admins can read all users" with `qual: "(role = 'admin'::user_role)"` - this is checking the **TARGET user's role**, not the **current user's role**!

**This is why:**
- Admins see "Anonymous Reporter"
- Assigned volunteer names are null
- Same issues for volunteers and residents

**Solution:** Run this SQL in Supabase SQL Editor:

```sql
-- File: fix_admin_read_all_users_rls.sql
-- This will:
-- 1. Drop the incorrect policy
-- 2. Ensure is_admin_user() function exists
-- 3. Create correct policy that checks CURRENT user's role (auth.uid())
```

**Action Required:**
1. Open Supabase SQL Editor
2. Copy and paste the contents of `fix_admin_read_all_users_rls.sql`
3. Run it
4. Verify by running diagnostic query #1 again

---

## 📋 **VERIFICATION**

After running the SQL fix, verify with this query:

```sql
-- Check policies on users table
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;
```

**Expected Result:**
- Policy `admin_read_all_users` should have `qual` containing `is_admin_user(auth.uid())` 
- NOT `role = 'admin'::user_role` (that checks target user, not current user)

---

## 🎯 **WHAT THIS FIXES**

After running the SQL:
- ✅ Admins can see reporter names (not "Anonymous")
- ✅ Admins can see assigned volunteer names (not null)
- ✅ Volunteers can see reporter names for assigned incidents
- ✅ Residents can see assigned volunteer names
- ✅ All name display issues resolved

---

**Status:** ✅ **READY TO RUN**

