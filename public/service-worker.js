// This is the service worker with the combined offline experience (Offline page + Offline copy of pages)

const CACHE = "rvois-offline-v1"

// Variables for controlling the offline fallback
const OFFLINE_URL = "/offline"
// Removed image fallback asset to avoid caching a missing file

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => {
      // These items must be cached for the Service Worker to complete installation
      return cache.addAll([
        OFFLINE_URL,
        "/manifest.json",
        "/icons/icon-192x192.png",
        "/icons/icon-512x512.png",
      ])
    }),
  )
  // Force the waiting service worker to become the active service worker.
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE) {
            return caches.delete(key)
          }
        }),
      )
    }),
  )
  // Tell the active service worker to take control of the page immediately.
  self.clients.claim()
})

self.addEventListener("fetch", (event) => {
  // Background sync for incident submissions when offline
  const BG_SYNC_ENABLED = self && self.registration && self.registration.scope && (self.bg_sync_incidents || true)

  if (BG_SYNC_ENABLED && event.request.url.endsWith('/api/incidents') && event.request.method === 'POST') {
    event.respondWith(
      (async () => {
        try {
          return await fetch(event.request)
        } catch (err) {
          // Queue the request for retry using Background Sync if available
          if ('sync' in self.registration && self.indexedDB) {
            await queueFailedRequest(event.request)
            await self.registration.sync.register('incident-sync')
            // Notify client(s)
            const allClients = await self.clients.matchAll({ type: 'window' })
            for (const client of allClients) {
              client.postMessage({ type: 'INCIDENT_QUEUED' })
            }
            return new Response(JSON.stringify({ success: false, queued: true, message: 'Queued for background sync' }), { status: 202, headers: { 'Content-Type': 'application/json' } })
          }
          throw err
        }
      })()
    )
    return
  }
  // Only call event.respondWith() if this is a navigation request
  if (event.request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          // First, try to use the navigation preload response if it's supported
          const preloadResponse = await event.preloadResponse
          if (preloadResponse) {
            return preloadResponse
          }

          // Always try the network first
          const networkResponse = await fetch(event.request)
          return networkResponse
        } catch (error) {
          // catch is only triggered if an exception is thrown, which is likely
          // due to a network error.
          // If fetch() returns a valid HTTP response with a response code in
          // the 4xx or 5xx range, the catch() will NOT be called.
          console.log("Fetch failed; returning offline page instead.", error)

          const cache = await caches.open(CACHE)
          const cachedResponse = await cache.match(OFFLINE_URL)
          return cachedResponse
        }
      })(),
    )
  } else if (
    event.request.destination === "image" ||
    event.request.url.includes(".jpg") ||
    event.request.url.includes(".png") ||
    event.request.url.includes(".svg")
  ) {
    // For image requests, serve a fallback image if offline
    event.respondWith(
      (async () => {
        try {
          // Try the cache first
          const cachedResponse = await caches.match(event.request)
          if (cachedResponse) {
            return cachedResponse
          }

          // If not in cache, try the network
          const networkResponse = await fetch(event.request)

          // Cache the response for future use
          const cache = await caches.open(CACHE)
          cache.put(event.request, networkResponse.clone())

          return networkResponse
        } catch (error) {
          // If both cache and network fail, just return a generic 503 response
          return new Response("", { status: 503 })
        }
      })(),
    )
  } else if (
    event.request.destination === "document" ||
    event.request.destination === "style" ||
    event.request.destination === "script"
  ) {
    // For HTML, CSS, and JS requests, use a network-first strategy
    event.respondWith(
      (async () => {
        try {
          // Try the network first
          const networkResponse = await fetch(event.request)

          // Cache the response for future use
          const cache = await caches.open(CACHE)
          cache.put(event.request, networkResponse.clone())

          return networkResponse
        } catch (error) {
          // If network fails, try the cache
          const cache = await caches.open(CACHE)
          const cachedResponse = await cache.match(event.request)
          if (cachedResponse) {
            return cachedResponse
          }

          // If both network and cache fail, and it's an HTML request, serve the offline page
          if (event.request.destination === "document") {
            const offlineResponse = await cache.match(OFFLINE_URL)
            return offlineResponse
          }

          // For other resources, just fail
          throw error
        }
      })(),
    )
  }

  // For all other requests, use a cache-first strategy
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)
      const cachedResponse = await cache.match(event.request)
      if (cachedResponse) {
        return cachedResponse
      }

      try {
        const networkResponse = await fetch(event.request)

        // Cache successful responses for future use
        if (networkResponse.ok) {
          cache.put(event.request, networkResponse.clone())
        }

        return networkResponse
      } catch (error) {
        // If both cache and network fail, just return the error
        throw error
      }
    })(),
  )
})

async function queueFailedRequest(request) {
  const db = await openDb()
  const tx = db.transaction('requests', 'readwrite')
  const store = tx.objectStore('requests')
  const clone = await serializeRequest(request)
  await store.add(clone)
  await tx.complete
}

async function processQueue() {
  const db = await openDb()
  const tx = db.transaction('requests', 'readwrite')
  const store = tx.objectStore('requests')
  const all = await store.getAll()
  for (const req of all) {
    try {
      const res = await fetch(new Request(req.url, { method: req.method, headers: req.headers, body: req.body }))
      if (res.ok || res.status < 500) {
        await store.delete(req.id)
      }
    } catch (e) {
      // keep for next sync
    }
  }
  await tx.complete
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'incident-sync') {
    event.waitUntil(processQueue())
  }
})

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('rvois-sync-db', 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('requests')) {
        db.createObjectStore('requests', { keyPath: 'id', autoIncrement: true })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function serializeRequest(request) {
  const headers = {}
  for (const [key, value] of request.headers.entries()) {
    headers[key] = value
  }
  const body = request.method !== 'GET' && request.method !== 'HEAD' ? await request.clone().text() : undefined
  return { url: request.url, method: request.method, headers, body }
}

// Handle push notifications
self.addEventListener("push", (event) => {
  const data = event.data.json()
  const options = {
    body: data.body,
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-72x72.png",
    vibrate: [100, 50, 100],
    data: {
      url: data.url || "/",
    },
  }

  event.waitUntil(self.registration.showNotification(data.title, options))
})

// Handle notification clicks
self.addEventListener("notificationclick", (event) => {
  event.notification.close()

  event.waitUntil(
    clients
      .matchAll({
        type: "window",
      })
      .then((clientList) => {
        const url = event.notification.data.url

        // If a window is already open, focus it
        for (const client of clientList) {
          if (client.url === url && "focus" in client) {
            return client.focus()
          }
        }

        // Otherwise, open a new window
        if (clients.openWindow) {
          return clients.openWindow(url)
        }
      }),
  )
})
