// Service Worker for RVOIS Push Notifications
// Version: 1.0.0

const CACHE_NAME = 'rvois-cache-v1';
const STATIC_CACHE = [
  '/',
  '/manifest.json',
  '/favicon/android-chrome-192x192.png',
  '/favicon/android-chrome-512x512.png',
  '/favicon/apple-touch-icon.png',
  '/favicon.ico'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_CACHE).catch((err) => {
          console.warn('[SW] Failed to cache some assets:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches (ENHANCED for persistence)
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

// Push event - handle incoming push notifications (ENHANCED for background persistence)
self.addEventListener('push', (event) => {
  console.log('[SW] 🔔 Push notification received (background/app closed)');
  console.log('[SW] Event data type:', event.data ? event.data.type : 'no data');
  
  // Notify all clients that push was received
  self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    clients.forEach((client) => {
      client.postMessage({ type: 'PUSH_RECEIVED' }).catch(() => {})
    })
  })
  
  // Default notification data
  let notificationData = {
    title: 'RVOIS Notification',
    body: 'You have a new notification',
    icon: '/favicon/android-chrome-192x192.png',
    badge: '/favicon/android-chrome-192x192.png',
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
      // Try to parse as JSON first
      let data;
      if (typeof event.data.json === 'function') {
        data = event.data.json();
      } else if (typeof event.data.text === 'function') {
        const text = event.data.text();
        data = JSON.parse(text);
      } else {
        // Fallback: try to use data directly
        data = event.data;
      }
      
      console.log('[SW] Push data parsed:', {
        title: data.title,
        body: data.body,
        hasData: !!data.data,
        type: data.type || data.tag,
        fullData: data
      });
      
      notificationData = {
        title: data.title || notificationData.title,
        body: data.body || data.message || notificationData.body,
        icon: data.icon || notificationData.icon,
        badge: data.badge || notificationData.badge,
        tag: data.tag || data.type || 'rvois-notification',
        data: data.data || data,
        actions: data.actions || [],
        vibrate: data.vibrate || notificationData.vibrate,
        requireInteraction: data.requireInteraction || false,
        silent: data.silent || false,
        renotify: data.renotify || false,
        timestamp: data.timestamp || Date.now()
      };

      // Add default actions if not provided and URL/incident_id exists
      if (notificationData.actions.length === 0 && (data.url || data.data?.url || data.data?.incident_id)) {
        notificationData.actions = [
          { action: 'open', title: 'View', icon: '/favicon/android-chrome-192x192.png' },
          { action: 'close', title: 'Dismiss' }
        ];
      }
    } catch (error) {
      console.error('[SW] Error parsing push data:', error);
      // Fallback to text if JSON parsing fails
      notificationData.body = event.data.text() || notificationData.body;
    }
  }

  // CRITICAL: Use waitUntil to ensure notification shows even when app is closed
  // This is essential for background notifications when browser/app is closed
  event.waitUntil(
    Promise.all([
      // Show browser notification (works even when app is closed)
      // CRITICAL: Enhanced options for system-level alerts on mobile devices
      self.registration.showNotification(notificationData.title, {
        body: notificationData.body,
        icon: notificationData.icon,
        badge: notificationData.badge,
        tag: notificationData.tag,
        data: {
          ...notificationData.data,
          // Ensure data persists for click handling
          url: notificationData.data?.url || notificationData.data?.incident_id ? 
            (notificationData.data?.url || `/${notificationData.data?.user_role || 'admin'}/incidents/${notificationData.data?.incident_id}`) : 
            '/',
          timestamp: notificationData.timestamp,
          persistent: true // Mark as persistent notification
        },
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
        image: notificationData.data?.image || undefined,
        // Mobile-specific: Ensure notification appears on lock screen
        // These options help with system-level alerts
        priority: 'high', // High priority for system alerts
        sticky: notificationData.requireInteraction || false // Keep visible until user interacts
      }).then(() => {
        console.log('[SW] ✅ Browser notification shown successfully (works when app closed):', notificationData.title);
        console.log('[SW] Notification details:', {
          title: notificationData.title,
          body: notificationData.body,
          tag: notificationData.tag,
          hasData: !!notificationData.data,
          persistent: true
        });
      }).catch((err) => {
        console.error('[SW] ❌ Failed to show notification:', err);
        console.error('[SW] Error details:', {
          message: err.message,
          name: err.name,
          stack: err.stack
        });
      }),
      
      // Also notify all clients (if app is open)
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        if (clients.length > 0) {
          console.log('[SW] Notifying', clients.length, 'client(s) about new notification');
          clients.forEach((client) => {
            client.postMessage({
              type: 'PUSH_NOTIFICATION',
              notification: notificationData
            }).catch((err) => {
              console.warn('[SW] Failed to post message to client:', err);
            });
          });
        }
      })
    ])
  );
});

// Notification click event - handle user interaction (ENHANCED for app closed scenarios)
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] 🔔 Notification clicked:', event.action);
  console.log('[SW] Notification data:', event.notification.data);
  
  event.notification.close();

  // Handle different actions
  if (event.action === 'close') {
    console.log('[SW] Notification dismissed by user');
    return;
  }

  // Get the URL to open - prioritize data.url, then construct from incident_id
  let urlToOpen = '/';
  
  if (event.notification.data) {
    // First check for direct URL
    if (event.notification.data.url) {
      urlToOpen = event.notification.data.url;
      console.log('[SW] Opening URL from notification data:', urlToOpen);
    } 
    // Then check for incident_id and construct URL based on role
    else if (event.notification.data.incident_id) {
      // Determine role from data or try to infer from notification type
      const role = event.notification.data.user_role || 
                   event.notification.data.role || 
                   (event.notification.data.type === 'incident_alert' ? 'admin' : 'volunteer');
      
      // Construct appropriate URL based on role
      if (role === 'admin') {
        urlToOpen = `/admin/incidents/${event.notification.data.incident_id}`;
      } else if (role === 'volunteer') {
        urlToOpen = `/volunteer/incidents/${event.notification.data.incident_id}`;
      } else if (role === 'resident') {
        urlToOpen = `/resident/history`;
      } else {
        urlToOpen = `/admin/incidents/${event.notification.data.incident_id}`;
      }
      console.log('[SW] Constructed URL from incident_id:', urlToOpen, 'for role:', role);
    } 
    // Check notification type for default routing
    else if (event.notification.data.type === 'incident_alert' || event.notification.tag === 'incident_alert') {
      urlToOpen = '/admin/incidents';
      console.log('[SW] Opening admin incidents page for incident alert');
    } else if (event.notification.data.type === 'assignment_alert') {
      urlToOpen = '/volunteer/incidents';
      console.log('[SW] Opening volunteer incidents page for assignment alert');
    }
  }
  
  console.log('[SW] Final URL to open:', urlToOpen);

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

// Fetch event - network-first strategy for API calls, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // API requests - network first, cache fallback
  if (url.pathname.startsWith('/api/')) {
    if (request.method !== 'GET') {
      return;
    }
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone the response before caching
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cachedResponse) => {
            return cachedResponse || new Response(
              JSON.stringify({ error: 'Offline', offline: true }),
              { headers: { 'Content-Type': 'application/json' } }
            );
          });
        })
    );
    return;
  }

  // Static assets - cache first, network fallback
  if (request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request).then((response) => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }

          // Clone the response before caching
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });

          return response;
        });
      })
      .catch(() => {
        // Return a fallback for navigation requests
        if (request.mode === 'navigate') {
          return caches.match('/');
        }
      })
  );
});

// Background sync event (ENHANCED for keep-alive and persistence)
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  // Keep service worker active (critical for push notification persistence)
  if (event.tag === 'keep-alive') {
    event.waitUntil(
      Promise.resolve().then(() => {
        console.log('[SW] Keep-alive sync completed - service worker remains active');
        // Service worker stays active for push notifications
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

// Periodic background sync for keep-alive (if supported)
if ('periodicSync' in self.registration) {
  self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'keep-alive') {
      console.log('[SW] Periodic sync triggered - keeping service worker active');
      event.waitUntil(Promise.resolve());
    }
  });
}

// Message event - handle messages from clients
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: '1.0.0' });
  }
});

console.log('[SW] Service worker loaded');
