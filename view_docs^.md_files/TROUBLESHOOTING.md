# 🔧 TROUBLESHOOTING GUIDE

## ❌ Issue: "Connection Error: Supabase to PostgreSQL"

### Symptoms:
- Map shows "Connection Error" message
- Volunteer list shows "Loading volunteers..." indefinitely
- Console error: `ENOTFOUND zcgbzbviyaqqplpamcbh.supabase.co`
- API returns 401 errors

### Root Causes:

1. **Missing `.env.local` file**
2. **Incorrect Supabase credentials**
3. **Supabase project is paused** (free tier)
4. **Network connectivity issue**

---

## ✅ Solution Steps:

### Step 1: Create `.env.local` File

1. Copy `.env.example` to `.env.local`:
   ```powershell
   Copy-Item .env.example .env.local
   ```

2. Open `.env.local` and update with your actual Supabase credentials

### Step 2: Get Supabase Credentials

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `zcgbzbviyaqqplpamcbh`
3. Go to **Settings** → **API**
4. Copy the following:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`

### Step 3: Update `.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=https://zcgbzbviyaqqplpamcbh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Step 4: Check if Supabase Project is Active

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Check if project shows "Paused" status
3. If paused, click **"Restore project"** or **"Resume"**
4. Wait 2-3 minutes for project to become active

### Step 5: Restart Development Server

```powershell
# Stop the current server (Ctrl+C)
# Then restart:
pnpm run dev
```

### Step 6: Clear Browser Cache

1. Open DevTools (F12)
2. Right-click refresh button → **"Empty Cache and Hard Reload"**
3. Or use: `Ctrl + Shift + Delete` → Clear cache

---

## 🔍 Verification Steps:

### 1. Check Environment Variables

```powershell
# In PowerShell, run:
node -e "console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)"
```

Should output: `https://zcgbzbviyaqqplpamcbh.supabase.co`

### 2. Test Supabase Connection

Open browser console (F12) and run:
```javascript
fetch('https://zcgbzbviyaqqplpamcbh.supabase.co/rest/v1/')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)
```

Should return API info, not network error.

### 3. Check Network Connectivity

```powershell
# Test DNS resolution
nslookup zcgbzbviyaqqplpamcbh.supabase.co

# Test HTTP connection
curl https://zcgbzbviyaqqplpamcbh.supabase.co
```

---

## 🚨 Common Errors & Fixes:

### Error: `ENOTFOUND zcgbzbviyaqqplpamcbh.supabase.co`

**Cause:** DNS can't resolve Supabase URL

**Fixes:**
1. Check internet connection
2. Try different DNS (Google DNS: 8.8.8.8, Cloudflare: 1.1.1.1)
3. Disable VPN/proxy temporarily
4. Check firewall settings

### Error: `401 Unauthorized`

**Cause:** Invalid or missing API keys

**Fixes:**
1. Verify `NEXT_PUBLIC_SUPABASE_ANON_KEY` is correct
2. Check if key has expired
3. Regenerate keys in Supabase dashboard if needed

### Error: `Connection Error: Supabase to PostgreSQL`

**Cause:** Supabase project is paused or database is down

**Fixes:**
1. Check Supabase dashboard for project status
2. Resume/restore paused project
3. Check Supabase status page: https://status.supabase.com/

### Error: `Loading volunteers...` stuck

**Cause:** Real-time subscription failed

**Fixes:**
1. Check browser console for errors
2. Verify `volunteer_locations` table exists in database
3. Check RLS policies allow reading volunteer locations
4. Ensure user is authenticated and has admin role

---

## 📋 Database Setup Checklist:

If volunteer tracking still doesn't work, verify database setup:

### 1. Check Tables Exist:
- `volunteer_locations`
- `users`
- `incidents`

### 2. Check RLS Policies:

```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'volunteer_locations';

-- Should show: rowsecurity = true
```

### 3. Check View Exists:

```sql
-- Check if view exists
SELECT * FROM active_volunteers_with_location LIMIT 1;
```

If view doesn't exist, create it:

```sql
CREATE OR REPLACE VIEW active_volunteers_with_location AS
SELECT 
  u.id,
  u.first_name,
  u.last_name,
  u.email,
  u.phone_number,
  u.skills,
  vs.status,
  vs.status_message,
  vs.last_activity,
  vl.latitude,
  vl.longitude,
  vl.accuracy,
  vl.created_at as last_location_update
FROM users u
LEFT JOIN volunteer_status vs ON u.id = vs.user_id
LEFT JOIN LATERAL (
  SELECT latitude, longitude, accuracy, created_at
  FROM volunteer_locations
  WHERE user_id = u.id
  ORDER BY created_at DESC
  LIMIT 1
) vl ON true
WHERE u.role = 'volunteer';
```

---

## 🆘 Still Not Working?

1. **Check browser console** (F12) for detailed error messages
2. **Check terminal/server logs** for backend errors
3. **Verify Supabase project is on paid plan** (if using production)
4. **Contact Supabase support** if project won't resume

---

## ✅ Success Indicators:

When everything is working correctly, you should see:

1. ✅ Map loads with Talisay City boundary
2. ✅ Volunteer markers appear on map (if any volunteers are active)
3. ✅ Volunteer list shows count: "Volunteer List (X)"
4. ✅ No "Connection Error" messages
5. ✅ Real-time updates work (volunteers move on map)

---

## 📞 Need Help?

If you're still experiencing issues:

1. Export browser console logs (F12 → Console → Right-click → Save as)
2. Export server terminal logs
3. Check Supabase project logs in dashboard
4. Share error messages for further debugging
