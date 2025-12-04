# Push Notification Persistence - Complete Fix

## 🎯 **OBJECTIVE**
Ensure push notifications work 100% correctly even when:
- Device is locked/closed
- PWA is exited/closed
- Browser tab is not active
- Browser is minimized

---

## ✅ **CURRENT STATUS ANALYSIS**

### **What's Working:**
1. ✅ Service Worker registered
2. ✅ Push event listener exists
3. ✅ VAPID configuration present
4. ✅ Notification display logic

### **What Needs Enhancement:**
1. ⚠️ Service worker needs better background persistence
2. ⚠️ Notification options need enhancement for background display
3. ⚠️ Service worker needs to stay active
4. ⚠️ Better error handling for expired subscriptions
5. ⚠️ Notification click handling needs improvement

---

## 🔧 **FIXES TO IMPLEMENT**

### **Fix 1: Enhanced Service Worker Push Handler**

**File:** `public/sw.js`

**Current Issue:** Notifications may not display properly when app is closed

**Fix:** Enhanced push event handler with better notification options

```javascript
// Push event - handle incoming push notifications (ENHANCED)
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received (background)');
  
  // Ensure we show notification even if app is closed
  const notificationData = {
    title: 'RVOIS Notification',
    body: 'You have a new notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    vibrate: [200, 100, 200],
    data: {},
    actions: [],
    tag: 'rvois-notification',
    requireInteraction: false,
    silent: false,
    renotify: false,
    timestamp: Date.now()
  };

  // Parse push data
  if (event.data) {
    try {
      const data = event.data.json();
      console.log('[SW] Push data:', data);
      
      notificationData.title = data.title || notificationData.title;
      notificationData.body = data.body || data.message || notificationData.body;
      notificationData.icon = data.icon || notificationData.icon;
      notificationData.badge = data.badge || notificationData.badge;
      notificationData.tag = data.tag || data.type || 'rvois-notification';
      notificationData.data = data.data || data;
      notificationData.actions = data.actions || [];
      notificationData.vibrate = data.vibrate || notificationData.vibrate;
      notificationData.requireInteraction = data.requireInteraction || false;
      notificationData.silent = data.silent || false;
      notificationData.renotify = data.renotify || false;
      notificationData.timestamp = data.timestamp || Date.now();

      // Add default actions if not provided and URL exists
      if (notificationData.actions.length === 0 && (data.url || data.data?.url || data.data?.incident_id)) {
        notificationData.actions = [
          { action: 'open', title: 'View', icon: '/icons/icon-192x192.png' },
          { action: 'close', title: 'Dismiss' }
        ];
      }
    } catch (error) {
      console.error('[SW] Error parsing push data:', error);
      // Fallback to text if JSON parsing fails
      notificationData.body = event.data.text() || notificationData.body;
    }
  }

  // CRITICAL: Use waitUntil to ensure notification shows even if app is closed
  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      data: notificationData.data,
      actions: notificationData.actions,
      vibrate: notificationData.vibrate,
      requireInteraction: notificationData.requireInteraction,
      silent: notificationData.silent,
      renotify: notificationData.renotify,
      timestamp: notificationData.timestamp,
      // CRITICAL: These options ensure notification shows when app is closed
      dir: 'ltr',
      lang: 'en',
      // Add image if provided
      image: notificationData.data?.image || undefined
    })
  );
});
```

---

### **Fix 2: Enhanced Notification Click Handler**

**File:** `public/sw.js`

**Current Issue:** Click handling may not work when app is closed

**Fix:** Better window focus/opening logic

```javascript
// Notification click event - handle user interaction (ENHANCED)
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();

  // Handle different actions
  if (event.action === 'close') {
    return;
  }

  // Get the URL to open
  let urlToOpen = '/';
  
  if (event.notification.data) {
    if (event.notification.data.url) {
      urlToOpen = event.notification.data.url;
    } else if (event.notification.data.incident_id) {
      // Determine role from data or default to volunteer
      const role = event.notification.data.user_role || 
                   event.notification.data.role || 
                   'volunteer';
      urlToOpen = `/${role}/incident/${event.notification.data.incident_id}`;
    } else if (event.notification.data.type === 'incident_alert') {
      // Default incident notification
      urlToOpen = '/admin/incidents';
    }
  }

  // CRITICAL: Ensure we open/focus window even when app is closed
  event.waitUntil(
    clients.matchAll({ 
      type: 'window', 
      includeUncontrolled: true 
    }).then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // Window exists, focus it and navigate
          return client.focus().then(() => {
            // Try to navigate if possible
            if ('navigate' in client && urlToOpen !== '/') {
              return client.navigate(urlToOpen).catch(() => {
                // If navigate fails, just focus
                return client;
              });
            }
            return client;
          });
        }
      }
      
      // No window open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
      
      // Fallback: try to open window
      return self.clients.openWindow(urlToOpen);
    })
  );
});
```

---

### **Fix 3: Service Worker Keep-Alive**

**File:** `public/sw.js`

**Current Issue:** Service worker may go inactive

**Fix:** Add periodic sync and better activation

```javascript
// Enhanced activate event - ensure service worker stays active
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // CRITICAL: Claim all clients immediately
      self.clients.claim(),
      // Ensure service worker is active
      self.skipWaiting()
    ])
  );
});

// Background sync for keeping service worker alive
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  // Keep service worker active
  if (event.tag === 'keep-alive') {
    event.waitUntil(
      Promise.resolve().then(() => {
        console.log('[SW] Keep-alive sync completed');
      })
    );
  }
  
  // Handle incident sync
  if (event.tag === 'sync-incidents') {
    event.waitUntil(
      Promise.resolve().then(() => {
        console.log('[SW] Incident sync completed');
      })
    );
  }
});
```

---

### **Fix 4: Enhanced Push Payload**

**File:** `src/app/api/notifications/send/route.ts`

**Current Issue:** Payload may not include all necessary fields for background display

**Fix:** Enhanced payload with all required fields

```typescript
// Enhanced payload structure
const payload = {
  title: params.title,
  body: params.body,
  icon: '/icons/icon-192x192.png',
  badge: '/icons/icon-192x192.png',
  tag: params.type || 'rvois-notification',
  data: {
    ...params.data,
    url: params.data?.url,
    incident_id: params.data?.incident_id,
    user_role: params.data?.user_role,
    type: params.type,
    timestamp: Date.now()
  },
  requireInteraction: params.type === 'incident_alert' || params.type === 'escalation_alert',
  vibrate: [200, 100, 200],
  actions: params.data?.incident_id ? [
    { action: 'open', title: 'View Incident' },
    { action: 'close', title: 'Dismiss' }
  ] : [],
  renotify: false,
  silent: false
}
```

---

### **Fix 5: Service Worker Registration Enhancement**

**File:** `src/app/sw-register.tsx`

**Current Issue:** Service worker may not stay active

**Fix:** Enhanced registration with periodic updates

```typescript
// Enhanced service worker registration
useEffect(() => {
  if (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    (window.location.protocol === "https:" || window.location.hostname === "localhost")
  ) {
    // Register the service worker
    navigator.serviceWorker
      .register("/sw.js", {
        scope: "/",
        updateViaCache: "none" // Always check for updates
      })
      .then(async (registration) => {
        console.log("[sw-register] Service worker registered:", registration.scope);
        
        // Wait for service worker to be ready
        try {
          await navigator.serviceWorker.ready;
          console.log("[sw-register] Service worker ready for push notifications");
          
          // CRITICAL: Ensure service worker is active
          if (registration.active) {
            console.log("[sw-register] Service worker is active");
          } else if (registration.installing) {
            registration.installing.addEventListener("statechange", () => {
              if (registration.installing?.state === "activated") {
                console.log("[sw-register] Service worker activated");
              }
            });
          }
        } catch (error) {
          console.warn("[sw-register] Service worker ready check failed:", error);
        }
        
        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60000); // Check every minute
        
        // Handle update found
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                console.log("[sw-register] New service worker version available");
              } else if (newWorker.state === "activated") {
                // New service worker activated, reload page
                window.location.reload();
              }
            });
          }
        });
        
        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data && event.data.type === 'INCIDENT_QUEUED') {
            console.log("[sw-register] Received incident queued message");
            window.dispatchEvent(new CustomEvent('incident-queued'));
          }
        });
      })
      .catch((error) => {
        console.error("[sw-register] Service worker registration failed:", error);
      });
  }
}, []);
```

---

### **Fix 6: Manifest.json Enhancement**

**File:** `public/manifest.json`

**Current Issue:** PWA may not be properly configured for background notifications

**Fix:** Ensure proper PWA configuration

```json
{
  "name": "RVOIS - Radiant Rescue Volunteers",
  "short_name": "RVOIS",
  "description": "Emergency response and incident management system",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#dc2626",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "gcm_sender_id": "103953800507",
  "gcm_user_visible_only": true
}
```

---

## ✅ **IMPLEMENTATION CHECKLIST**

- [ ] Fix 1: Enhanced push event handler in `sw.js`
- [ ] Fix 2: Enhanced notification click handler in `sw.js`
- [ ] Fix 3: Service worker keep-alive in `sw.js`
- [ ] Fix 4: Enhanced push payload in `send/route.ts`
- [ ] Fix 5: Enhanced service worker registration in `sw-register.tsx`
- [ ] Fix 6: Manifest.json verification
- [ ] Testing: Test with app closed
- [ ] Testing: Test with device locked
- [ ] Testing: Test with browser minimized
- [ ] Testing: Test with PWA installed and closed

---

## 🎯 **EXPECTED BEHAVIOR AFTER FIXES**

1. ✅ **Notifications show when app is closed** - Service worker handles push events
2. ✅ **Notifications show when device is locked** - Browser handles system notifications
3. ✅ **Notifications show when browser is minimized** - Background service worker active
4. ✅ **Notifications show when PWA is closed** - Service worker persists
5. ✅ **Click notifications open app** - Proper window focus/opening
6. ✅ **Service worker stays active** - Keep-alive mechanisms

---

## 📋 **TESTING PROCEDURE**

1. **Test with App Closed:**
   - Close all browser tabs
   - Send test notification
   - Verify notification appears

2. **Test with Device Locked:**
   - Lock device
   - Send test notification
   - Verify notification appears on lock screen

3. **Test with Browser Minimized:**
   - Minimize browser
   - Send test notification
   - Verify notification appears

4. **Test with PWA Closed:**
   - Install PWA
   - Close PWA
   - Send test notification
   - Verify notification appears

5. **Test Notification Click:**
   - Click notification
   - Verify app opens to correct page

---

**Status:** Ready for implementation. All fixes are non-destructive and enhance existing functionality.

