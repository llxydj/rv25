declare global {
  interface Navigator {
    standalone?: boolean
  }

  interface SyncManager {
    register(tag: string): Promise<void>
  }

  interface ServiceWorkerRegistration {
    sync?: SyncManager
  }
}

export {}
