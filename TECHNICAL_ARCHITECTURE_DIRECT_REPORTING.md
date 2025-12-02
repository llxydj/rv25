# 🏗️ Technical Architecture: Direct Emergency Reporting

> **System**: RVOIS Production Environment  
> **Deployment**: Vercel (Singapore Region)  
> **Database**: Supabase PostgreSQL  
> **Status**: Production-Ready Implementation Plan

---

## 📐 System Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Mobile     │  │   Tablet     │  │   Desktop    │ │
│  │   Browser    │  │   Browser    │  │   Browser    │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                 │                  │          │
│         └─────────────────┴──────────────────┘          │
│                         │                                │
│         ┌───────────────▼───────────────┐               │
│         │   Next.js App (SSR/CSR)      │               │
│         │   - DirectReportButton       │               │
│         │   - LocationCache            │               │
│         │   - OfflineQueue             │               │
│         └───────────────┬───────────────┘               │
└─────────────────────────┼───────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│                    API LAYER                            │
│  ┌──────────────────────────────────────────────────┐  │
│  │  POST /api/incidents                             │  │
│  │  - Rate Limiting                                 │  │
│  │  - Validation                                    │  │
│  │  - Geofencing                                    │  │
│  └──────────────────────────────────────────────────┘  │
│                         │                                │
│         ┌───────────────▼───────────────┐               │
│         │   Supabase Client             │               │
│         │   - Authentication            │               │
│         │   - Row Level Security        │               │
│         └───────────────┬───────────────┘               │
└─────────────────────────┼───────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│                  DATABASE LAYER                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   incidents  │  │    users     │  │ notifications│ │
│  │   table      │  │    table     │  │   table     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│         │                 │                  │          │
│         └─────────────────┴──────────────────┘          │
│                         │                                │
│         ┌───────────────▼───────────────┐               │
│         │   Database Triggers           │               │
│         │   - Auto-create notifications │               │
│         │   - Auto-assignment logic     │               │
│         └───────────────────────────────┘               │
└─────────────────────────────────────────────────────────┘
```

---

## 🔧 Component Architecture

### 1. DirectReportButton Component

**File**: `src/components/resident/direct-report-button.tsx`

**Dependencies**:
```typescript
import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth"
import { useToast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"
import { createIncident } from "@/lib/incidents"
import { LocationCache } from "@/lib/location-cache"
import { OfflineReportQueue } from "@/lib/offline-report-queue"
import { supabase } from "@/lib/supabase"
```

**State Management**:
```typescript
interface DirectReportState {
  isReporting: boolean
  location: [number, number] | null
  userProfile: {
    address: string | null
    barangay: string | null
  } | null
  error: string | null
}
```

**Lifecycle**:
```
Mount → Pre-cache Location → Ready
  ↓
User Tap → Validate → Get Location → Get Profile → Create Incident → Success
  ↓
Error → Show Error → Retry Option
```

### 2. LocationCache Service

**File**: `src/lib/location-cache.ts`

**Implementation**:
```typescript
export class LocationCache {
  private static cache: {
    location: [number, number]
    timestamp: number
    accuracy: number
  } | null = null

  private static TTL = 60000 // 1 minute

  static async getCachedLocation(): Promise<[number, number] | null> {
    if (this.cache && Date.now() - this.cache.timestamp < this.TTL) {
      return this.cache.location
    }
    return null
  }

  static async captureLocation(): Promise<[number, number]> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Location capture timeout'))
      }, 3000)

      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(timeout)
          const location: [number, number] = [
            position.coords.latitude,
            position.coords.longitude
          ]
          this.cache = {
            location,
            timestamp: Date.now(),
            accuracy: position.coords.accuracy
          }
          resolve(location)
        },
        (error) => {
          clearTimeout(timeout)
          reject(error)
        },
        {
          enableHighAccuracy: true,
          timeout: 3000,
          maximumAge: 0
        }
      )
    })
  }

  static clearCache() {
    this.cache = null
  }
}
```

**Usage Pattern**:
```typescript
// Pre-cache on dashboard load
useEffect(() => {
  LocationCache.captureLocation().catch(() => {
    // Silent fail, will use fallback
  })
}, [])

// Use cached location in report
const location = await LocationCache.getCachedLocation() || 
                 await LocationCache.captureLocation() ||
                 TALISAY_CENTER
```

### 3. OfflineReportQueue Service

**File**: `src/lib/offline-report-queue.ts`

**Implementation**:
```typescript
interface QueuedReport {
  id: string
  reporterId: string
  incidentType: string
  location: [number, number]
  address: string
  barangay: string
  priority: number
  queuedAt: string
  retryCount: number
}

export class OfflineReportQueue {
  private static STORAGE_KEY = 'direct_emergency_reports'
  private static MAX_RETRIES = 3

  static getQueue(): QueuedReport[] {
    if (typeof window === 'undefined') return []
    const stored = localStorage.getItem(this.STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  }

  static async queueReport(report: Omit<QueuedReport, 'id' | 'queuedAt' | 'retryCount'>) {
    const queue = this.getQueue()
    const queuedReport: QueuedReport = {
      ...report,
      id: crypto.randomUUID(),
      queuedAt: new Date().toISOString(),
      retryCount: 0
    }
    queue.push(queuedReport)
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(queue))
    
    // Trigger sync if online
    if (navigator.onLine) {
      this.syncQueue()
    }
  }

  static async syncQueue() {
    const queue = this.getQueue()
    const synced: string[] = []

    for (const report of queue) {
      try {
        await createIncident(
          report.reporterId,
          report.incidentType,
          'Emergency reported (queued)',
          report.location[0],
          report.location[1],
          report.address,
          report.barangay,
          [],
          report.priority,
          false,
          report.queuedAt
        )
        synced.push(report.id)
      } catch (error) {
        report.retryCount++
        if (report.retryCount >= this.MAX_RETRIES) {
          // Remove after max retries
          synced.push(report.id)
        }
        console.error('Failed to sync report:', error)
      }
    }

    // Remove synced reports
    const remaining = queue.filter(r => !synced.includes(r.id))
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(remaining))
  }

  static removeFromQueue(id: string) {
    const queue = this.getQueue()
    const filtered = queue.filter(r => r.id !== id)
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered))
  }
}
```

**Sync Strategy**:
```typescript
// Listen for online event
window.addEventListener('online', () => {
  OfflineReportQueue.syncQueue()
})

// Periodic sync (every 30 seconds when online)
setInterval(() => {
  if (navigator.onLine) {
    OfflineReportQueue.syncQueue()
  }
}, 30000)
```

---

## 🔌 API Integration

### Incident Creation Endpoint

**Endpoint**: `POST /api/incidents`

**Request Payload** (Direct Report):
```typescript
{
  reporter_id: string          // From useAuth hook
  incident_type: "EMERGENCY INCIDENT"
  description: string           // Default: "Emergency reported via direct reporting"
  location_lat: number          // From LocationCache
  location_lng: number          // From LocationCache
  address: string               // From user profile or reverse geocode
  barangay: string              // From user profile or reverse geocode
  priority: 1                   // Always 1 for direct reports
  photo_urls: []                // Empty initially
  voice_url: null               // No voice initially
}
```

**Response**:
```typescript
{
  success: boolean
  data: {
    id: string
    reference_id: string
    status: "PENDING"
    created_at: string
  }
  message?: string
}
```

**Error Handling**:
```typescript
try {
  const result = await createIncident(...)
  if (!result.success) {
    // Handle specific error codes
    if (result.code === 'OUT_OF_BOUNDS') {
      // Use fallback location
    } else if (result.code === 'RATE_LIMITED') {
      // Queue for later
    }
  }
} catch (error) {
  // Network error - queue offline
  if (!navigator.onLine) {
    await OfflineReportQueue.queueReport(...)
  }
}
```

---

## 🗄️ Database Schema

### Incidents Table (No Changes Required)

```sql
-- Existing schema (unchanged)
CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES users(id),
  incident_type TEXT NOT NULL,
  description TEXT,
  location_lat DECIMAL(10, 8) NOT NULL,
  location_lng DECIMAL(11, 8) NOT NULL,
  address TEXT NOT NULL,
  barangay TEXT NOT NULL,
  priority INTEGER NOT NULL CHECK (priority BETWEEN 1 AND 5),
  severity TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  photo_url TEXT,
  photo_urls TEXT[],
  voice_url TEXT,
  assigned_to UUID REFERENCES users(id),
  assigned_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at_local TIMESTAMPTZ,
  reference_id TEXT
);

-- Indexes (existing)
CREATE INDEX idx_incidents_reporter ON incidents(reporter_id);
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_incidents_priority ON incidents(priority);
CREATE INDEX idx_incidents_created_at ON incidents(created_at DESC);
```

### Users Table (PIN Removal)

```sql
-- Keep PIN columns but mark as deprecated
-- Do NOT remove columns (for admin/volunteer if needed)
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS pin_deprecated BOOLEAN DEFAULT true;

-- Update existing PIN data
UPDATE users 
SET pin_deprecated = true 
WHERE role = 'resident';
```

### Migration Script

```sql
-- Migration: Remove PIN requirement for residents
-- File: supabase/migrations/YYYYMMDD_remove_pin_for_residents.sql

-- 1. Mark PIN as deprecated for residents
UPDATE users 
SET pin_deprecated = true,
    pin_enabled = false
WHERE role = 'resident' AND pin_enabled = true;

-- 2. Archive PIN data (optional)
CREATE TABLE IF NOT EXISTS pin_data_archive (
  user_id UUID,
  pin_code_hash TEXT,
  archived_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO pin_data_archive (user_id, pin_code_hash)
SELECT id, pin_code
FROM users
WHERE role = 'resident' AND pin_code IS NOT NULL;

-- 3. Clear PIN for residents (keep for admin/volunteer)
UPDATE users
SET pin_code = NULL,
    pin_enabled = false,
    pin_expires_at = NULL
WHERE role = 'resident';

-- 4. Update RLS policies (if PIN-related)
-- No changes needed - PIN check happens in application layer
```

---

## 🔐 Security Considerations

### Authentication Flow (No PIN)

**Before (With PIN)**:
```
Login → Session → PIN Guard → PIN Verify → Access
```

**After (No PIN for Residents)**:
```
Login → Session → Access (for residents)
Login → Session → PIN Verify → Access (for admin/volunteer)
```

**Implementation**:
```typescript
// src/middleware.ts
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  
  // Skip PIN check for resident routes
  if (pathname.startsWith('/resident')) {
    // Only check authentication, not PIN
    return checkAuth(request)
  }
  
  // Admin/volunteer routes still require PIN
  if (pathname.startsWith('/admin') || pathname.startsWith('/volunteer')) {
    return checkAuthAndPin(request)
  }
}
```

### Rate Limiting

**Current Implementation**:
```typescript
// src/lib/rate-limit.ts
export async function rateLimitAllowed(
  key: string,
  limit: number,
  window: number
): Promise<boolean> {
  // Redis-based or in-memory rate limiting
  // Key: user_id:direct_report
  // Limit: 5 reports per minute
  // Window: 60000ms
}
```

**Enhanced for Direct Reports**:
```typescript
// More lenient for emergencies
const DIRECT_REPORT_LIMIT = {
  perMinute: 5,
  perHour: 20,
  perDay: 50
}
```

### Input Validation

**Location Validation**:
```typescript
// Must be within Talisay City boundary
if (!isWithinTalisayCity(lat, lng)) {
  // Use fallback: user's profile address
  // Or: Talisay City center
  location = TALISAY_CENTER
}
```

**Priority Validation**:
```typescript
// Direct reports always priority 1
if (source === 'direct_report') {
  priority = 1
  incident_type = 'EMERGENCY INCIDENT'
}
```

---

## 📊 Performance Optimization

### 1. Location Pre-caching

**Strategy**:
- Capture location when dashboard loads
- Cache for 1 minute
- Use cached location for instant reports

**Performance Gain**: 2-3 seconds saved per report

### 2. Optimistic UI

**Strategy**:
- Show success immediately
- Sync in background
- Handle errors gracefully

**Implementation**:
```typescript
// Show success immediately
toast({ title: "Emergency Reported!" })

// Sync in background
createIncident(...).then(result => {
  if (!result.success) {
    // Show error, queue for retry
  }
})
```

### 3. Code Splitting

**Strategy**:
- Lazy load quick actions modal
- Lazy load voice recorder
- Keep emergency button in main bundle

**Implementation**:
```typescript
const QuickReportActions = dynamic(
  () => import('@/components/resident/quick-report-actions'),
  { ssr: false }
)
```

### 4. API Optimization

**Strategy**:
- Reduce payload size (no photos initially)
- Use compression
- Parallel requests where possible

**Before**: ~50KB payload (with photos)  
**After**: ~2KB payload (text only)

---

## 🔄 State Management

### Global State (Context)

```typescript
// src/contexts/reporting-context.tsx
interface ReportingContextType {
  lastReport: {
    id: string
    timestamp: number
  } | null
  isReporting: boolean
  reportEmergency: () => Promise<void>
}

export const ReportingProvider = ({ children }) => {
  const [lastReport, setLastReport] = useState(null)
  const [isReporting, setIsReporting] = useState(false)

  const reportEmergency = async () => {
    setIsReporting(true)
    try {
      const result = await createIncident(...)
      setLastReport({ id: result.data.id, timestamp: Date.now() })
    } finally {
      setIsReporting(false)
    }
  }

  return (
    <ReportingContext.Provider value={{ lastReport, isReporting, reportEmergency }}>
      {children}
    </ReportingContext.Provider>
  )
}
```

### Local State (Component)

```typescript
// DirectReportButton component
const [state, setState] = useState({
  isReporting: false,
  location: null,
  error: null
})
```

---

## 🧪 Testing Architecture

### Unit Tests

```typescript
// src/components/resident/__tests__/direct-report-button.test.tsx
describe('DirectReportButton', () => {
  it('should report emergency in < 3 seconds', async () => {
    const startTime = Date.now()
    await reportEmergency()
    const endTime = Date.now()
    expect(endTime - startTime).toBeLessThan(3000)
  })

  it('should use cached location if available', async () => {
    LocationCache.cache = { location: [10.7, 122.9], timestamp: Date.now() }
    const location = await getLocation()
    expect(location).toEqual([10.7, 122.9])
  })

  it('should queue report if offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false })
    await reportEmergency()
    const queue = OfflineReportQueue.getQueue()
    expect(queue.length).toBe(1)
  })
})
```

### Integration Tests

```typescript
// e2e/direct-reporting.spec.ts
test('complete emergency report flow', async ({ page }) => {
  await page.goto('/resident/dashboard')
  
  // Pre-cache location
  await page.evaluate(() => {
    navigator.geolocation.getCurrentPosition = (success) => {
      success({ coords: { latitude: 10.7, longitude: 122.9, accuracy: 10 } })
    }
  })
  
  // Tap emergency button
  await page.click('button:has-text("REPORT EMERGENCY")')
  
  // Verify success
  await expect(page.locator('text=Emergency Reported')).toBeVisible({ timeout: 5000 })
  
  // Verify incident created
  const incidentId = await page.locator('[data-testid="incident-id"]').textContent()
  expect(incidentId).toMatch(/^#[A-Z0-9]+$/)
})
```

### Performance Tests

```typescript
// performance/direct-reporting.test.ts
describe('Performance', () => {
  it('should report in < 3 seconds', async () => {
    const metrics = await measureReportTime()
    expect(metrics.totalTime).toBeLessThan(3000)
    expect(metrics.locationTime).toBeLessThan(2000)
    expect(metrics.apiTime).toBeLessThan(1000)
  })
})
```

---

## 📈 Monitoring & Analytics

### Key Metrics

```typescript
// Track these metrics
interface DirectReportMetrics {
  reportTime: number           // Time from tap to confirmation
  locationCaptureTime: number  // Time to get GPS
  apiResponseTime: number     // Time for API call
  successRate: number         // % of successful reports
  offlineQueueSize: number    // Number of queued reports
  errorRate: number           // % of failed reports
}
```

### Analytics Events

```typescript
// Track user actions
analytics.track('direct_emergency_report_started', {
  userId: user.id,
  timestamp: Date.now()
})

analytics.track('direct_emergency_report_completed', {
  userId: user.id,
  incidentId: result.data.id,
  reportTime: endTime - startTime,
  timestamp: Date.now()
})

analytics.track('direct_emergency_report_failed', {
  userId: user.id,
  error: error.message,
  timestamp: Date.now()
})
```

### Error Tracking

```typescript
// Sentry integration
Sentry.captureException(error, {
  tags: {
    feature: 'direct_reporting',
    userId: user.id
  },
  extra: {
    location: location,
    userProfile: profile
  }
})
```

---

## 🚀 Deployment Strategy

### Feature Flags

```typescript
// Environment variables
const DIRECT_REPORTING_ENABLED = process.env.NEXT_PUBLIC_DIRECT_REPORTING === 'true'
const PIN_REMOVED_FOR_RESIDENTS = process.env.NEXT_PUBLIC_REMOVE_PIN === 'true'

// Gradual rollout
const ROLLOUT_PERCENTAGE = parseInt(process.env.NEXT_PUBLIC_ROLLOUT_PERCENTAGE || '0')
const shouldShowDirectReporting = (userId: string) => {
  if (!DIRECT_REPORTING_ENABLED) return false
  const hash = hashUserId(userId)
  return hash % 100 < ROLLOUT_PERCENTAGE
}
```

### Deployment Steps

1. **Deploy Code** (Feature Flag OFF)
   ```bash
   git push origin main
   # Vercel auto-deploys
   ```

2. **Enable for 10%**
   ```bash
   vercel env add NEXT_PUBLIC_DIRECT_REPORTING true
   vercel env add NEXT_PUBLIC_ROLLOUT_PERCENTAGE 10
   ```

3. **Monitor Metrics**
   - Error rates
   - Report times
   - User feedback

4. **Gradually Increase**
   - 10% → 25% → 50% → 100%

5. **Remove Feature Flags**
   ```bash
   # After 1 week of stable operation
   # Remove feature flag checks from code
   ```

---

## 🔄 Rollback Plan

### Instant Rollback

```typescript
// Environment variable
if (process.env.ENABLE_DIRECT_REPORTING !== 'true') {
  // Show old emergency report cards
  return <EmergencyReportCards />
}
```

### Database Rollback

```sql
-- If needed, restore PIN for residents
UPDATE users
SET pin_enabled = true,
    pin_deprecated = false
WHERE role = 'resident' AND pin_code IS NOT NULL;
```

### Code Rollback

```bash
# Revert to previous commit
git revert HEAD
git push origin main
```

---

## 📚 Related Documentation

- **Implementation Proposal**: `IMPLEMENTATION_PROPOSAL_DIRECT_REPORTING.md`
- **UI/UX Specification**: `UI_UX_SPECIFICATION_DIRECT_REPORTING.md`
- **Project Requirements**: `PROJECT_REQUIREMENTS.md`
- **API Documentation**: `src/app/api/incidents/route.ts`
- **Current Codebase**: GitHub repository

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-27  
**Architecture**: Production-Ready  
**Status**: Ready for Implementation

