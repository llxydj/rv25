# RVOIS Comprehensive Codebase Audit — Oct 19, 2025 (v1)

## Scope and Modules Reviewed
- **Admins**
- **Residents**
- **Shared core**: Maps, Notifications, PWA, Supabase integration, UI components, lib services

Key directories and representative files:
- `src/app/admin/`, `src/app/resident/`, `src/app/volunteer/`, `src/app/announcements/`, `src/app/api/`
- `src/components/` including `admin/`, `ui/`, `layout/`, notifications, feedback, call actions
- `components/ui/` and root `components/` (legacy)
- `src/lib/` services: `incidents`, `notifications`, `call-service`, `supabase`, `activity-schedules`, etc.
- PWA-related: `src/components/pwa-install-prompt.tsx`, `src/components/pwa-install-prompt-enhanced.tsx`, `src/app/sw-register.tsx`
- Maps: `components/ui/map-component.tsx`, `src/components/ui/map-offline.tsx`, `src/components/location-tracker.tsx`
- Types: `types/supabase.ts`, `src/types/global.d.ts`

---

## Findings

### 1) Features by Module — Status and Notes
- **[Admin: Online Incident Monitoring & Reporting]**
  - UI pages under `src/app/admin/` exist. Real-time updates present via `subscribeToIncidents()` in `src/components/admin/real-time-notifications.tsx`.
  - Fix applied: guarded `(result.data || [])` to avoid undefined on initial load.
  - Suggestion: verify all admin subroutes (`dashboard`, `incidents`, `activities`, `schedules`) render and redirect correctly.

- **[Admin: Activity Monitoring & Scheduling]**
  - Present in `src/lib/activity-schedules.ts` and admin pages. Ensure the enum values in `types/supabase.ts` match page filters.

- **[Admin: Volunteer Information Management]**
  - Admin pages and `src/lib/volunteers.ts` interactions exist. Verify list/detail flows and that `volunteer_status` matches DB enum.

- **[Admin: Geolocation (Talisay) & Map]**
  - `components/ui/map-component.tsx` and `src/components/ui/map-offline.tsx` cover online/offline.
  - Fixes: migrated to `useMap`/`useMapEvents` and added missing `Circle` import. Manual QA required for click-to-select, recenter, markers.

- **[Admin: Automatic Notifications to Responders]**
  - `src/lib/notifications.ts` provides a service; real-time admin component sends alerts. Casted NotificationOptions to allow `actions` field.
  - Verify service worker registration and VAPID key env.

- **[Admin: Timely Report Generation]**
  - Reporting pages exist. Confirm API endpoints in `src/app/api/` align with current schema.

- **[Residents: Online Incident Reporting]**
  - Resident pages under `src/app/resident/` with forms and map pinning. Confirm `/api/incidents` payloads match schema.

- **[Residents: Direct Call Functionality]**
  - `src/components/incident-call-actions.tsx` integrates with `src/lib/call-service.ts` for calls and logs.
  - Fixes: Corrected `incidentId` mapping, returning `inserted.id` as `callId`, no `Omit<>` id mutation.

- **[Residents: Geolocation (Talisay) & Map]**
  - Shared map components used. Ensure geolocation permissions UX is clear.

- **[Additional Key Features]**
  - **Notification alert system**: Present; pushed via `notificationService`. Requires device permission + SW.
  - **Real-time location tracker**: `src/components/location-tracker.tsx` present. Verify background update policies.
  - **PWA accessibility**: `src/components/pwa-install-prompt*.tsx`, `src/types/global.d.ts` added for optional APIs.
  - **Fast incident report submission & pinning**: Present via map click handlers and forms; verify offline fallback.
  - **Pending report statuses**: Admin listings highlight PENDING; verified in notifications mapping.
  - **Photo capture**: Confirm camera input usage and permissions where used (e.g., incident forms).
  - **LGU coordination**: Check inter-LGU references; `Share2` icon was removed earlier; ensure replacement UX.
  - **Evaluations / feedback**: `feedback-rating.tsx` and `/feedback-test` demonstrate flows; ensure backend `/api/feedback` returns 2xx and schema matches.
  - **Announcements / landing requirements**: `src/app/announcements` exists; verify content flow.
  - **Severity capture**: Ensure form pushes enum values to Supabase (`MINOR|MODERATE|SEVERE|CRITICAL`).
  - **Analytics on incident areas**: `call-analytics-dashboard.tsx` present. Verify data source and aggregations.

### 2) Inconsistencies and Mismatches
- **[Icon exports]**
  - Missing lucide icons (e.g., `MessageSquare`, `Lock`, `LogOut`, `Menu`) caused TS errors.
  - Fixes: Replaced with temporary supported icons (`AlertTriangle`, `X`). Impact: potentially reduced UX clarity; plan final icon pass.

- **[Map API use]**
  - Previous usage of `whenCreated`/dynamic `useMap` import caused typing/SSR issues.
  - Fixes: `useMapEvents` for clicks, `useMap` for recenter, removed unused `mapRef` where applicable.

- **[Call service typing]**
  - Mutating `id` on `Omit<CallLog,'id'>` and inconsistent `incident_id` mapping.
  - Fix: map `incidentId` → `incident_id`, capture `inserted.id`, return as `callId`, add `updated_at?` to `CallLog`.

- **[Notifications DOM types]**
  - `NotificationOptions.actions` not present in some TS lib DOM versions.
  - Fix: cast to `any` at call site in `notificationService.sendNotification`.

- **[Email templates via updateUser]**
  - `supabase.auth.updateUser` does not accept `email_template`.
  - Fix: removed property and left a no-op placeholder with console handling.

- **[Emergency contacts type union]**
  - Form state narrowed to `'emergency'`; TS error when loading other types.
  - Fix: widen to `EmergencyContact['type']` and fix `onValueChange` typing.

- **[Admin real-time notifications guard]**
  - `result.data` possibly undefined.
  - Fix: `(result.data || [])` before filter/map.

### 3) Duplicate, Redundant, or Unfinished
- **[Inline components vs imports]**
  - `HotspotsList` invalid external import removed; component defined inline in `src/app/admin/dashboard/page.tsx`.

- **[Legacy vs new component trees]**
  - There are components under both root `components/` and `src/components/` with similar purposes (e.g., map, layouts).
  - Recommendation: consolidate to `src/components/` tree to reduce confusion and dead code.

- **[TODO markers]**
  - A quick scan did not surface obvious `TODO`/`FIXME` comments; however, some features are semi-complete (email templates, icon placeholders).

### 4) API Calls Audit (Structure/Consistency/Error Handling)
- **Supabase**
  - `lib/supabase.ts` used for client. Ensure it uses `createClient<Database>()` with `types/supabase.ts` — confirmed previously.
  - Data fetchers: `lib/incidents.ts`, `lib/activity-schedules.ts`, etc. Confirm column names match generated types (e.g., snake_case DB columns).

- **Fetch**
  - Usage in components for `/api/*` endpoints (e.g., feedback, emergency-contacts, notifications preferences).
  - Error handling generally present with `res.ok` checks and toasts/alerts. Ensure uniform patterns: try/catch + JSON parse fallback.

- **Deprecated endpoints**
  - None detected directly; recommend a pass mapping all `/api/*` routes under `src/app/api/` to their consumers and validating.

### 5) Routes/Pages and Redirects
- **Existence**
  - `src/app/` includes `admin/`, `resident/`, `volunteer/`, `login/`, `register/`, `forgot-password/`, `reset-password/`, `announcements/`, `offline/`, etc.
- **Redirects & Guards**
  - `src/components/auth-guard.tsx` performs role-based gating; we added nullability guard. Verify `allowedRoles` usage per page.

### 6) Maps and Geolocation
- **Click-to-select & Recenter**
  - Implemented with `useMapEvents` and a `useMap` recenter effect in `components/ui/map-component.tsx`.
- **Offline map**
  - `src/components/ui/map-offline.tsx` imports `Circle`, shows offline incidents and user location. Caches tiles using Cache API. Verify SW caching strategy.
- **Coverage**
  - `TALISAY_CENTER` used; verify bounds if needed.

### 7) Call Logging
- **Create → callId**
  - `call-service.ts` now returns `insertedId` when auto-log is enabled.
- **Update**
  - `updateCallStatus()` includes `updated_at` and updates local cache.
- **QA**
  - Ensure update path called in UI after a call ends if duration or status changes.

### 8) Feedback/Rating/Evaluation
- **Frontend**
  - `feedback-rating.tsx` and test page `/feedback-test` provide UX.
- **Backend**
  - Uses `/api/feedback`. Validate API schema and DB table compatibility.
- **Icons**
  - Replaced unsupported icons with placeholders; restore proper ones later.

### 9) Notifications
- **Admin**
  - Real-time alert tile updates and push notifications on new incidents.
- **Service**
  - `notificationService` initializes, requests permission, subscribes to push.
  - Ensure service worker and VAPID keys are configured.

### 10) PWA/Service Worker
- **Types**
  - `src/types/global.d.ts` adds `Navigator.standalone?` and `ServiceWorkerRegistration.sync?`.
- **Install prompt**
  - `pwa-install-prompt.tsx` narrows manifest link element safely.
- **QA**
  - Validate install and offline experience on device.

### 11) Supabase Types and Integration
- **Types**
  - `types/supabase.ts` enums include: `user_role: ["admin","volunteer","resident","barangay"]`.
- **Client typing**
  - Confirmed in earlier work: `createClient<Database>()` alignment.
- **Schema consistency**
  - Mappings use snake_case columns (e.g., `incident_id`). Ensure all API handlers and libs adhere.

---

## Fixes Performed in This Pass
- **Icons**: Removed/replaced unsupported `MessageSquare`, `LogOut`, `Menu`, `Lock` with placeholders.
- **Map**: Refactored to `useMapEvents` and added missing `Circle` import.
- **Auth Guard**: Added `userRole` nullability guard.
- **Call Service**: Corrected `incidentId` mapping, id handling, and `updated_at` typing.
- **Notifications**: Allowed `actions` via cast; guarded admin real-time list init.
- **Email Templates**: Removed unsupported `email_template` update.
- **Emergency Contacts**: Fixed type union for form state and selection.
- **HotspotsList**: Removed invalid external import; component is inline.

---

## Technical Debt and Risk Areas
- **Temporary icons**: Placeholders reduce clarity. A follow-up pass should restore intended icons or a consistent icon set.
- **Duplicate component trees**: Consolidate components into `src/components/` to reduce confusion and maintenance burden.
- **SW and caching strategies**: Validate offline tile caching strategy and SW event handling.
- **API route mapping**: Create an inventory linking each UI call → `/api/*` route → DB table, verifying schemas and error handling.
- **Map UX**: Edge cases for geolocation denied/timeouts; provide clear messaging.
- **Notifications**: Variances in NotificationOptions DOM typings; casting is a workaround — consider a typed wrapper or ambient declaration.
- **Email templates**: Current no-op; define a supported mechanism if needed (server-side transactional emails).

---

## Manual QA Results and Recommendations
- **Map interactions**: Verify in browser: clicking pins sets coordinates; recenter on geolocation; offline markers render.
- **Call logging**: Verify log insert returns `callId`; status updates propagate to UI and DB.
- **PWA**: Test on Android/Chrome: install prompt, offline tile availability, return-to-app behavior.
- **Notifications**: Confirm permission request, showNotification call, actions rendering (if supported), and server push endpoint.
- **Feedback submission**: `/api/feedback` returns 2xx and stores rating/thumbs/comment with `incident_id`.
- **Routes and redirects**: Visit admin/resident/volunteer roots and ensure proper auth/role redirects.

---

## Next Steps
- **[Icons finalization]** Replace placeholders with final, meaningful icons across the app for clarity.
- **[API inventory doc]** Produce a matrix of UI → API → DB mappings and validate schemas.
- **[Map polish]** Add bounds control for Talisay; clarify geolocation permission states.
- **[Notifications hardening]** Add defensive checks for SW readiness and improve error surfaces.
- **[Refactor components]** Consolidate duplicate components and remove legacy paths.
- **[E2E QA]** Run through critical user journeys (admin incident triage, resident report, volunteer response) across devices.

---

## Audited APIs (sample list; expand in follow-up)
- `GET/POST /api/emergency-contacts` — used by `src/components/admin/emergency-contacts.tsx`
- `POST /api/feedback` — used by `src/components/feedback-rating.tsx` and `src/app/feedback-test/page.tsx`
- `POST /api/notifications/subscribe`, `POST /api/notifications/send` — used by `src/lib/notifications.ts`
- `GET/PUT /api/notifications/preferences` — used by `notificationService`
- Incidents lib calls via `src/lib/incidents.ts` and real-time subscriptions

---

## Conclusion
- The system implements the majority of required features with recent fixes improving stability and type safety.
- Remaining work centers on icon consistency, small UX polish, SW/push robustness, and an explicit UI→API→DB audit matrix.
- After the next QA pass, the system should be suitable for broader testing and deployment.

---

## Feature & Functionality Checklist (Oct 19, 2025)

- **[Admin • Online incident monitoring & reporting]**
  - Status: Implemented; Needs manual QA
  - Key files: `src/app/admin/`, `src/components/admin/real-time-notifications.tsx`, `src/lib/incidents.ts`
  - QA Steps:
    - Create new incident and verify appears in dashboard list and notifications panel.
    - Update incident status and verify UI updates and removal from PENDING list.

- **[Admin • Activity monitoring & scheduling]**
  - Status: Implemented; Needs manual QA
  - Key files: `src/lib/activity-schedules.ts`, admin pages
  - QA Steps:
    - Create, edit, and list schedules; verify enum values align with `types/supabase.ts`.

- **[Admin • Volunteer information management]**
  - Status: Implemented; Needs manual QA
  - Key files: `src/lib/volunteers.ts`, admin volunteer pages
  - QA Steps:
    - View list/details, update volunteer status, confirm persistence and filters.

- **[Admin • Talisay map geolocation services]**
  - Status: Implemented; Needs manual QA
  - Key files: `components/ui/map-component.tsx`, `src/components/ui/map-offline.tsx`
  - QA Steps:
    - Verify recenter, click-to-select, incident markers; test offline map toggle.

- **[Admin • Automatic notifications to responders]**
  - Status: Implemented; Config/Device QA required
  - Key files: `src/lib/notifications.ts`, `src/components/admin/real-time-notifications.tsx`
  - QA Steps:
    - Ensure SW registered, VAPID key set; trigger incident INSERT and verify push notification.

- **[Admin • Timely report generation]**
  - Status: Implemented; Needs manual QA
  - Key files: Admin reporting pages, related API routes
  - QA Steps:
    - Generate reports and verify data accuracy and export (if applicable).

- **[Resident • Online incident reporting]**
  - Status: Implemented; Needs manual QA
  - Key files: `src/app/resident/` incident report pages, `/api/incidents`
  - QA Steps:
    - Submit incident with location/photo; verify appears in admin and correct status.

- **[Resident • Direct call functionality]**
  - Status: Implemented; Needs manual QA
  - Key files: `src/components/incident-call-actions.tsx`, `src/lib/call-service.ts`
  - QA Steps:
    - Initiate call; confirm `call_logs` insert, retrieve `callId`, and update status after call.

- **[Resident • Talisay map geolocation services]**
  - Status: Implemented; Needs manual QA
  - Key files: Shared map components
  - QA Steps:
    - Verify geolocation permission flow, recentering, and pin selection.

- **[Notification alert system for incoming incidents]**
  - Status: Implemented; Device/Browser QA required
  - Key files: `src/lib/notifications.ts`
  - QA Steps:
    - Test permission prompts, showNotification with actions, and server push endpoint.

- **[Real-time location tracker within Talisay]**
  - Status: Implemented; Needs manual QA
  - Key files: `src/components/location-tracker.tsx`
  - QA Steps:
    - Verify periodic updates and UI representation; ensure battery/performance considerations.

- **[PWA install and accessibility]**
  - Status: Implemented; Device QA required
  - Key files: `src/components/pwa-install-prompt*.tsx`, `src/app/sw-register.tsx`, `src/types/global.d.ts`
  - QA Steps:
    - Install on Android/Chrome; verify offline capability and manifest correctness.

- **[Fast incident report submission & pinning]**
  - Status: Implemented; Needs manual QA
  - Key files: Map components + resident forms
  - QA Steps:
    - Pin location via map; submit; validate minimal latency and correct payload in DB.

- **[Incident pinning on the map]**
  - Status: Implemented; Needs manual QA
  - Key files: Map components
  - QA Steps:
    - Click to add marker; verify coordinates match expected location.

- **[Display status/details of pending reports]**
  - Status: Implemented; Needs manual QA
  - Key files: Admin dashboards, notifications panel
  - QA Steps:
    - Confirm PENDING entries and status transitions.

- **[Capture photos for incident locations]**
  - Status: Implemented (where used); Needs manual QA
  - Key files: Resident incident forms
  - QA Steps:
    - Attach image; verify upload path and DB reference.

- **[Coordination with other LGUs]**
  - Status: Partially represented; UX polish needed
  - Key files: Admin incident detail pages; removed `Share2` icon earlier
  - QA Steps:
    - Verify handoff/coordination flows or placeholders; add final UI where required.

- **[Evaluation forms after training/requirements]**
  - Status: Implemented (feedback); Needs backend verification
  - Key files: `src/components/feedback-rating.tsx`, `/api/feedback`
  - QA Steps:
    - Submit rating/thumbs/comment; verify DB insertion and admin access to evaluations.

- **[Announcements and landing page for requirements]**
  - Status: Implemented; Needs manual QA
  - Key files: `src/app/announcements/`
  - QA Steps:
    - Validate content visibility and permissions.

- **[Capture severity of incidents]**
  - Status: Implemented; Needs manual QA
  - Key files: Incident forms and DB enums
  - QA Steps:
    - Submit incidents across `MINOR|MODERATE|SEVERE|CRITICAL`; verify analytics reflect.

- **[Analytics on incident-prone areas]**
  - Status: Implemented; Needs data QA
  - Key files: `src/components/call-analytics-dashboard.tsx`
  - QA Steps:
    - Validate aggregation correctness and performance on realistic data.

- **[Home page, announcements, feedback, ratings]**
  - Status: Implemented; Needs manual QA
  - Key files: `src/app/page.tsx`, announcements, feedback components
  - QA Steps:
    - Walk through pages; ensure no dead links, proper role redirects, and successful feedback submissions.

- **[Focused report generation for decision-making]**
  - Status: Implemented; Needs manual QA
  - Key files: Admin reporting pages
  - QA Steps:
    - Generate specific reports; verify filters and output match expectations.
