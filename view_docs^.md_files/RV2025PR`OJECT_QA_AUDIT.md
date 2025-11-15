# RVOIS Project QA & Technical Audit (2025)

This document is an end-to-end QA and engineering audit of the RVOIS (Rescue Volunteers Operations Information System) codebase. It consolidates current functionality, known issues, performance notes, and clear steps for developers to run, test, and extend the project safely.

---

## Table of Contents
- [Overview](#overview)
- [Setup](#setup)
- [Environment Variables](#environment-variables)
- [Running Locally](#running-locally)
- [Testing Checklist](#testing-checklist)
- [Feature Overview](#feature-overview)
- [APIs and Data Flow](#apis-and-data-flow)
- [Mapping Features](#mapping-features)
- [Offline/PWA](#offlinepwa)
- [Known Issues & Recommendations](#known-issues--recommendations)
- [Documentation Gaps](#documentation-gaps)
- [Folder Structure Overview](#folder-structure-overview)
- [Onboarding Notes](#onboarding-notes)

---

## Overview
- Framework: Next.js 13+ App Router, TypeScript, Tailwind CSS
- Data: Supabase (Postgres + Auth + Storage)
- Mapping: Leaflet + React-Leaflet
- PWA: `next-pwa` with custom SW registration
- OS: Windows (dev), OneDrive path

Primary code areas:
- Pages: `src/app/`
- Components: `src/components/`
- APIs: `src/app/api/`
- Lib/Services: `src/lib/`
- Public assets & PWA: `public/`

---

## Setup
1. Clone the repository.
2. Ensure Node 18+ and pnpm/npm installed.
3. Create `.env.local` with Supabase keys and optional feature flags (see below).
4. Install dependencies:
   ```bash
   npm install
   ```
5. Run dev server:
   ```bash
   npm run dev
   ```

---

## Environment Variables
Required:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Optional feature flags:
- `NEXT_PUBLIC_FEATURE_GEO_POLYGON_GUARD=true` — enables polygon-based city boundary validation using `public/talisay.geojson` (client preloader `src/components/geo-polygon-loader.tsx`).

Notes:
- Do not commit secret service keys into source control.

---

## Running Locally
- Dev: `npm run dev` (Next.js dev server with HMR)
- Production build: `npm run build && npm run start`

Troubleshooting:
- If Leaflet map errors on dev mounts, ensure SSR is off for map components and Strict Mode issues are handled (already addressed in code).
- If PWA caches stale resources, unregister service worker in DevTools → Application → Service Workers → Unregister, then hard reload.

---

## Testing Checklist
- Auth
  - Login/logout flows function.
  - Auth state persists across reloads.
- Admin Dashboard (`src/app/admin/dashboard/page.tsx`)
  - Loads incidents, volunteers, schedules without long delays.
  - Map renders markers; clicking an incident marker navigates to incident details.
- Resident Report
  - Map allows location capture.
  - Submitting outside Talisay is rejected.
- API (`src/app/api/`)
  - `/api/incidents` supports role-based filters, pagination, and light projection.
- PWA
  - No duplicate SW registration warnings.
  - Required icons exist (e.g., `public/icons/icon-144x144.png`).
- Performance
  - Navigation between logged-in pages is responsive (middleware narrowed).
  - No excessive payloads (pagination + projection used where relevant).

---

## Feature Overview

### Authentication
- `src/hooks/use-auth.tsx` provides `AuthProvider` and `useAuth()`.
- Uses a single shared Supabase client from `src/lib/supabase.ts` (prevents multiple GoTrue instances).

### Incidents (Core)
- Listings, details, creation via `src/lib/incidents.ts` and pages under `src/app/admin/` and others.
- API: `src/app/api/incidents/route.ts`
  - GET supports `role`, `barangayId`, `coverage`, `status`.
  - Pagination: `limit` (default 100, max 200), `offset`.
  - Light projection for maps: `projection=map` returns minimal fields.
  - POST validates location within Talisay (see Geo section).

### Volunteers
- Profiles in DB (`volunteer_profiles`).
- UI widgets and call features present (`src/components/emergency-call-button-enhanced.tsx`, `src/lib/call-service.ts`).

### Mapping
- Shared Map wrapper: `src/components/ui/map-component.tsx` loads `map-internal.tsx` dynamically with SSR off.
- Leaflet internals: `src/components/ui/map-internal.tsx` (incidents, user location, boundary overlay, geofence circle).
- Offline variant: `src/components/ui/map-offline.tsx` with cached tiles and boundary.
- New isolated `VolunteerMap`: `src/components/volunteer-map.tsx` (additive feature for volunteer visualization; see Mapping Features below).

### PWA
- Config in `next.config.js` with `next-pwa`.
- Custom registration via `src/app/sw-register.tsx` (single registration approach).
- Manifest: `public/manifest.json` (ensure icons present).

### Call Service
- `src/lib/call-service.ts` handles preferences, call logs.
- Uses safe selects (`maybeSingle`) and upserts with `onConflict: 'user_id'`.

---

## APIs and Data Flow
- `src/app/api/incidents/route.ts`
  - GET filters by role:
    - ADMIN → all
    - BARANGAY → requires `barangayId` (else empty)
    - VOLUNTEER → `coverage=barangay` requires `barangayId`; otherwise citywide
    - RESIDENT → returns empty
  - Pagination: `limit`, `offset`; projection: `projection=map` for lightweight map markers.
  - POST uses `isWithinTalisayCity` for location validation.

- Supabase RLS (example: `call_preferences`)
  - Insert/select own rows policies recommended and applied.

---

## Mapping Features

### Geo Utilities
- `src/lib/geo-utils.ts`
  - `isWithinTalisayCity(lat, lng)` supports polygon guard via `window.__TALISAY_POLYGON__` (when feature flag on), else bounding-box fallback.
  - `pointInPolygon` for runtime polygon checks.
  - `TALISAY_CENTER` constant for initial map centering.

### Boundary Overlay
- `public/talisay.geojson` used by:
  - `src/components/ui/map-internal.tsx` (`TalisayCityBoundary`) for overlay.
  - `src/components/ui/map-offline.tsx` (offline boundary).
  - Optional preloader: `src/components/geo-polygon-loader.tsx` for client-side polygon guard.

### VolunteerMap (Isolated, Additive)
- Path: `src/components/volunteer-map.tsx`
- Behavior:
  - Loads Talisay polygon from `/talisay.geojson`.
  - Fetches volunteers from `volunteer_locations` or falls back to `volunteer_profiles`; otherwise uses mock volunteers.
  - Filters to polygon using `pointInPolygon`.
  - Reverse geocoding via Nominatim with progressive updates and in-memory cache.
  - Renders Leaflet map with `<Polygon />` overlay and `<Marker />` + `<Popup />` for volunteers.
  - Error-safe and offline-friendly for boundary display.
- Usage example:
  ```tsx
  "use client";
  import { VolunteerMap } from "@/components/volunteer-map";
  
  export default function VolunteersPanel() {
    return (
      <div className="p-4">
        <h2 className="text-lg font-semibold mb-3">Volunteers Map</h2>
        <VolunteerMap height="420px" limit={100} />
      </div>
    );
  }
  ```

---

## Offline/PWA
- Service Worker managed by `next-pwa` with `register: false` and custom `sw-register.tsx` to prevent duplicate registration.
- Runtime caching tuned for Supabase API with `networkTimeoutSeconds: 3` to reduce delays.
- OSM tiles cached per `next.config.js` runtime caching entries.
- Manifest icons must include those listed in `public/manifest.json` (ensure `public/icons/icon-144x144.png` exists).

---

## Known Issues & Recommendations

### Performance (Logged-in)
- **Issue**: Slow navigation when authenticated due to middleware overhead and heavy API payloads.
- **Fixes Implemented**:
  - Narrowed middleware matcher to only `/login` in `src/middleware.ts`.
  - `/api/incidents` supports pagination and projection for lighter responses.
  - Admin dashboard uses `Promise.all` to fetch resources in parallel.
  - Supabase API runtime cache timeout reduced to 3 seconds.
- **Recommendation**:
  - For map markers, always use `/api/incidents?projection=map&limit=100`.
  - Add DB indexes on `incidents(created_at)`, `incidents(status)`, `incidents(barangay_id)`, `(barangay_id, created_at)`.

### Supabase Clients
- **Issue**: Multiple GoTrue clients caused warnings.
- **Fix**: `src/hooks/use-auth.tsx` now imports the singleton client from `src/lib/supabase.ts`.

### call_preferences 406
- **Issue**: 406 errors when selecting after insert or when zero rows.
- **Fix**: Use `.maybeSingle()` for reads, upsert with `{ onConflict: 'user_id' }` in `src/lib/call-service.ts`.
- **RLS Policies**: Allow insert/select own rows.

### PWA SW Registration
- **Issue**: Duplicate SW registration warning.
- **Fix**: Single registration via `sw-register.tsx`, `next-pwa` set to `register: false`.

### PWA Icons
- **Issue**: 404 for `/icons/icon-144x144.png`.
- **Fix**: Ensure icon exists in `public/icons/` or remove from manifest.

### Leaflet Stability
- **Issue**: Map remounts and container already-initialized errors.
- **Fixes**: Dynamic import at module scope, deferring initial mount, removing runtime unmount guard, pre-clean container, and memoizing map subtree.

---

## Documentation Gaps
- Some UI components referenced (e.g., certain `@/components/ui/*`) may be missing or implemented ad-hoc; ensure all imports have corresponding files.
- Add a dedicated doc for role-based filtering and how the frontend passes `role/barangayId/coverage` to `/api/incidents`.
- Provide SQL migration docs (table schemas, indexes, and RLS policies) for repeatable setup.

---

## Folder Structure Overview
```
src/
  app/
    admin/
      dashboard/page.tsx       # Admin dashboard with incidents map and stats
    api/
      incidents/route.ts       # Role-aware incidents API (GET/POST)
    ...
  components/
    ui/
      map-component.tsx        # SSR-disabled map wrapper
      map-internal.tsx         # Leaflet map core (incidents, overlays)
      map-offline.tsx          # Offline-capable map variant
    volunteer-map.tsx          # NEW: isolated volunteer mapping feature
    ...
  lib/
    geo-utils.ts               # Geospatial helpers, polygon guard
    incidents.ts               # Incidents data access
    call-service.ts            # Call logs and preferences
    supabase.ts                # Singleton Supabase client
public/
  talisay.geojson              # City boundary polygon
  manifest.json                # PWA manifest
  icons/                       # PWA icons
```

---

## Onboarding Notes
- Use `useAuth()` to access user info throughout client pages.
- For markers, prefer lightweight endpoints and projections.
- Keep features additive; avoid altering shared map internals unless necessary (use wrapper/adapters like `RoleMap` or `VolunteerMap`).
- When working on PWA behavior, ensure only one path registers service workers.
- For geospatial correctness, enable `NEXT_PUBLIC_FEATURE_GEO_POLYGON_GUARD` to use the polygon-based validation.

---

## Final Notes
This audit reflects the current code state and integrates fixes for performance, PWA/SW duplication, Supabase client duplication, and 406 errors. The new `VolunteerMap` component is fully isolated and safe to integrate anywhere without impacting existing flows.
