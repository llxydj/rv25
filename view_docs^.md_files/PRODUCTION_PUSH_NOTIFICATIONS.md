# 🚀 Production Push Notifications Setup Guide

## ✅ Pre-Deployment Checklist

### 1. Environment Variables (REQUIRED)

Set these in your production hosting platform (Vercel, Netlify, etc.):

```env
# VAPID Keys (REQUIRED - Generate new keys for production!)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_production_public_key_here
VAPID_PRIVATE_KEY=your_production_private_key_here
VAPID_EMAIL=mailto:your-email@example.com  # Optional, defaults to jlcbelonio.chmsu@gmail.com

# Supabase (REQUIRED)
NEXT_PUBLIC_SUPABASE_URL=your_production_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_production_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_production_service_role_key

# App URL (OPTIONAL but recommended)
NEXT_PUBLIC_APP_URL=https://your-production-domain.com
```

### 2. Generate Production VAPID Keys

**IMPORTANT:** Generate NEW VAPID keys for production (don't reuse dev keys):

```bash
npx web-push generate-vapid-keys
```

Copy the output to your production environment variables.

### 3. Service Worker Requirements

- ✅ Service worker file exists at `/public/sw.js`
- ✅ HTTPS is enabled (required for push notifications)
- ✅ Service worker registration checks for HTTPS (already implemented)

### 4. Database Setup

Ensure these tables exist in production:
- ✅ `push_subscriptions` table
- ✅ `notifications` table
- ✅ Database triggers for notifications

## 🔍 Production Verification Steps

### Step 1: Verify Environment Variables

After deployment, check your server logs for:
```
[push] VAPID keys configured successfully
```

If you see:
```
[push] Missing VAPID keys! Push notifications will not work.
```

**Action:** Add VAPID keys to your production environment variables.

### Step 2: Test Service Worker Registration

1. Open your production site in a browser
2. Open DevTools → Application → Service Workers
3. Verify service worker is "activated and running"
4. Check console for: `[sw-register] Service worker registered`

### Step 3: Test Push Subscription

1. Log in as admin in production
2. Navigate to `/admin/push-test`
3. Check status:
   - ✅ Browser Support: Yes
   - ✅ Notification Permission: Granted
   - ✅ Service Worker: Active
   - ✅ Push Subscription: Subscribed
   - ✅ Subscription in DB: Found

### Step 4: Test Incident Reporting

1. Log in as resident in production
2. Report an incident
3. Check server logs for:
   ```
   [push] Looking for subscriptions for X admin(s)
   [push] Found X valid subscription(s) for admins
   [push] ✅ Successfully sent push to admin...
   ```
4. Admin should receive push notification

## 🐛 Production Troubleshooting

### Issue: Push Notifications Not Working

**Check 1: VAPID Keys**
```bash
# In your production environment, verify keys are set:
echo $NEXT_PUBLIC_VAPID_PUBLIC_KEY
echo $VAPID_PRIVATE_KEY
```

**Check 2: HTTPS**
- Push notifications require HTTPS (except localhost)
- Verify your production site uses HTTPS

**Check 3: Service Worker**
- Open DevTools → Application → Service Workers
- Verify service worker is active
- If not, unregister and refresh

**Check 4: Browser Console**
- Check for errors in browser console
- Look for `[push]` prefixed logs

**Check 5: Server Logs**
- Check production server logs for push notification errors
- Look for subscription fetch errors
- Check for webpush send errors

### Issue: "Missing VAPID keys" Error

**Solution:**
1. Generate new VAPID keys: `npx web-push generate-vapid-keys`
2. Add to production environment variables
3. Redeploy application
4. Clear browser cache and re-subscribe

### Issue: Subscriptions Not Found

**Check:**
1. Verify admin has enabled push notifications
2. Check database: `SELECT * FROM push_subscriptions WHERE user_id = 'admin_id'`
3. Verify subscription has valid endpoint and keys

### Issue: Notifications Sent But Not Received

**Check:**
1. Browser notification permission (Settings → Site Settings → Notifications)
2. Service worker is active
3. Browser is not in "Do Not Disturb" mode
4. Check browser console for service worker errors

## 📋 Post-Deployment Verification

Run these checks after deployment:

- [ ] VAPID keys are set in production environment
- [ ] Service worker registers successfully
- [ ] Admin can subscribe to push notifications
- [ ] Test notification works (`/admin/push-test`)
- [ ] Resident reporting incident triggers admin push notification
- [ ] Push notifications appear in browser
- [ ] Clicking notification opens correct page
- [ ] Works on mobile browsers
- [ ] Works in PWA mode (if applicable)

## 🔄 Updating VAPID Keys

If you need to update VAPID keys:

1. Generate new keys: `npx web-push generate-vapid-keys`
2. Update environment variables in production
3. Redeploy application
4. **Important:** Users need to re-subscribe after VAPID key change
   - Clear existing subscriptions: `DELETE FROM push_subscriptions`
   - Users will need to enable notifications again

## 📊 Monitoring

Monitor these in production:

1. **Push Notification Success Rate**
   - Check server logs for success/failure counts
   - Monitor expired subscriptions (410 errors)

2. **Subscription Count**
   - Track active subscriptions: `SELECT COUNT(*) FROM push_subscriptions`

3. **Error Rates**
   - Monitor webpush errors
   - Track subscription fetch errors

## 🎯 Production Best Practices

1. **Use Production VAPID Keys**
   - Never reuse development keys in production
   - Keep keys secure (never commit to git)

2. **Monitor Expired Subscriptions**
   - Code automatically removes expired subscriptions (410 errors)
   - Monitor cleanup in logs

3. **Test After Deployment**
   - Always test push notifications after deployment
   - Use `/admin/push-test` page for verification

4. **HTTPS Required**
   - Push notifications only work over HTTPS
   - Ensure production site uses HTTPS

5. **Error Handling**
   - Push notification failures don't break incident creation
   - Errors are logged but don't affect user experience

## ✅ Success Indicators

You'll know push notifications are working in production when:

1. ✅ Service worker registers on production site
2. ✅ Admin can subscribe via `/admin/push-test`
3. ✅ Test notification appears in browser
4. ✅ Resident incident report triggers admin push notification
5. ✅ Admin receives notification without page refresh
6. ✅ Clicking notification opens correct incident page

---

**Last Updated:** November 27, 2025
**Status:** Production Ready ✅

