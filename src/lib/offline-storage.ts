import { LocationData } from './location-tracking'

export interface OfflineIncident {
  id: string
  reporter_id: string
  incident_type: string
  description: string
  location_lat: number
  location_lng: number
  address: string | null
  barangay: string
  priority: number
  photo_url: string | null
  created_at: string
  synced: boolean
}

export interface OfflineLocation {
  id: string
  user_id: string
  latitude: number
  longitude: number
  accuracy: number
  heading?: number
  speed?: number
  timestamp: string
  synced: boolean
}

export class OfflineStorageService {
  private static instance: OfflineStorageService
  private db: IDBDatabase | null = null

  private constructor() {}

  public static getInstance(): OfflineStorageService {
    if (!OfflineStorageService.instance) {
      OfflineStorageService.instance = new OfflineStorageService()
    }
    return OfflineStorageService.instance
  }

  /**
   * Initialize IndexedDB
   */
  async initialize(): Promise<boolean> {
    try {
      this.db = await this.openDatabase()
      return true
    } catch (error) {
      console.error('Failed to initialize offline storage:', error)
      return false
    }
  }

  /**
   * Open IndexedDB database
   */
  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('RVOISOffline', 3)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create pending incidents store
        if (!db.objectStoreNames.contains('pendingIncidents')) {
          const incidentStore = db.createObjectStore('pendingIncidents', { keyPath: 'id' })
          incidentStore.createIndex('reporter_id', 'reporter_id', { unique: false })
          incidentStore.createIndex('created_at', 'created_at', { unique: false })
          incidentStore.createIndex('synced', 'synced', { unique: false })
        }

        // Create pending locations store
        if (!db.objectStoreNames.contains('pendingLocations')) {
          const locationStore = db.createObjectStore('pendingLocations', { keyPath: 'id' })
          locationStore.createIndex('user_id', 'user_id', { unique: false })
          locationStore.createIndex('timestamp', 'timestamp', { unique: false })
          locationStore.createIndex('synced', 'synced', { unique: false })
        }

        // Create offline settings store
        if (!db.objectStoreNames.contains('offlineSettings')) {
          const settingsStore = db.createObjectStore('offlineSettings', { keyPath: 'key' })
        }

        // Create cache metadata store
        if (!db.objectStoreNames.contains('cacheMetadata')) {
          const cacheStore = db.createObjectStore('cacheMetadata', { keyPath: 'url' })
          cacheStore.createIndex('type', 'type', { unique: false })
          cacheStore.createIndex('timestamp', 'timestamp', { unique: false })
        }
      }
    })
  }

  /**
   * Store incident offline
   */
  async storeIncidentOffline(incident: Omit<OfflineIncident, 'id' | 'created_at' | 'synced'>): Promise<string> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const id = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const offlineIncident: OfflineIncident = {
      ...incident,
      id,
      created_at: new Date().toISOString(),
      synced: false
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['pendingIncidents'], 'readwrite')
      const store = transaction.objectStore('pendingIncidents')
      const request = store.add(offlineIncident)

      request.onsuccess = () => {
        console.log('Incident stored offline:', id)
        this.notifyServiceWorker('INCIDENT_QUEUED', offlineIncident)
        resolve(id)
      }
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Store location offline
   */
  async storeLocationOffline(location: Omit<OfflineLocation, 'id' | 'synced'>): Promise<string> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const id = `offline_loc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const offlineLocation: OfflineLocation = {
      ...location,
      id,
      synced: false
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['pendingLocations'], 'readwrite')
      const store = transaction.objectStore('pendingLocations')
      const request = store.add(offlineLocation)

      request.onsuccess = () => {
        console.log('Location stored offline:', id)
        this.notifyServiceWorker('LOCATION_QUEUED', offlineLocation)
        resolve(id)
      }
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Get pending incidents
   */
  async getPendingIncidents(): Promise<OfflineIncident[]> {
    if (!this.db) {
      return []
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['pendingIncidents'], 'readonly')
      const store = transaction.objectStore('pendingIncidents')
      const request = store.getAll()

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Get pending locations
   */
  async getPendingLocations(): Promise<OfflineLocation[]> {
    if (!this.db) {
      return []
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['pendingLocations'], 'readonly')
      const store = transaction.objectStore('pendingLocations')
      const request = store.getAll()

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Mark incident as synced
   */
  async markIncidentSynced(id: string): Promise<void> {
    if (!this.db) return

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['pendingIncidents'], 'readwrite')
      const store = transaction.objectStore('pendingIncidents')
      const getRequest = store.get(id)

      getRequest.onsuccess = () => {
        const incident = getRequest.result
        if (incident) {
          incident.synced = true
          const updateRequest = store.put(incident)
          updateRequest.onsuccess = () => resolve()
          updateRequest.onerror = () => reject(updateRequest.error)
        } else {
          resolve()
        }
      }
      getRequest.onerror = () => reject(getRequest.error)
    })
  }

  /**
   * Mark location as synced
   */
  async markLocationSynced(id: string): Promise<void> {
    if (!this.db) return

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['pendingLocations'], 'readwrite')
      const store = transaction.objectStore('pendingLocations')
      const getRequest = store.get(id)

      getRequest.onsuccess = () => {
        const location = getRequest.result
        if (location) {
          location.synced = true
          const updateRequest = store.put(location)
          updateRequest.onsuccess = () => resolve()
          updateRequest.onerror = () => reject(updateRequest.error)
        } else {
          resolve()
        }
      }
      getRequest.onerror = () => reject(getRequest.error)
    })
  }

  /**
   * Remove synced incidents
   */
  async removeSyncedIncidents(): Promise<void> {
    if (!this.db) return

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['pendingIncidents'], 'readwrite')
      const store = transaction.objectStore('pendingIncidents')
      const index = store.index('synced')
      const request = index.openCursor(IDBKeyRange.only(true))

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        } else {
          resolve()
        }
      }
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Remove synced locations
   */
  async removeSyncedLocations(): Promise<void> {
    if (!this.db) return

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['pendingLocations'], 'readwrite')
      const store = transaction.objectStore('pendingLocations')
      const index = store.index('synced')
      const request = index.openCursor(IDBKeyRange.only(true))

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        } else {
          resolve()
        }
      }
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Get offline status
   */
  async getOfflineStatus(): Promise<{
    isOffline: boolean
    pendingIncidents: number
    pendingLocations: number
    lastSync: string | null
  }> {
    const pendingIncidents = await this.getPendingIncidents()
    const pendingLocations = await this.getPendingLocations()
    const lastSync = await this.getLastSyncTime()

    return {
      isOffline: !navigator.onLine,
      pendingIncidents: pendingIncidents.length,
      pendingLocations: pendingLocations.length,
      lastSync
    }
  }

  /**
   * Get last sync time
   */
  private async getLastSyncTime(): Promise<string | null> {
    if (!this.db) return null

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offlineSettings'], 'readonly')
      const store = transaction.objectStore('offlineSettings')
      const request = store.get('lastSync')

      request.onsuccess = () => {
        resolve(request.result?.value || null)
      }
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Set last sync time
   */
  async setLastSyncTime(): Promise<void> {
    if (!this.db) return

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offlineSettings'], 'readwrite')
      const store = transaction.objectStore('offlineSettings')
      const request = store.put({
        key: 'lastSync',
        value: new Date().toISOString()
      })

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Clear all offline data
   */
  async clearAllOfflineData(): Promise<void> {
    if (!this.db) return

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['pendingIncidents', 'pendingLocations'], 'readwrite')
      
      const incidentStore = transaction.objectStore('pendingIncidents')
      const locationStore = transaction.objectStore('pendingLocations')
      
      const incidentRequest = incidentStore.clear()
      const locationRequest = locationStore.clear()

      Promise.all([
        new Promise((res, rej) => {
          incidentRequest.onsuccess = () => res(undefined)
          incidentRequest.onerror = () => rej(incidentRequest.error)
        }),
        new Promise((res, rej) => {
          locationRequest.onsuccess = () => res(undefined)
          locationRequest.onerror = () => rej(locationRequest.error)
        })
      ]).then(() => resolve()).catch(reject)
    })
  }

  /**
   * Notify service worker
   */
  private notifyServiceWorker(type: string, data: any): void {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type,
        data
      })
    }
  }

  /**
   * Check if offline storage is supported
   */
  isSupported(): boolean {
    return 'indexedDB' in window
  }

  /**
   * Get storage usage estimate
   */
  async getStorageUsage(): Promise<{
    used: number
    available: number
    percentage: number
  }> {
    if (!('storage' in navigator) || !('estimate' in navigator.storage)) {
      return { used: 0, available: 0, percentage: 0 }
    }

    try {
      const estimate = await navigator.storage.estimate()
      const used = estimate.usage || 0
      const available = estimate.quota || 0
      const percentage = available > 0 ? (used / available) * 100 : 0

      return { used, available, percentage }
    } catch (error) {
      console.error('Failed to get storage usage:', error)
      return { used: 0, available: 0, percentage: 0 }
    }
  }
}

// Export singleton instance
export const offlineStorageService = OfflineStorageService.getInstance()
