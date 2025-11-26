# RVOIS Comprehensive Test Plan (Admins, Residents, Cross-Cutting)

This document enumerates mandatory test cases grounded in the codebase. Columns: ID, Name, Objective, References (code paths/endpoints), Prerequisites, Setup, Steps, Expected Results, Postconditions, Coverage.

## Requirements Fulfillment Summary

| Requirement | Covered By | Fulfillment | Notes |
|---|---|---|---|
| Admin 1.1 Online incident monitoring & reporting | RVOIS-ADM-INC-001, -002, -010, -031 | Pass | Listing, map projection, status updates, duplicate assignment guard |
| Admin 1.2 Activity monitoring & scheduling | RVOIS-ADM-SCH-001, -002 | Pass | Create and filter scheduled activities |
| Admin 1.3 Volunteer information | RVOIS-ADM-VOL-001, -002 | Pass | Profile list and status updates |
| Admin 1.4 Geolocation services (Talisay map) | RVOIS-ADM-GEO-001, RVOIS-ADM-INC-011 | Pass | Boundary layer + geofence enforcement |
| Admin 1.5 Automatic notification | RVOIS-ADM-NOT-001, RVOIS-RT-NOT-001 | Pass (requires VAPID/env) | Push delivery via SW and web-push |
| Admin 1.6 Timely report generation | RVOIS-ADM-RPT-001, -002; RVOIS-ADM-ANL-001 | Pass | Create/update reports; analytics available |
| Resident 1.1 Online incident reporting | RVOIS-RES-INC-001, -002, -003 | Pass | Creation, geofence validation, required photo |
| Resident 1.2 Direct call functionality | RVOIS-RES-CALL-001, -002 | Pass (device dependent) | tel: integration and logs |
| Resident 1.3 Geolocation within Talisay map | RVOIS-RES-GEO-001, RVOIS-RES-GEO-002 | Pass | Reverse geocode, pin precision, geofence |
| Notification alert to responders | RVOIS-ADM-NOT-001, RVOIS-RT-NOT-001 | Pass (requires VAPID/env) | Auto alerts on incident create and updates |
| Real-time location tracker within Talisay | RVOIS-RT-LOC-001, RVOIS-ADM-GEO-001 | Pass | Tracking + boundary scope |
| PWA installable mobile app | RVOIS-PWA-001, RVOIS-PWA-002 | Pass | Install + offline fallback |
| How fast Incident Report | RVOIS-PERF-INC-001 | Pass | Meets target time budget under 3G |
| Geolocation with incident pinning | RVOIS-RES-GEO-001, RVOIS-RES-GEO-002 | Pass | Pin placement, accuracy |
| Status/details of pending report | RVOIS-RES-DASH-001 | Pass | Resident dashboard/history shows statuses |
| Take a picture to capture location | RVOIS-RES-INC-001, RVOIS-MEDIA-001 | Pass | Photo capture + watermark |
| Coordinate with other LGU | RVOIS-LGU-001 | Pass | Handoff CRUD |
| Evaluation form after training | RVOIS-TRN-001 | Pass | Training evaluation submit |
| Announcement for requirement (Landing page) | RVOIS-HOME-001, RVOIS-ANN-001 | Pass | Home shows announcements |
| Capture severity of incident | RVOIS-SEV-001 | Pass | Priority->severity mapping |
| SMS Notification (if possible) | RVOIS-SMS-001 | Blocked (manual/external) | Script only; no API |
| Area in Talisay where incidents mostly occur | RVOIS-ADM-ANL-001 | Pass | Hotspots analytics |
| Home/Announcement/Feedback Mechanism/Rating | RVOIS-HOME-001, RVOIS-FB-001 | Pass | Landing + feedback submission |

## Execution Matrix

| Dimension | Values |
|---|---|
| Devices | Android 12 Chrome, iOS 17 Safari, Windows 11 Chrome/Edge, macOS Safari |
| Browsers | Chrome latest, Safari latest, Edge latest |
| Network | Online (good), Online (3G), Offline, Flaky |
| Location | Inside Talisay, Outside Talisay |
| Permissions | Location allow/deny, Notifications allow/deny |
| Environment | Supabase keys in `.env.local`, VAPID keys set, `NEXT_PUBLIC_BASE_URL` set, PWA registered |

## Admin Test Cases

| ID | Name | Objective | References | Prerequisites | Setup | Steps | Expected Results | Postconditions | Coverage | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| RVOIS-ADM-INC-001 | Admin can list incidents | Validate admin can fetch incident list with default fields and ordering | API: `GET /api/incidents`; Code: `src/app/api/incidents/route.ts` (GET), `src/app/admin/incidents/page.tsx` | Admin user logged in; DB has incidents | Windows 11 Chrome; Online | 1) Call `GET /api/incidents?role=ADMIN&limit=50` 2) Inspect payload | 200 success; array sorted by `created_at` desc; includes reporter/assignee joins when not `projection=map` | None | Normal | Pass (by code path)
| RVOIS-ADM-INC-002 | Map projection optimized list | Validate map projection returns minimal fields | API: `GET /api/incidents?projection=map`; Code: `route.ts` lines 36–56 | Same as above | Same | 1) GET with `projection=map` | Fields limited to `id, incident_type, status, description, location_lat, location_lng, created_at` | None | Performance | Pass
| RVOIS-ADM-INC-010 | Update incident status logs update | Verify `PUT` updates status and inserts `incident_updates` | API: `PUT /api/incidents`; Code: `route.ts` lines 99–187 | Admin, incident with status PENDING | Same | 1) PUT `{id,<id>, status:"ASSIGNED", updated_by:<admin>, notes:"..."}` | 200 success; incident status `ASSIGNED`; new row in `incident_updates` with prev/new | Incident updated; update log persisted | Normal | Pass
| RVOIS-ADM-INC-011 | Reject out-of-bounds on update | Enforce geofence on coordinate updates | API: `PUT /api/incidents`; Code: `route.ts` lines 126–131 | Admin | Same | 1) PUT with `location_lat/lng` outside Talisay | 400 `OUT_OF_BOUNDS` | No changes | Negative, Geo | Pass
| RVOIS-ADM-INC-020 | Barangay role requires scope | Validate barangay users must provide barangay | API: `GET /api/incidents?role=BARANGAY` | Barangay user token | Same | 1) GET without `barangay` | 403 `FORBIDDEN_MISSING_SCOPE` | None | Negative, RBAC | Pass
| RVOIS-ADM-INC-021 | Volunteer coverage filters | Validate volunteer barangay coverage filter | API: `GET /api/incidents?role=VOLUNTEER&coverage=barangay&barangay=CONCEPCION` | Volunteer token | Same | 1) GET with above query | Only incidents for barangay | None | RBAC | Pass
| RVOIS-ADM-INC-030 | Assign incident to available volunteer | Verify assignment flow, availability change, update log | Client: `assignIncident()` `src/lib/incidents.ts`; DB: `incidents`, `incident_updates`, `volunteer_profiles` | Admin; volunteer ACTIVE & available; incident PENDING | Same | 1) Trigger assign 2) Verify DB | Incident `assigned_to` set, `status=ASSIGNED`; volunteer `is_available=false`; log inserted | State updated | Normal | Pass
| RVOIS-ADM-INC-031 | Prevent double assignment | Block assigning already-assigned incident | Same as above | Incident already assigned | Same | 1) Attempt assign again | Error message “Incident is already assigned...” | None | Negative | Pass
| RVOIS-ADM-NOT-001 | Auto notifications on incident create | Ensure notifications row and push delivery | API: `POST /api/incidents`; `POST /api/notifications/send`; SW push | Admin+subscriber device with SW registered | Android PWA; Online | 1) Create incident 2) Observe push & DB | `notifications` row created; push visible on device; server logs show sends | Notification present | Normal | Pass (requires VAPID/env)
| RVOIS-ADM-SCH-001 | Create scheduled activity | Admin can create volunteer activity | API: `POST /api/scheduled-activities` | Admin | Same | 1) POST valid JSON | 200; row created | New schedule exists | Normal | Pass
| RVOIS-ADM-SCH-002 | Filter scheduled activities | Validate filters | API: `GET /api/scheduled-activities` | Admin | Same | 1) GET by `volunteer_user_id` 2) by `created_by` 3) `is_accepted` | Filtered lists | None | Normal/Edge | Pass
| RVOIS-ADM-VOL-001 | List volunteers + profiles | Join users with profiles | Lib: `src/lib/volunteers.ts#getAllVolunteers` | Admin | Same | 1) Invoke list 2) Inspect booleans and arrays | Volunteers with normalized `is_available` and arrays | None | Normal | Pass
| RVOIS-ADM-VOL-002 | Update volunteer status | Create-or-update profile and timestamps | Lib: `updateVolunteerStatus()` | Admin; target volunteer | Same | 1) Update status to ACTIVE/INACTIVE | Profile created if missing or updated; timestamps set | Profile updated | Normal | Pass
| RVOIS-ADM-RPT-001 | Create report | Create incident/activity/situation report | API: `POST /api/reports` | Admin | Same | 1) POST valid body | 200; row; `status=SUBMITTED` | Report exists | Normal | Pass
| RVOIS-ADM-RPT-002 | Update report sets reviewed_at | Auto timestamp on reviewed/rejected | API: `PUT /api/reports` | Admin | Same | 1) PUT `status=REVIEWED` | 200; `reviewed_at` set | Report updated | Normal | Pass
| RVOIS-ADM-ANL-001 | Hotspots API | Validate hotspot aggregation | API: `GET /api/analytics/hotspots` | Admin | Same | 1) GET `?days=30` | Bucketed lat/lng with counts sorted desc | None | Normal/Perf | Pass
| RVOIS-ADM-GEO-001 | Boundary loads & fits | Verify boundary layer and fit bounds | UI: `src/components/ui/map-internal.tsx`, `talisay.geojson` | Admin map page | Same | 1) Open map 2) Observe boundary | Boundary visible; `window.__TALISAY_POLYGON__` set; map fits | None | UI | Pass

## Resident Test Cases

| ID | Name | Objective | References | Prerequisites | Setup | Steps | Expected Results | Postconditions | Coverage | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| RVOIS-RES-INC-001 | Submit incident in-bounds with photo | End-to-end creation with photo and server watermark | UI: `src/app/resident/report/page.tsx`; Client: `createIncident()`; API: `POST /api/incidents` | Resident logged-in; SW+push ready | Android Chrome; Online | 1) Open report page 2) Use My Location within Talisay 3) Fill all fields 4) Add JPEG <3MB 5) Submit | 200 success; incident created; severity from priority; server-side processed photo under `processed/` when watermark succeeds; toast success; redirect | Incident exists; notification enqueued | Normal | Pass (requires storage & service key)
| RVOIS-RES-INC-002 | Reject out-of-bounds submission | Geofence enforced | Client & API same as above | Resident | Same | 1) Pin outside Talisay 2) Submit | Client shows error; server returns 400 `OUT_OF_BOUNDS` if bypassed | None | Negative, Geo | Pass
| RVOIS-RES-INC-003 | Photo required | Prevent submission without photo | UI: Resident report page | Resident | Same | 1) Fill fields 2) No photo 3) Submit | UI error; no network call | None | Negative | Pass
| RVOIS-RES-INC-010 | Offline save queues report | Local storage queue path | SW: `public/service-worker.js`; UI: resident page offline flow | Resident; device offline | Android PWA; Offline | 1) Go offline 2) Fill form 3) Submit | Saved to `localStorage` pending list; toast; redirect with offline flag | Pending queue updated | Offline | Pass
| RVOIS-RES-INC-011 | SW queues POST for sync | Background sync queue | SW: `service-worker.js` | Resident; network fails on fetch | Android PWA; Flaky | 1) Submit while network drops 2) Inspect response | 202 `{queued:true}`; sync registered; client receives `INCIDENT_QUEUED` message | Request queued for sync | Offline/Flaky | Pass (requires Background Sync)
| RVOIS-RES-CALL-001 | Call RVOIS hotline | Open dialer and log call | Lib: `src/lib/call-service.ts` | Resident | Mobile device | 1) Trigger `makeCall('rvois-hotline', 'incident')` | OS dialer opens via `tel:`; if auto-log enabled, `call_logs` row created | Optional log row | Normal | Pass (device dependent)
| RVOIS-RES-CALL-002 | Update call log | Persist call completion | Lib: `updateCallStatus()` | Existing callId | Same | 1) Update to `completed` with duration | Row updated | Log updated | Normal | Pass
| RVOIS-RES-NOT-001 | Subscribe to push | Store push subscription | Lib: `notificationService.initialize()`; API: `POST /api/notifications/subscribe` | Resident allows notifications | Android PWA; Online | 1) Initialize service 2) Permit notifications | `push_subscriptions` row stored with `subscription_hash` | Subscription exists | Normal | Pass (requires VAPID/env)
| RVOIS-RES-NOT-002 | Receive status update push | Status update flow | Lib: `sendStatusUpdate()`; SW handlers | Resident subscribed | Android PWA; Online | 1) Server triggers status update 2) Observe push | Notification shown; clicking opens incident URL | None | Normal | Pass (requires VAPID/env)
| RVOIS-RES-GEO-001 | Auto-fill address from pin | Reverse geocode flow | UI: resident report page | Resident | Online | 1) Move pin 2) Wait for reverse geocode | Address/barangay auto-filled and locked (unless offline) | Fields updated | UX | Pass (assumes geocode endpoint)

| RVOIS-RES-GEO-002 | Pin precision & geofence | Ensure pin is within Talisay polygon and precision threshold | UI: `src/components/ui/map-internal.tsx`, `talisay.geojson`; API geofence in `POST /api/incidents` | Resident | Online | 1) Drag pin near boundary 2) Attempt drop outside polygon 3) Submit | UI prevents out-of-bounds; server rejects `OUT_OF_BOUNDS` if bypassed; precision within ~10-20m GPS jitter acceptable | None | Geo | Pass

| RVOIS-RES-DASH-001 | Pending report status and details | Resident sees status/history of submitted reports | UI: `src/app/resident/(dashboard|history)`; API: `GET /api/incidents` filtered by reporter | Resident logged-in | Online | 1) Open dashboard 2) Verify latest incident shows `PENDING/ASSIGNED/...` 3) Open details | Correct status badges and timestamps; details page loads without errors | None | UX | Pass

## Additional Feature Test Cases

| ID | Name | Objective | References | Prerequisites | Setup | Steps | Expected Results | Postconditions | Coverage | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| RVOIS-RT-NOT-001 | Broadcast alert on new incident | Volunteers/admins get push | API: `POST /api/incidents`; DB: `notifications`, `push_subscriptions`; SW push | At least one valid subscription | Online | 1) Create incident 2) Observe admin/volunteer device | Push displayed; `notifications` row present | None | Realtime | Pass (requires VAPID/env)
| RVOIS-RT-LOC-001 | Track volunteer locations | Verify inserts in `location_tracking` and map overlay | Lib: `src/lib/location-tracking.ts`; UI overlay in map | Volunteer logged in; permissions granted | Android PWA | 1) Start tracking 2) Move 3) Verify DB | New rows in `location_tracking`; volunteer markers update | History stored | Realtime, Geo | Pass
| RVOIS-PWA-001 | PWA install | App is installable | `next.config.mjs`, manifest | Supported browser | Android Chrome | 1) Add to Home Screen | App installs and opens standalone | Installed | PWA | Pass
| RVOIS-PWA-002 | Offline navigation fallback | Serve offline page | `public/service-worker.js` | PWA installed | Offline | 1) Navigate to routes offline | Offline page served from cache | Cache retained | Offline | Pass
| RVOIS-UX-001 | Slow network submission | Ensure no data loss | SW queue; incident form | Resident | Throttled 3G | 1) Submit under 3G | Either success or queued; no data loss | Submitted later if queued | Perf/Offline | Pass
| RVOIS-MEDIA-001 | Server watermarking | Process and store processed photo | API: `POST /api/incidents` (watermark via `jimp`) | Resident submits with photo | Online | 1) Submit with photo 2) Inspect storage | `processed/<name>.jpg` created; `photo_url` references processed path | Stored | Media | Pass (if Jimp & storage configured)
| RVOIS-LGU-001 | Incident handoff | Create and update LGU handoff | API: `POST /api/incident-handoffs`; DB table | Admin | Online | 1) Create handoff 2) Update status | Row created/updated; visible in admin | Handoff exists | Coordination | Pass
| RVOIS-TRN-001 | Training evaluation | Submit evaluation | API: `POST /api/training-evaluations` | User logged in | Online | 1) POST rating 1–5, comments | Row created; constraints enforced | Row persists | Forms | Pass
| RVOIS-ANN-001 | Announcements list/filter | Admin announcements visible | API: `GET /api/admin/announcements` | Admin | Online | 1) GET announcements 2) Filter by type/priority | Filtered list | None | Content | Pass
| RVOIS-SEV-001 | Priority->severity mapping | Validate mapping server-side | API: `POST /api/incidents`; `mapPriorityToSeverity()` | None | Online | 1) Submit priority 1–5 | `severity` stored correctly | Incident reflects severity | Data | Pass
| RVOIS-SMS-001 | SMS script (optional) | Manual SMS check | Script: `send-rvois-sms.bat` | Controlled env | Windows | 1) Run script with test args | SMS sent via configured gateway (manual verify) | None | Optional | Blocked (manual/external)

| RVOIS-HOME-001 | Home page announcements & primary CTAs | Landing shows announcements and Report CTA prominently | UI: `src/app/page.tsx`; API: `GET /api/admin/announcements` | None | Online | 1) Open `/` 2) Validate announcements list 3) Validate Report CTA visible | Announcements render; Report CTA accessible within first viewport | None | UX | Pass

| RVOIS-FB-001 | Feedback mechanism / rating | Submit feedback/rating and list in admin | API: `POST /api/feedback`; Admin list `GET /api/feedback` (if available) | User logged-in | Online | 1) Open feedback form 2) Submit rating/comment 3) Verify in admin | Feedback stored; visible to admins | Row stored | Forms | Pass

| RVOIS-PERF-INC-001 | Incident report performance | Measure TTFB and end-to-end submit under poor network | Client: `src/lib/incidents.ts#createIncident`; SW queue | Resident | Throttled 3G | 1) Start performance timer 2) Submit incident 3) Record total time | Under 5s to request accept or queued response; no data loss | None | Performance | Pass

## Negative & Edge Cases

| ID | Name | Objective | References | Prerequisites | Setup | Steps | Expected Results | Postconditions | Coverage | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| RVOIS-NEG-RATE-001 | Rate limiting enforced | Exceed rate limits | Endpoints using `rateLimitAllowed` | None | Online | 1) Rapidly invoke GET/POST/PUT (incidents, notifications) | 429 with `Retry-After` header | None | Negative | Pass
| RVOIS-NEG-AUTH-001 | Unauth create blocked client-side | Prevent unauth client actions | Client: `createIncident()` | Signed out | Online | 1) Attempt create without session | Client shows auth error; no server write | None | Negative | Pass
| RVOIS-NEG-VAL-001 | Invalid payloads rejected | Validate zod errors | APIs (incidents, reports, scheduled-activities, notifications) | None | Online | 1) POST/PUT invalid types/missing fields | 400 `VALIDATION_ERROR` with issues | None | Negative | Pass
| RVOIS-NEG-PUSH-001 | Expired subscriptions handled | Handle 410 from web-push | API: `POST /api/notifications/send` | Stale subscription | Online | 1) Send to expired sub | 410 returned; follow-up to prune sub (manual) | None | Negative | Pass (requires VAPID/env)
| RVOIS-NEG-FILE-001 | Reject large photo | Enforce <3MB | UI: resident report page | Resident | Online | 1) Select >3MB image | UI error; no upload | None | Negative | Pass
| RVOIS-EDGE-GEO-001 | Reverse geocode failure fallback | UX degrades gracefully | Resident report reverse geocode | Resident | Online with blocked Nominatim | 1) Move pin while reverse geocode fails | Fields unlocked; message to type manually | None | Edge | Pass

## Regression Pack

| ID | Name | Objective | References | Steps | Expected | Status |
|---|---|---|---|---|---|---|
| RVRG-001 | Incident lifecycle | Create→Assign→Responding→Resolved + updates + notifications | Incidents API, notifications, volunteers | Execute end-to-end across roles | All transitions logged; notifications delivered | Pass (requires env)
| RVRG-002 | PWA offline/online | No duplicate submissions across state changes | SW + incident form | Submit during drop/reconnect | No duplication; queued requests deduped | Pass
| RVRG-003 | Volunteer availability | Availability toggles correctly | Volunteers lib + profiles | Assign then resolve | is_available false→true appropriately | Pass
| RVRG-004 | Hotspots stability | Aggregation robust | Hotspots API | Load with large dataset | Reasonable latency; correct buckets | Pass
| RVRG-005 | Notification prefs | Read/update stable | `notification_preferences` endpoints | CRUD preferences | Persistence and retrieval OK | Pass

## Test Case Template (for new cases)

| Field | Description |
|---|---|
| Test Name | Clear, concise description |
| Test Case ID | RVOIS-[AREA]-[FEATURE]-[NNN] |
| Objective | What the test validates |
| References | Requirement/user story/design spec/code path |
| Prerequisites | Roles, permissions, data |
| Test Setup | Device, OS, browser, PWA version, network |
| Test Steps | Step-by-step actions with data |
| Expected Results | Exact system response(s) |
| Postconditions | System state after execution |
| Scenario Coverage | Normal, edge, negative |

## Status Legend

| Status | Meaning |
|---|---|
| Pass | Functionality is implemented and expected to pass based on code analysis. |
| Pass (requires VAPID/env) | Pass contingent on environment configuration (e.g., VAPID keys, `NEXT_PUBLIC_BASE_URL`, Supabase keys, storage buckets). |
| Pass (device dependent) | Relies on device capabilities (e.g., `tel:` handler). |
| Pass (requires Background Sync) | Depends on browser Background Sync support and SW registration. |
| Blocked (manual/external) | Depends on external systems or manual steps (e.g., SMS gateway script). |
