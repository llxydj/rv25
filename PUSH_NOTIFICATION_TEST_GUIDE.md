# 🔔 Push Notification Quick Test Guide

## ✅ How to Verify Everything Works

### Step 1: Check Service Worker Registration
```bash
# Open your browser and navigate to:
http://localhost:3000

# Open DevTools (F12) → Console
# You should see:
[push] Service worker registered
[push] Subscribed to push notifications
[push] Subscription saved to server
```

### Step 2: Verify in Application Tab
```
DevTools → Application Tab → Service Workers
Status: ✅ activated and running
Source: /sw.js
```

### Step 3: Test Notification Permission
When you log in to any panel (Admin/Volunteer/Resident), you should see a browser prompt asking for notification permission. Click "Allow".

### Step 4: Check Database
```sql
-- Run this query in your Supabase SQL editor:
SELECT * FROM push_subscriptions ORDER BY created_at DESC LIMIT 10;

-- You should see your subscription with:
-- - user_id
-- - endpoint (long URL)
-- - p256dh (encryption key)
-- - auth (authentication secret)
-- - subscription (JSONB object)
```

### Step 5: Send Test Notification
```typescript
// From your admin panel, or run this in browser console:
fetch('/api/notifications/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user_ids: ['YOUR_USER_ID'], // Replace with actual user ID
    title: 'Test Notification',
    message: 'This is a test push notification!',
    type: 'info'
  })
})
.then(r => r.json())
.then(console.log)
```

### Step 6: Verify Notification Appears
- Desktop: Notification should appear in top-right corner
- Mobile: Notification should appear in notification tray
- Click notification: Should open the app

---

## 🐛 Troubleshooting

### Issue: Service Worker Not Registering
**Check:**
1. File exists at `public/sw.js` ✅
2. Browser console for errors
3. HTTPS is enabled (or on localhost)

**Solution:**
```javascript
// Clear all service workers and try again
navigator.serviceWorker.getRegistrations()
  .then(registrations => {
    registrations.forEach(r => r.unregister())
  })
  .then(() => location.reload())
```

### Issue: Permission Not Requested
**Check:**
1. User is logged in
2. Browser supports notifications
3. Permission not already denied

**Solution:**
```javascript
// Check current permission status
console.log('Permission:', Notification.permission)

// Request permission manually
Notification.requestPermission().then(console.log)
```

### Issue: Subscription Not Saved
**Check:**
1. API endpoint `/api/notifications/subscribe` is working
2. User has valid session
3. VAPID keys are configured

**Solution:**
```bash
# Check environment variables
echo $NEXT_PUBLIC_VAPID_PUBLIC_KEY
echo $VAPID_PRIVATE_KEY

# Test API endpoint
curl -X POST http://localhost:3000/api/push/vapid-key
# Should return: {"publicKey":"YOUR_PUBLIC_KEY"}
```

### Issue: No Notifications Received
**Check:**
1. Subscription exists in database
2. Service worker is active
3. Browser supports push notifications

**Solution:**
```javascript
// Check if subscribed
pushNotificationService.getSubscription()
  .then(sub => console.log('Subscription:', sub))

// Check service worker status
navigator.serviceWorker.ready
  .then(reg => console.log('SW Ready:', reg))
```

---

## 📱 Testing on Different Devices

### Desktop (Chrome/Edge)
✅ Full support - works perfectly

### Desktop (Firefox)
✅ Full support - works perfectly

### Desktop (Safari)
⚠️ Limited support - may not work on older versions

### Mobile (Android Chrome)
✅ Full support - works in browser and PWA

### Mobile (iOS Safari)
⚠️ Requires iOS 16.4+ and PWA installation

### Testing PWA Mode
1. Open the app in Chrome/Edge
2. Install as PWA (click install icon in address bar)
3. Open installed PWA
4. Service worker should register automatically
5. Test notifications

---

## 🔍 Console Commands for Testing

### Check if service worker is registered
```javascript
navigator.serviceWorker.getRegistration('/sw.js')
  .then(reg => console.log('Registered:', !!reg))
```

### Check current subscription
```javascript
pushNotificationService.getSubscription()
  .then(sub => console.log('Subscription:', sub?.endpoint))
```

### Force re-subscribe
```javascript
pushNotificationService.initialize()
  .then(() => console.log('Initialized!'))
  .catch(console.error)
```

### Show test notification
```javascript
pushNotificationService.showNotification({
  title: 'Test Notification',
  body: 'This is a local test notification',
  icon: '/icons/icon-192x192.png'
})
```

### Check notification permission
```javascript
console.log('Permission:', Notification.permission)
console.log('Supported:', pushNotificationService.isSupported())
```

---

## ✅ Success Indicators

You'll know everything is working when you see:

1. **Console Logs:**
   ```
   [push] Push notifications supported: true
   [push] Service worker registered
   [push] Subscribed to push notifications
   [push] Subscription saved to server
   ```

2. **Application Tab:**
   - Service worker status: **activated and running**
   - Push subscription visible

3. **Database:**
   - New row in `push_subscriptions` table
   - Subscription has valid endpoint and keys

4. **Notification Test:**
   - Notification appears on screen
   - Click notification opens the app

---

## 🎯 Quick Verification Checklist

- [ ] Service worker file exists at `/public/sw.js`
- [ ] Browser console shows no errors
- [ ] Service worker status is "activated and running"
- [ ] Permission prompt appeared and was accepted
- [ ] Subscription saved to database
- [ ] Test notification appears
- [ ] Clicking notification opens the app
- [ ] Works in all user panels (Admin/Volunteer/Resident)
- [ ] Works in PWA mode (if applicable)
- [ ] Offline mode shows cached content

---

## 🚨 If Nothing Works

### Nuclear Option (Reset Everything)
```javascript
// 1. Unregister all service workers
navigator.serviceWorker.getRegistrations()
  .then(regs => Promise.all(regs.map(r => r.unregister())))

// 2. Clear all caches
caches.keys()
  .then(keys => Promise.all(keys.map(k => caches.delete(k))))

// 3. Clear localStorage
localStorage.clear()

// 4. Reload page
location.reload()

// 5. Log in again
// 6. Accept notification permission
```

### Contact Support If...
- Service worker won't register after clearing everything
- VAPID key errors appear
- Database errors when saving subscription
- Notifications work locally but not in production

---

**Need Help?** Check the full report: `PUSH_NOTIFICATION_FIX_REPORT.md`
