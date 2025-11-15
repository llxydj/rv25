# ✅ Transfer to PM Laptop - Checklist

**Date:** October 27, 2025  
**Project:** RVOIS

---

## 📦 Files to Transfer

### ✅ Required Files (MUST INCLUDE)

```
rv/
├── .next/                    ❌ DO NOT COPY (will be rebuilt)
├── node_modules/             ❌ DO NOT COPY (will be reinstalled)
├── src/                      ✅ COPY
├── public/                   ✅ COPY
├── components/               ✅ COPY
├── hooks/                    ✅ COPY
├── lib/                      ✅ COPY
├── styles/                   ✅ COPY
├── types/                    ✅ COPY
├── supabase/                 ✅ COPY
├── package.json              ✅ COPY (CRITICAL!)
├── pnpm-lock.yaml            ✅ COPY (CRITICAL!)
├── next.config.mjs           ✅ COPY
├── tailwind.config.ts        ✅ COPY
├── tsconfig.json             ✅ COPY
├── .nvmrc                    ✅ COPY
├── .prettierrc               ✅ COPY
├── .gitignore                ✅ COPY
├── SETUP_FOR_PM.md           ✅ COPY (THIS GUIDE!)
└── README.md                 ✅ COPY
```

### ❌ DO NOT Copy

- `node_modules/` - Will be reinstalled
- `.next/` - Will be rebuilt
- `.env.local` - Create new one with keys
- `.git/` - Optional (if using Git)

---

## 🔧 PM Laptop Setup Steps

### Step 1: Prerequisites

- [ ] Install Node.js v22.21.0 (EXACT VERSION)
  - Download: https://nodejs.org/download/release/v22.21.0/
  - Verify: `node -v` shows `v22.21.0`

- [ ] Install pnpm v10.19.0
  ```powershell
  npm install -g pnpm@10.19.0
  ```
  - Verify: `pnpm -v` shows `10.19.0`

### Step 2: Copy Project

- [ ] Copy entire `rv` folder to PM laptop
  - Recommended location: `C:\Users\<PM-Name>\Desktop\rv`
  - **INCLUDE `pnpm-lock.yaml`** (CRITICAL!)

### Step 3: Environment Variables

- [ ] Create `.env.local` file in project root
- [ ] Add these variables (get keys from developer):

```env
NEXT_PUBLIC_SUPABASE_URL=https://zcgbzbviyaqqplpamcbh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<GET FROM DEVELOPER>
SUPABASE_SERVICE_ROLE_KEY=<GET FROM DEVELOPER>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<GET FROM DEVELOPER>
VAPID_PRIVATE_KEY=<GET FROM DEVELOPER>
```

### Step 4: Install Dependencies

```powershell
cd C:\Users\<PM-Name>\Desktop\rv
pnpm install
```

- [ ] Wait for installation (2-5 minutes)
- [ ] Check for errors
- [ ] Verify `node_modules` folder created

### Step 5: Run Development Server

```powershell
pnpm run dev
```

- [ ] Server starts on port 3000
- [ ] No errors in console
- [ ] Open http://localhost:3000
- [ ] Site loads correctly

### Step 6: Test Functionality

- [ ] Login page loads
- [ ] Can log in as resident
- [ ] Can access dashboard
- [ ] Can report incident
- [ ] Can upload photo
- [ ] Incident submits successfully

---

## 🚨 Common Issues & Solutions

### Issue: "Module not found"

**Cause:** Dependencies not installed correctly

**Solution:**
```powershell
Remove-Item node_modules -Recurse -Force
pnpm install
```

### Issue: "Port 3000 already in use"

**Solution:**
```powershell
# Find and kill process
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Issue: Different Next.js version

**Symptom:** Shows Next.js 15.x instead of 14.2.18

**Solution:**
```powershell
# Verify package.json shows "next": "14.2.18"
# Delete lock file and reinstall
Remove-Item pnpm-lock.yaml
pnpm install next@14.2.18
pnpm install
```

### Issue: Authentication errors

**Cause:** Missing or wrong environment variables

**Solution:**
- Check `.env.local` exists
- Verify all keys are correct
- Ask developer for correct keys

---

## 📊 Verification Commands

Run these to verify setup:

```powershell
# Check Node version
node -v
# Should show: v22.21.0

# Check pnpm version
pnpm -v
# Should show: 10.19.0

# Check Next.js version
pnpm list next
# Should show: next@14.2.18

# Check dependencies
pnpm list --depth 0
# Should show all packages

# Build test
pnpm run build
# Should complete without errors
```

---

## 🔄 Keeping in Sync

When developer makes changes:

### Option A: Git (Recommended)

```powershell
git pull
pnpm install
pnpm run dev
```

### Option B: Manual Copy

1. Get updated files from developer
2. Copy to PM laptop (overwrite)
3. Run `pnpm install` (in case dependencies changed)
4. Restart dev server

---

## 📝 Important Notes

### ✅ DO:
- Always use `pnpm` (not npm or yarn)
- Keep `pnpm-lock.yaml` file
- Use exact Node.js version (22.21.0)
- Ask developer for environment variables
- Commit `pnpm-lock.yaml` to Git

### ❌ DON'T:
- Delete `pnpm-lock.yaml`
- Run `pnpm update`
- Use different Node.js version
- Share API keys publicly
- Modify `package.json` versions

---

## 🎯 Success Criteria

Project is working correctly when:

- ✅ `pnpm run dev` starts without errors
- ✅ Site loads at http://localhost:3000
- ✅ Can log in as different user types
- ✅ Can report incidents
- ✅ Can upload photos
- ✅ No console errors
- ✅ Same behavior as developer's machine

---

## 📞 Support

If issues persist:

1. Check this checklist again
2. Verify all versions match
3. Check `.env.local` has all keys
4. Contact developer with:
   - Error messages
   - Screenshots
   - Output of `node -v` and `pnpm -v`
   - Output of `pnpm list next`

---

*Follow this checklist step-by-step for successful transfer!*

**Status: ✅ Ready for Transfer**
