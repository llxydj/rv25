# 🚀 Setup Guide for PM Laptop

**Last Updated:** October 27, 2025  
**Project:** RVOIS (Resident Volunteer Operations & Incident System)

---

## ⚠️ IMPORTANT: Use Exact Same Versions

This project requires **exact versions** of Node.js and pnpm to work correctly.

---

## 📋 Prerequisites

### 1. **Install Node.js v22.21.0** (EXACT VERSION)

**Download:** https://nodejs.org/download/release/v22.21.0/

**Windows:**
- Download: `node-v22.21.0-x64.msi`
- Run installer
- Verify: `node -v` should show `v22.21.0`

### 2. **Install pnpm v10.19.0** (EXACT VERSION)

```powershell
# Enable script execution
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Install pnpm globally
npm install -g pnpm@10.19.0

# Verify
pnpm -v  # Should show 10.19.0
```

---

## 📦 Project Setup

### Step 1: Get the Project Files

```powershell
# Option A: From Git
git clone <repository-url>
cd rv

# Option B: From USB/Shared Drive
# Copy the entire 'rv' folder to your laptop
cd path\to\rv
```

### Step 2: Install Dependencies

**CRITICAL:** Use the lock file to ensure exact versions!

```powershell
# Make sure you're in the project directory
cd c:\Users\<YourName>\Desktop\rv

# Install dependencies (uses pnpm-lock.yaml)
pnpm install

# This should take 2-5 minutes
```

**DO NOT:**
- ❌ Delete `pnpm-lock.yaml`
- ❌ Delete `node_modules` and reinstall (unless instructed)
- ❌ Run `pnpm update`
- ❌ Use `npm` or `yarn`

### Step 3: Environment Variables

Create a `.env.local` file in the project root:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://zcgbzbviyaqqplpamcbh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ask developer>
SUPABASE_SERVICE_ROLE_KEY=<ask developer>

# Site URL
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Vapid Keys (for push notifications)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<ask developer>
VAPID_PRIVATE_KEY=<ask developer>
```

**Ask the developer for the actual keys!**

### Step 4: Run the Project

```powershell
# Development mode
pnpm run dev

# Open browser to: http://localhost:3000
```

---

## 🔧 Troubleshooting

### Problem: "Module not found" errors

**Solution:**
```powershell
# Delete node_modules and reinstall
Remove-Item node_modules -Recurse -Force
pnpm install
```

### Problem: "Port 3000 already in use"

**Solution:**
```powershell
# Kill the process using port 3000
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Or use a different port
pnpm run dev -- -p 3001
```

### Problem: Different Node.js version

**Solution:**
```powershell
# Check version
node -v

# If wrong version, uninstall and install v22.21.0
# Download from: https://nodejs.org/download/release/v22.21.0/
```

### Problem: "pnpm: command not found"

**Solution:**
```powershell
npm install -g pnpm@10.19.0
```

---

## 📝 Key Files to NEVER Delete

These files ensure consistency:

- ✅ `pnpm-lock.yaml` - Locks dependency versions
- ✅ `package.json` - Defines dependencies
- ✅ `.env.local` - Environment variables
- ✅ `.nvmrc` - Node version specification
- ✅ `next.config.mjs` - Next.js configuration

---

## 🎯 Verification Checklist

After setup, verify everything works:

- [ ] Node.js version: `node -v` shows `v22.21.0`
- [ ] pnpm version: `pnpm -v` shows `10.19.0`
- [ ] Dependencies installed: `node_modules` folder exists
- [ ] Environment variables: `.env.local` file exists
- [ ] Dev server runs: `pnpm run dev` works
- [ ] Site loads: `http://localhost:3000` opens
- [ ] Can log in: Login page works
- [ ] Can report incident: Resident can submit report

---

## 🚀 Production Build

To test production build:

```powershell
# Build the project
pnpm run build

# Start production server
pnpm run start

# Open: http://localhost:3000
```

---

## 📊 Dependency Versions (Locked)

**Critical packages:**
- Next.js: `14.2.18` (NOT 15.x)
- React: `18.3.1`
- React DOM: `18.3.1`
- Supabase SSR: `0.7.0`
- Supabase JS: `latest`

**If you see Next.js 15.x, something is wrong!**

---

## 🔄 Syncing with Developer

When the developer makes changes:

```powershell
# Get latest code
git pull

# Install any new dependencies
pnpm install

# Restart dev server
pnpm run dev
```

---

## 📞 Need Help?

Contact the developer if:
- Dependencies won't install
- Server won't start
- Getting authentication errors
- Any "module not found" errors
- Different behavior than developer's machine

---

## 🎓 Common Commands

```powershell
# Install dependencies
pnpm install

# Run development server
pnpm run dev

# Build for production
pnpm run build

# Run production server
pnpm run start

# Check for TypeScript errors
pnpm run check:types

# Run linter
pnpm run lint

# Clean build cache
pnpm run clean
```

---

## 🔐 Security Notes

**DO NOT:**
- ❌ Commit `.env.local` to Git
- ❌ Share API keys publicly
- ❌ Push to public repository without removing secrets

**DO:**
- ✅ Keep `.env.local` private
- ✅ Use `.env.example` as template
- ✅ Ask developer for production keys

---

*This guide ensures the project works exactly the same on all machines!*

**Status: ✅ Ready for PM Setup**
