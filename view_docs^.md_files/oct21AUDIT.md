# RVOIS Codebase Audit – Oct 21, 2025

## Executive Summary
- This audit consolidates recent patches and a whole-codebase review to assess consistency, maintainability, and production readiness.
- The patches shipped are additive and RLS-safe. Validation is required on staging to confirm end-to-end behavior.
- Primary remaining risks: notification opt-out enforcement, real-time listeners (residents/volunteers/admin), and unimplemented Admin Documents module.

---

## Validated Modules (Pending Your Test Confirmation)
- **Feedback**
  - Files: `src/app/api/feedback/route.ts`, `src/lib/validation.ts`, `src/app/resident/feedback/page.tsx`
  - Status: Accepts rating-only; binds `created_by` from session; schema allows nullable `comment` and `incident_id`.
- **Announcements**
  - Files: `src/app/api/announcements/route.ts`, `src/lib/supabase-server.ts`, `src/app/admin/announcements/page.tsx`
  - Migration: `supabase/migrations/20251021022000_update_announcements_read_policy.sql`
  - Status: Public list should load (anon), admin table loads with session.
- **Volunteer Documents**
  - Files: `src/app/api/volunteer-documents/route.ts`, `src/app/volunteer/documents/page.tsx`, `src/components/layout/volunteer-layout.tsx`
  - Migration: `supabase/migrations/20251021023500_volunteer_documents.sql`
  - Status: Upload/list/delete with 10MB limit; storage bucket `volunteer-docs` created with RLS.
- **Scheduling**
  - Files: `src/app/api/scheduled-activities/route.ts`
  - Status: Duplicate slot detection (same volunteer/date/time) and notifications to volunteer + creator.
- **Contacts Duplicate Check**
  - File: `src/app/admin/contacts/page.tsx`
  - Status: UI duplicate detection (name + number) pre-save.

> Note: Please complete the validation steps outlined in-chat to convert these to “Confirmed Working”.

---

## Inconsistencies Identified
- **Auth propagation to APIs**
  - Some APIs used direct `createClient` without binding session; newer routes use `getServerSupabase()` and forward `Authorization` from request headers. Standardize on `getServerSupabase()`.
- **Notifications handling**
  - Insertions exist in `scheduled-activities`, but opt-out filtering and consistent `read_at` updates vary by module. Listener initialization points differ between admin/resident/volunteer layouts.
- **Validation schemas vs UI forms**
  - Earlier, announcements/time/text vs `type="time"` mismatch caused format inconsistency. This is now aligned. Ensure similar alignment for other date/time fields.
- **Naming conventions**
  - Mixed naming: `scheduledactivities` table uses snake/flat style; API path is `scheduled-activities`. Consider standardizing to snake_case in DB and kebab-case in routes.
- **Public vs Auth data access**
  - Announcements now have public SELECT; other public pages may still rely on authenticated reads unintentionally. Verify each public page’s access expectations.

---

## Incomplete or Partially Implemented Features
- **Admin Documents Module**
  - Not implemented. Requires bucket/table migration, API (list/upload/delete with size/type checks), and UI page.
- **Notifications Opt-Out (All Roles)**
  - Missing enforcement in creation endpoints. Requires knowing exact opt-out column (e.g., `users.notification_opt_out`).
- **Volunteer Verification Alerts**
  - No admin notification on volunteer profile updates. Needs insert on `volunteer-information` save.
- **Real-time Location Tracking**
  - Subscription and publisher paths not audited; ensure live updates are used, not cached.
- **Barangay Case Summary**
  - Need `WHERE barangay_id = ?` filtering and empty state rendering.

---

## API Audit
- **Consistent structure**
  - Route handlers generally return `{ success, data | message, code? }`. Some return only `{ success, data }`. Recommend standard schema: `{ success: boolean, data?: any, message?: string, code?: string, issues?: ZodFlattenedErrors }`.
- **Auth Binding**
  - New standard via `getServerSupabase()` with `Authorization` passthrough. Migrate all APIs to this pattern.
- **Error Handling**
  - Many endpoints correctly rate-limit and return structured errors; ensure all include `code` for known cases (e.g., `SCHEDULE_CONFLICT`, `RATE_LIMITED`, `VALIDATION_ERROR`).
- **Request/Response Formats**
  - Feedback, announcements, scheduled activities, notifications align with JSON and Zod validation. Ensure all POST/PUT validate with Zod schemas.
- **Deprecated/Broken Endpoints**
  - None detected from the reviewed files. Run a grep for unused APIs after standardizing imports.

---

## Functionality Verification (By Module)
- **Admin**
  - Incident monitoring/reporting: Verify existing routes adhere to the standardized pattern. Not fully audited here.
  - Scheduling: Duplicate detection + notifications done.
  - Volunteer information: Upsert works; add admin notification on verified/pending change.
  - Geolocation: Not audited; ensure Talisay-bound constraints and real-time feed.
  - Automatic notifications: Scheduling creates notification rows; global broadcast and opt-out remain TODO.
  - Reports: Not audited; ensure endpoints are present and efficient.
- **Residents**
  - Incident reporting: Ensure `src/lib/validation.ts` matches form fields and API route validates/handles images & geolocation.
  - Direct call: Floating FAB present in resident layout except report page. Validate mobile capability.
  - Geolocation: Not audited; verify capture and pinning.
- **Volunteers**
  - Documents: Implemented (10MB cap). Consider allowlist and preview.
  - Scheduling: Supported with conflicts + notifications.

---

## Technical Debt and Problem Areas
- **Opt-out enforcement**
  - Add a shared helper (e.g., `shouldNotify(user_id)`) that checks preferences before inserts/broadcasts.
- **Real-time listeners**
  - Ensure all panels initialize real-time subscriptions post-login and cleanly unsubscribe on sign out.
- **Date/Time handling**
  - Consider migrating scheduling to `start_time` / `end_time` to support true interval overlap detection.
- **Duplicate checks at DB level**
  - Add unique index for contacts on `(lower(name), number)` to prevent race-condition duplicates.
- **API Response Standardization**
  - Normalize response envelopes and error codes across all routes.
- **Type safety**
  - Ensure `src/types/supabase.ts` matches DB schema and all API returns are typed.

---

## Additional Enhancements
- **Notification Alert**
  - Add server-side emit (websocket) or push gateway (FCM) after notification insert.
  - Add opt-out filtering before any emit/insert.
- **Real-Time Location Tracker (Talisay Only)**
  - Add bounds validation; filter out-of-bound updates server-side.
  - Confirm clients publish at a reasonable interval with throttling.
- **PWA + Direct Call**
  - Validate PWA manifest and service worker; ensure `tel:` links and permissions work on mobile.

---

## Feature-specific Review Notes
- **Incident Reporting**
  - Prioritize UX speed, progressive file upload, geolocation capture, severity level capture, and status visibility.
- **Inter-LGU Coordination**
  - Confirm `handoffs` flows and RLS policy alignment; ensure UI access.
- **Training Evaluation**
  - `TrainingEvaluationCreateSchema` exists; verify UI is wired and records surface in admin.
- **Announcements on Landing**
  - Public read enabled; ensure landing page consumes `/api/announcements`.
- **Hotspots / Incident Density**
  - Add analytics endpoint or SQL view to compute incident clustering by barangay.

---

## Prioritized Recommendations
1. **Notifications**: Implement opt-out filtering and unify real-time listener initialization. Standardize `read_at` PUT.
2. **Admin Documents Module**: Deliver bucket/table migration, API with size/type allowlist, UI with folders and delete.
3. **Scheduling Overlap**: Migrate to start/end times; implement interval overlap logic.
4. **DB Constraints**: Add unique index for contacts to eliminate duplicates.
5. **API Standardization**: Migrate all routes to `getServerSupabase()` and a single response envelope.
6. **Location Real-time**: Audit and enforce Talisay bounds; validate subscriptions.

---

## Environment Synchronization Checklist
- Apply migrations (confirmed done by you):
  - `20251021022000_update_announcements_read_policy.sql`
  - `20251021023500_volunteer_documents.sql`
- Verify `supabase migration status` on all environments.
- Ensure environment variables for Supabase URL/anon keys are consistent.
- Rebuild the app to clear caches and pick up schema changes.
- Smoke test: login, feedback, announcements, scheduling, volunteer docs.

---

## Final Readiness Report (Pending Validation)
- Based on code review, the system is close to production readiness with the following blockers:
  - Notifications opt-out enforcement and consistent real-time listeners.
  - Admin Documents module not yet implemented.
  - Real-time location subscription/emit path not verified.
- Once these are addressed and validation confirms end-to-end behavior in staging, the system should be cleared for QA sign-off.

---

## Appendix – Key Files Reviewed
- Announcements: `src/app/api/announcements/route.ts`, `src/app/admin/announcements/page.tsx`, migration.
- Feedback: `src/app/api/feedback/route.ts`, `src/lib/validation.ts`, `src/app/resident/feedback/page.tsx`.
- Scheduling: `src/app/api/scheduled-activities/route.ts`.
- Notifications: `src/app/api/notifications/route.ts` (for future opt-out work).
- Volunteer Docs: `src/app/api/volunteer-documents/route.ts`, `src/app/volunteer/documents/page.tsx`, `supabase/migrations/20251021023500_volunteer_documents.sql`.
- Admin Contacts: `src/app/admin/contacts/page.tsx`.
- Server Supabase: `src/lib/supabase-server.ts` (Authorization passthrough).
