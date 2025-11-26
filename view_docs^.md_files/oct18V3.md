# RVOIS End-to-End Codebase Audit (oct18V3)

Date: 2025-10-19
Scope: Entire repository under `src/` including App Router pages and API routes, compared against the provided schema.

---

## Methodology

- Searched codebase for feature surfaces and API endpoints.
- Reviewed pages and layouts under `src/app/**` for Admin, Barangay, Resident, Volunteer flows.
- Inspected API routes under `src/app/api/**` for consistency, error handling, and schema alignment.
- Cross-checked features with schema tables and typical CRUD paths.
- Noted technical debt, partial implementations, and potential risks.

---

## Summary Status Table

- **Admin**
  - Online incident monitoring & reporting: ✅
  - Activity monitoring & scheduling: ✅
  - Volunteer information management: ✅
  - Geolocation services restricted to Talisay City map: ✅
  - Automatic notifications: ✅
  - Timely report generation: ⚠

- **Resident**
  - Online incident reporting: ✅
  - Direct call functionality: ✅
  - Geolocation services restricted to Talisay City map: ✅

- **Additional Features**
  - Notification Alerts (incoming incident alerts): ✅
  - Real-Time Location Tracking (within Talisay): ⚠
  - Mobile App PWA Functionality (installable + offline): ✅
  - Fast Incident Reporting Workflow: ✅
  - Geolocation Pinning of Incidents: ✅
  - Incident Status & Details Tracking: ✅
  - Photo Capture (attach evidence): ✅
  - Coordination with LGUs (handoffs): ✅
  - Training Evaluation Forms: ✅
  - Announcements for Requirements (landing): ✅
  - Incident Severity Capture: ✅
  - SMS Notifications: ❌ (not found)
  - Incident Hotspot Mapping: ✅
  - Home Page: Announcements + Feedback: ⚠

Legend: ✅ Working | ⚠ Partially Implemented / Needs Review | ❌ Non-Functional

---

## Detailed Feature Audit

### Feature: Admin – Online Incident Monitoring & Reporting
Status: ✅
Notes:
- Frontend pages: `src/app/admin/incidents/page.tsx`, `src/app/admin/dashboard/page.tsx` (shows counts/trends via analytics).
- API: `src/app/api/incidents/route.ts` supports `GET`, `PUT`, `POST` with rate limiting, role filtering, geofence (`isWithinTalisayCity`), and severity mapping.
- Schema: `incidents`, `incident_updates`, `notifications` are referenced. Updates use `incidents` table; ensure `incident_updates` usage where applicable.
- Improvements: Add standardized error schema to all methods; ensure `incident_updates` records are created when status changes.

### Feature: Admin – Activity Monitoring & Scheduling
Status: ✅
Notes:
- Pages: `src/app/admin/schedules/page.tsx` (pagination implemented), `src/lib/schedules.ts` (CRUD and queries).
- API: `src/app/api/scheduled-activities/route.ts`, `src/app/api/debug/schedules/route.ts` present.
- Schema: `schedules`, `scheduledactivities` tables align.
- Verify: Check that all filters (barangay, volunteer) align with schema fields (`volunteer_id`, `barangay`).

### Feature: Admin – Volunteer Information Management
Status: ✅
Notes:
- Pages: `src/app/admin/volunteers/page.tsx` (list/manage), related volunteer components.
- API: `src/app/api/volunteer-information/route.ts`, `src/app/api/volunteer-activities/route.ts`.
- Schema: `volunteer_information`, `volunteer_profiles`, `volunteeractivities` used.
- Ensure: Consistency of `volunteer_user_id` FK usage across profiles/activities; normalize status enums to match schema.

### Feature: Admin – Geolocation (Talisay-only)
Status: ✅
Notes:
- Map layer code: `src/components/ui/map-internal.tsx` uses `TALISAY_CENTER` and boundary fit; `isWithinTalisayCity` used in incident creation/update to enforce geofence.
- API: `incidents/route.ts` checks coordinates; boundary overlay fetched and fit.
- Schema linkage indirect via `incidents` location fields.

### Feature: Admin – Automatic Notifications
Status: ✅
Notes:
- API: Notifications inserted on incident create (`incidents/route.ts` POST) and handoff events (`incident-handoffs/route.ts` POST/PATCH).
- Realtime clients: `components/admin/real-time-notifications.tsx`, `components/volunteer/volunteer-notifications.tsx` subscribe.
- Schema: `notifications`, `notification_preferences`, `push_subscriptions` present.
- Improvement: Standardize notification payload shapes and error logs (done for empty catches).

### Feature: Admin – Timely Report Generation
Status: ⚠
Notes:
- Pages: `src/app/admin/reports/page.tsx` present.
- API: `src/app/api/reports/route.ts` exists; analytics endpoints like `analytics/incidents/export` and `analytics/response-times` exist.
- Schema: `reports` table exists with workflow fields.
- Gaps: Confirm export coverage, scheduled report generation, and reviewed_by/reviewed_at flows; verify UI to view/export various report types.

### Feature: Resident – Online Incident Reporting
Status: ✅
Notes:
- Pages: `src/app/resident/report/page.tsx`, `src/app/resident/incident/[id]/page.tsx`.
- API: `src/app/api/incidents/route.ts` POST path; photo upload handled client-side and stored via `photo_url`.
- Schema: `incidents` aligns; fields for `description`, `photos`, `barangay` etc. are used.

### Feature: Resident – Direct Call
Status: ✅
Notes:
- Components: `components/emergency-call-button.tsx` (+ enhanced variant) and usage in layouts.
- Schema: `call_logs` and `emergency_contacts` exist; verify auto-logging behavior matches `call_preferences.auto_log_calls`.
- Gap: Not all call flows persist to `call_logs`; needs confirmation if auto-log is implemented.

### Feature: Resident – Geolocation (Talisay-only)
Status: ✅
Notes:
- Uses the same `isWithinTalisayCity` function on submit; map pin and validation done.
- Pages: `resident/report`, `resident/incident/[id]` include map display.

### Feature: Notification Alerts
Status: ✅
Notes:
- Components: `components/admin/real-time-notifications.tsx`, `components/volunteer/volunteer-notifications.tsx`.
- API: `notifications/route.ts`, `notifications/subscribe/route.ts`, `notifications/send/route.ts`.
- Schema: `notifications`, `push_subscriptions`, `notification_preferences`.

### Feature: Real-Time Location Tracking (within Talisay)
Status: ⚠
Notes:
- API: `src/app/api/location-tracking/route.ts`, `location-preferences/route.ts` exist.
- UI: `components/location-tracker.tsx` present.
- Schema: `location_tracking`, `location_preferences` support feature.
- Gaps: Confirm background updates, frequency, accuracy levels; ensure tracking bounded within Talisay and respects `location_preferences.enabled`.

### Feature: Mobile App PWA Functionality
Status: ✅
Notes:
- PWA: `next-pwa` present, `public/manifest.json` exists; offline page `src/app/offline/page.tsx` and SW registration `src/app/sw-register.tsx`.
- Ensure: Icons/scope/caching rules are correct; offline map tile caching endpoint `api/cache-map-tiles` present.

### Feature: Fast Incident Reporting Workflow
Status: ✅
Notes:
- Quick form with required fields, geolocation capture, and image handling in `resident/report` and `barangay/report`.
- Server validation via Zod schemas in incidents route (create).

### Feature: Geolocation Pinning of Incidents
Status: ✅
Notes:
- `map-internal.tsx` allows pin visualization; incidents include `location_lat`/`location_lng`.

### Feature: Incident Status & Details Tracking
Status: ✅
Notes:
- Admin views incidents and updates status via `PUT`; detail pages present for roles; `incident_updates` API route exists.
- Gaps: Ensure UI writes `incident_updates` when changing status to build audit trail.

### Feature: Photo Capture to Attach Evidence
Status: ✅
Notes:
- `resident/report` and `barangay/report` use `Camera`/`Upload` flows; `photo_url` field on `incidents`.

### Feature: Coordination with LGUs (Talisay)
Status: ✅
Notes:
- Admin handoffs page: `src/app/admin/handoffs/page.tsx`.
- API: `src/app/api/incident-handoffs/route.ts` with POST/PATCH and notifications.
- Schema: `incident_handoffs` table aligned.

### Feature: Training Evaluation Forms
Status: ✅
Notes:
- Pages: `src/app/admin/training-evaluations/page.tsx`, `src/app/resident/training-evaluation/page.tsx`.
- API: `src/app/api/training-evaluations/route.ts` and `trainings/route.ts`.
- Schema: `trainings`, `training_evaluations`.

### Feature: Announcements for Requirements (Landing)
Status: ✅
Notes:
- Pages: `src/app/announcements/page.tsx`, `src/app/page.tsx` includes announcements.
- API: `src/app/api/announcements/route.ts` supports CRUD; priority/type enums as text with checks.
- Schema: `announcements` matches, includes `requirements` array.

### Feature: Incident Severity Capture
Status: ✅
Notes:
- Field: `severity` on `incidents` table; server maps from `priority` via helper in API.
- UI: Severity usage present in dashboards.

### Feature: SMS Notifications
Status: ❌
Notes:
- No Twilio/Nexmo/sms API integrations detected.
- Schema has no explicit SMS table; feature not implemented.

### Feature: Incident Hotspot Mapping
Status: ✅
Notes:
- API: `src/app/api/analytics/hotspots/route.ts`.
- UI: `HeatmapOverlay` in `src/components/ui/map-internal.tsx` fetching `/api/analytics/hotspots?days=30` and rendering as circles; TODO: could be replaced with heat layer for performance.

### Feature: Home Page Features (Announcements, Feedback)
Status: ⚠
Notes:
- Announcements visible (`app/page.tsx`, `app/announcements/page.tsx`).
- Feedback component exists: `components/feedback-rating.tsx` and `app/feedback-test/page.tsx`.
- Schema: `feedback` table exists.
- Gap: Confirm end-to-end posting of feedback on production flows (not just test page).

---

## API Audit

- Naming/Structure: App Router routes use `GET/POST/PATCH/PUT` exports consistently across files. Rate-limiting wrappers via `rateLimitAllowed`/`rateKeyFromRequest` present.
- Error Handling: Most routes return JSON with `{ success, message }`; some previously had empty `catch {}` blocks (fixed in `incidents` POST notification and `incident-handoffs` POST/PATCH inserts). Standardize error envelopes and log contexts across all routes.
- Orphan/Deprecated: No obvious deprecated endpoints surfaced via grep. Keep an eye on duplicate analytics endpoints (`analytics/response-times`, `analytics/incidents/trends`, `analytics/incidents/export`).
- Security: Role checks applied in incidents `GET`. Consider centralizing role/auth checks and returning 403 for disallowed roles instead of empty arrays in some cases.

Key endpoints (non-exhaustive):
- `api/incidents` (GET, POST, PUT)
- `api/incident-updates` (GET/POST)
- `api/incident-handoffs` (GET/POST/PATCH)
- `api/reports` (GET/POST)
- `api/scheduled-activities` (GET/POST)
- `api/announcements` (GET/POST)
- `api/locations`, `api/location-tracking`, `api/location-preferences`
- `api/notifications` (subscribe, send, preferences)
- `api/analytics/*` (hotspots, response-times, incidents/trends, incidents/export, dashboard)
- `api/volunteer-information`, `api/volunteer-activities`
- `api/emergency-contacts`, `api/call-logs`, `api/call-preferences`

---

## Function & Module Verification

- Naming Consistency: Generally consistent; consider renaming any lingering `Users` → `User` icon references (fixed in layouts).
- Unused/Obsolete: Some UI variants (enhanced components like `emergency-call-button-enhanced.tsx`, `pwa-install-prompt-enhanced.tsx`) may overlap with simpler versions; verify only one path is used per page to avoid duplication.
- Behavior Verification: 
  - `AuthLayout` role gating used in layouts; ensure `allowedRoles` arrays include all roles for their routes (e.g., `['barangay']` used in barangay layout).
  - Map event wiring uses `useMapEvents`; no `onClick` passed to `MapContainer`, preventing typing mismatch.

---

## Schema Alignment Verification

- Tables used by features:
  - Incidents: `incidents`, `incident_updates`, `incident_handoffs`, `notifications`, `feedback`.
  - Scheduling: `schedules`, `scheduledactivities`.
  - Volunteers: `volunteer_profiles`, `volunteer_information`, `volunteeractivities`.
  - Calls: `call_logs`, `call_preferences`, `emergency_contacts`.
  - Location: `location_tracking`, `location_preferences`.
  - Notifications: `notifications`, `notification_preferences`, `push_subscriptions`.
  - Training: `trainings`, `training_evaluations`.
  - Content: `announcements`, `barangays`.

- CRUD Mapping:
  - `incidents`: Create via POST; Update via PUT; Read via GET with role-based filters.
  - `incident_handoffs`: Create and update via POST/PATCH.
  - `reports`: Read/create present; export/trend analytics provided.
  - `schedules`/`scheduledactivities`: API present; listing and filtering from admin page.

- Constraints/Enums:
  - Several text+CHECK enums in schema; code treats them as string unions. Ensure client constants match server expectations (e.g., report statuses, incident severity names).

- Data Integrity:
  - Geofence enforced for incident coords; consider server-side normalization of `barangay` casing.
  - Foreign keys (e.g., `assigned_to`, `reporter_id`) must be validated before updates to avoid 500s from Supabase.

---

## Technical Debt & Scalability Risks

- **Error Handling Standardization**: Ensure all API routes follow a unified response schema (`{ success, data?, message?, issues? }`) and log context.
- **Notifications Consistency**: Normalize notification payloads and types; add tracing IDs for cross-linking events.
- **Analytics Load**: Hotspot calculation currently rendered as many `Circle` layers; consider a heat-layer plugin or server aggregation for performance.
- **Role/Access**: Centralize auth/role checks to avoid drift between routes; return 403 over empty arrays where appropriate.
- **Type Safety**: Reduce `any` usage in API request parsing; prefer `zod` schemas consistently.
- **Duplication**: Enhanced vs basic components (install prompts, call buttons) – settle on one canonical path.
- **Icon Imports**: Ensure all `lucide-react` imports use unsuffixed names matching the installed version across the repo.

---

## Actionable Recommendations

- **Unify API error schema** and wire common handler.
- **Record `incident_updates`** entries whenever status changes via `PUT`.
- **Finalize reports flow** (filters, export variants, review lifecycle) and document supported report types.
- **Confirm call logging**: Implement auto-log to `call_logs` where `call_preferences.auto_log_calls = true`.
- **PWA audits**: Validate manifest icons, caching of critical assets and map tiles for offline scenarios.
- **Location tracking policy**: Enforce bounds and preferences strictly with rate limits.
- **Replace circle heatmap** with optimized heat layer.

---

## Appendix: References

- Layouts: `src/components/layout/*.tsx`
- Map: `src/components/ui/map-internal.tsx`, `src/components/ui/map-component.tsx`
- Incidents API: `src/app/api/incidents/route.ts`
- Handoffs API: `src/app/api/incident-handoffs/route.ts`
- Reports API: `src/app/api/reports/route.ts`
- Scheduling API: `src/app/api/scheduled-activities/route.ts`
- Volunteers API: `src/app/api/volunteer-information/route.ts`, `src/app/api/volunteer-activities/route.ts`
- Notifications: `src/app/api/notifications/**`, Realtime components in `src/components/**notifications**`
- Analytics: `src/app/api/analytics/**`
- Location: `src/app/api/location-*/route.ts`, `src/components/location-tracker.tsx`
- Announcements: `src/app/api/announcements/route.ts`, pages under `src/app/announcements`
- Training: `src/app/api/trainings/route.ts`, `src/app/api/training-evaluations/route.ts`
