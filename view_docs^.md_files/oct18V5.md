# RVOIS System Audit — Oct 18 V5

## Scope
- Full-code review for feature parity, inconsistencies, incomplete areas, API contract, technical debt.
- Refs use backticked paths, e.g., `src/app/...`.

## Repository Inventory
- **API routes**: `src/app/api/` (incidents, analytics, notifications, reports, trainings, volunteer info, etc.)
- **Admin app**: `src/app/admin/` (incidents, analytics, reports, volunteers, schedules, handoffs, etc.)
- **Barangay app**: `src/app/barangay/` (dashboard, handoffs, report)
- **UI components**: `src/components/ui/` (maps, toasts, spinners, etc.)
- **Libs**: `src/lib/` (auth, incidents, reports, geo-utils, etc.)
- **PWA**: `public/manifest.json`, `public/service-worker.js` (+ Workbox bundle, `sw*.js`)

## Key Findings

### A. Feature Coverage vs Requirements
- **[Admin 1.1 Online incident monitoring & reporting]**
  - Dashboard and incident listing under `src/app/admin/incidents/` (pages, detail, brief) with CSV export via `src/app/api/analytics/incidents/export/route.ts`.
  - Live updates subscribed via `subscribeToIncidents()` in `src/lib/incidents.ts`.
  - Status updates, assignment flows present (`assignIncident()`).
- **[Admin 1.2 Activity monitoring & scheduling]**
  - `src/app/admin/schedules/` and `src/app/api/scheduled-activities/route.ts` present.
- **[Admin 1.3 Volunteer information]**
  - `src/app/admin/volunteers/` and `src/app/api/volunteer-information/route.ts` implemented.
- **[Admin 1.4 Geolocation (Talisay map)]**
  - `src/components/ui/map-component.tsx`, `map-internal.tsx`, `map-offline.tsx`, and `public/talisay.geojson` support mapping within Talisay.
- **[Admin 1.5 Automatic notification]**
  - Notifications API: `src/app/api/notifications/(route.ts|send/route.ts|subscribe/route.ts|preferences/route.ts)`.
  - Service worker handles push: `public/service-worker.js` (push + notificationclick events).
- **[Admin 1.6 Timely report generation]**
  - Reports UI at `src/app/admin/reports/page.tsx` with incidents export via `exportIncidentsToCSV()` and analytics APIs.

- **[Resident 1.1 Online incident reporting]**
  - Resident report exists; barangay report parallels it. Barangay: `src/app/barangay/report/page.tsx` uses `createIncident()` with photo upload and offline queueing.
- **[Resident 1.2 Direct call functionality]**
  - Call logs/preferences APIs exist (`src/app/api/call-logs/route.ts`, `src/app/api/call-preferences/route.ts`). Verify resident UI wiring separately; not observed in this pass.
- **[Resident 1.3 Geolocation (Talisay)]**
  - Map components and geo constraints present (`src/lib/geo-utils`, Map props in `map-internal.tsx`).

- **[Add Notification Alert]**
  - Supported by notifications API + SW push. Ensure client subscription UI connects to `/api/notifications/subscribe`.

- **[Real-time location tracker within Talisay]**
  - Map supports markers, optional heatmap, volunteer locations flags in `map-internal.tsx`.

- **[PWA installable with direct call features]**
  - PWA: `public/manifest.json` is correct; service worker present with offline and background sync for `/api/incidents` POST.
  - “Direct call” likely via tel: links; confirm specific UI. APIs exist for call logs and preferences.

- Additional items acknowledged in scope (speed, geolocation pinning, status, photo, LGU coordination, evaluation, announcements, severity, hotspot areas, homepage/feedback):
  - Speed/export: CSV export implemented; analytics endpoints exist.
  - Geolocation/pinning: `createIncident()` accepts lat/lng; report pages set/validate location.
  - Status and details: incident detail pages present; updates logging in `incident_updates`.
  - Photo capture: `barangay/report/page.tsx` enforces photo required.
  - LGU coordination: Admin handoffs and Barangay handoffs implemented (`src/app/admin/handoffs/`, `src/app/barangay/handoffs/`, API `incident-handoffs`).
  - Evaluation form: `src/app/api/training-evaluations/route.ts` and admin pages under `admin/training-evaluations/`.
  - Announcements: `src/app/api/announcements/route.ts`, admin UI exists.
  - Severity capture: `mapPriorityToSeverity()` used in `createIncident()`; priority captured in report form.
  - Hotspot areas: `src/app/api/analytics/hotspots/route.ts` and `map-internal.tsx` heatmap support.
  - Feedback/rating: `src/app/api/feedback/route.ts`; check UI for resident feedback.

### B. Inconsistencies and Gaps
- **[RLS not verified in repo]**
  - No RLS SQL present in source. Risk: data access outside scope if client/API checks missed. Action: configure Supabase RLS for `incidents`, `incident_updates`, etc.
- **[Field consistency: barangay vs barangay_id]**
  - Client uses `incidents.barangay` (string) extensively (`barangay/dashboard/page.tsx`, `createIncident()`).
  - API `src/app/api/incidents/route.ts` expects `barangay_id` for barangay-role filtering. Action: standardize to one field and update all layers.
- **[Admin Reports page import issues]**
  - `src/app/admin/reports/page.tsx` used unavailable icons from `lucide-react` and had a misplaced nested function; fixed by removing unsupported icons and hoisting `generateMonthlyIncidentsReport`. Re-verify lints.
- **[Direct DB queries vs API]**
  - `barangay/dashboard/page.tsx` queries Supabase directly. API enforces role-scoped rules when used. Action: route dashboards through `/api` for centralization + rate limiting.
- **[TODO/FIXME scan]**
  - No explicit TODOs found by automated grep. Manual review still advised for large components like `map-internal.tsx` and admin incident flows.
- **[Notifications UI usage]**
  - APIs + SW push supported; ensure subscription UI exists in app shells (admin, barangay, resident). If absent, add a small opt-in banner.
- **[Call features UI]**
  - APIs exist; verify resident or admin UI exposes direct call action (e.g., `tel:`) and logs preferences.
- **[Service worker offline assets]**
  - SW caches `/offline` and `/offline-image.png`; ensure these routes/assets exist. If not, add `app/offline/page.tsx` and `public/offline-image.png`.
- **[Consistency of error format]**
  - Many routes standardized to `{ success, code, message }`. Spot-check others to align.

### C. Duplicate/Redundant Code
- **Map components**: `map-internal.tsx` and `map-offline.tsx` overlap. Intentional, but consider consolidating shared helpers.
- **Volunteer profile updates**: Similar availability toggles in multiple places; consider central service.

### D. Incomplete/Partially Implemented
- **RLS policies**: Missing in repo (must be on Supabase). Provide SQL migration or documentation.
- **Barangay API usage**: Dashboard bypasses API; recommended refactor.
- **Announcements/Feedback landing**: API present; confirm landing exposure and navigation.
- **Resident call UI**: Ensure it’s discoverable and wired to preferences/logs.
- **Offline routes/assets**: Ensure `/offline` and fallback image exist to match SW expectations.

### E. API Audit (structure, consistency, errors)
- **Endpoints present**: `incidents`, `incident-updates`, `notifications` (subscribe, send, preferences), `reports`, `analytics/*`, `volunteer-information`, `scheduled-activities`, `training-evaluations`, `announcements`, `lgu-contacts`, `incident-handoffs`, etc.
- **Naming**: Mostly consistent; analytics under `analytics/...`, admin-specific under `admin/...`.
- **Error format**: Recent standardization to `{ success, code, message }` per `FOR_CHECKING.txt`. Ensure all routes return this consistently (spot-check needed for older routes).
- **Deprecated/broken**: None detected by grep; verify any older client calls still present.

### F. Function/Module Verification
- **`createIncident()`** (`src/lib/incidents.ts`): Validates auth, uploads photo (3MB limit), uppercases fields, inserts incident; logs extensively.
- **`getIncidentById()`**: Returns incident with reporter and assignee details; handles signed photo URLs.
- **`assignIncident()`**: Checks admin, fetches volunteer profile, updates incident, logs, updates availability; thorough error handling.
- **`MapComponent`** wrapper: SSR-safe dynamic import; `map-internal.tsx` implements markers/heatmap within Talisay.
- **`AuthGuard`**: Role-gated access and redirects.

### G. Technical Debt / Risk
- **RLS absence in repo**: Highest-risk security gap.
- **Field mismatch (`barangay` vs `barangay_id`)**: Causes divergent filters and potential access bugs.
- **Mixed data-fetching patterns**: Direct Supabase queries in pages vs centralized `/api` usage.
- **Large components**: `map-internal.tsx` and `map-offline.tsx` are sizeable; add tests or split concerns.
- **Service worker expectations**: Ensure `/offline` resources exist.

## Action Plan

- **[Security/RLS]**
  - Add Supabase SQL migration to enable RLS and policies for `incidents`, `incident_updates`, `volunteer_profiles` according to role and barangay-based scope.

- **[Field Alignment]**
  - Decide canonical field: `barangay` (string) or `barangay_id` (FK).
  - Update `src/app/api/incidents/route.ts` and clients to use the same field. Update `types` accordingly.

- **[API Centralization]**
  - Refactor `barangay/dashboard/page.tsx` to call `/api/incidents?role=BARANGAY&barangay=<value>` (or `barangayId=`) and handle 403 scope errors; keep client fallback minimal.

- **[Notifications UX]**
  - Add a reusable subscription banner component to prompt enabling push notifications; call `/api/notifications/subscribe` and persist preference.

- **[Service Worker parity]**
  - Create `app/offline/page.tsx` and add `public/offline-image.png` to match SW cache list.

- **[Consistency Pass]**
  - Verify all API routes use `{ success, code, message }` with proper HTTP status.
  - Standardize CSV export structure and filename patterns.

- **[Cleanups]**
  - Remove unsupported `lucide-react` icons and replace with available ones or generic UI.
  - Consolidate map helpers and volunteer availability updates.

## Verifications Requested (Status)
- **RLS**: Not found in repo; needs Supabase setup (SQL provided in guidance previously). Pending.
- **Field consistency**: Mismatch detected; needs alignment. Pending.
- **API integration for Barangay Dashboard**: Currently direct DB; recommend switching to `/api/incidents`. Pending.

## File References (non-exhaustive)
- `src/app/barangay/dashboard/page.tsx`
- `src/app/barangay/report/page.tsx`
- `src/app/barangay/handoffs/page.tsx`
- `src/app/admin/reports/page.tsx`
- `src/app/admin/incidents/[id]/page.tsx`
- `src/app/admin/incidents/[id]/brief/page.tsx`
- `src/app/api/incidents/route.ts`
- `src/app/api/notifications/(route.ts|send/route.ts|subscribe/route.ts|preferences/route.ts)`
- `src/app/api/analytics/(dashboard|hotspots|incidents/trends|response-times)/route.ts`
- `src/lib/incidents.ts`
- `src/components/ui/map-component.tsx`, `map-internal.tsx`, `map-offline.tsx`
- `public/manifest.json`, `public/service-worker.js`

## Closeout
- Core feature set is largely present and functional.
- Primary risks: missing RLS in repo, field mismatch, and mixed data-fetch pathways.
- Implement action plan to finalize security, consistency, and maintainability.
