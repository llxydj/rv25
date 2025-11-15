# QA Report — End-to-End System Verification

Date: 2025-10-23
Repository: RV (root)
Author: QA Automation/Manual Team

Summary
-------
This document is an exhaustive QA checklist and test report template to verify end-to-end functionality of the RV incident reporting and response system. It follows the QA requirements provided and is organized by feature area: Admin, Resident, Additional features, and cross-cutting concerns (notifications, geolocation, PWA, data integrity, etc.). Each section contains test objectives, preconditions, test steps, expected results, evidence to collect, severity levels, and notes/actions.

How to use this file
--------------------
- For manual testers: follow each test case, mark results (PASS/FAIL), attach screenshots and logs, and record any deviations.
- For automation: use the 'Test Steps' to map to end-to-end tests (Cypress, Playwright, or similar) and ensure backend APIs and notifications are stubbed or integrated as required.

Test environment
----------------
- URL: (insert staging URL)
- Test accounts: admin@example.test, resident1@example.test, volunteer1@example.test
- Devices/browsers: Chrome (desktop & mobile), Firefox, Edge, Android WebView, iOS Safari (for PWA)
- Tools: Cypress/Playwright for UI e2e, Postman for API checks, ngrok (if needed), local supabase/dev database or staging DB

Quality gates
-------------
- Build: PASS/FAIL (run project build command and note output)
- Lint/Typecheck: PASS/FAIL (run linter/TS check)
- Tests: PASS/FAIL (unit/integration/e2e where available)

==== ADMIN FEATURES — QA CHECKLIST ====

1. Online Incident Monitoring & Reporting
----------------------------------------
Objective: Ensure admins can view and manage incident reports in real-time.
Preconditions: Admin account exists and sample incident reports are present or created during testing.

Test cases:
- TC-A1: Real-time listing
  - Steps: Login as admin → Open incident monitoring page → Trigger a new incident submission from a resident (use resident test account or API).
  - Expected: New incident appears within 5 seconds in the admin listing.
  - Evidence: Screenshot of admin dashboard before and after, server logs, timestamped API request/response.
  - Severity: High

- TC-A2: Detail view accuracy
  - Steps: Open an incident detail → Confirm fields: time, location, severity, reporter, photos.
  - Expected: All fields populated correctly; photos open in preview modal or lightbox.
  - Evidence: Screenshot of details and photo preview.
  - Severity: High

- TC-A3: Filtering, Sorting, Search
  - Steps: Use filters (status, severity, time range), sort by time/severity, search by reporter or keywords.
  - Expected: Results match filter criteria and sorting order; searches return relevant results.
  - Evidence: Filter parameters and result screenshots.
  - Severity: Medium

2. Activity Monitoring & Scheduling
----------------------------------
Objective: Ensure activity dashboards and schedules function and update in real-time.

Test cases:
- TC-A4: Activity Dashboard Live Update
  - Steps: Create/modify an activity or schedule in another session → Observe dashboard.
  - Expected: Dashboard updates within 5–10 seconds.
  - Evidence: Before/after screenshots and websocket or polling logs.
  - Severity: Medium

- TC-A5: Scheduling Feature
  - Steps: Create a schedule for volunteers/events → Assign volunteers → Save → Confirm calendar entry and notifications.
  - Expected: Schedule appears on calendar; assigned volunteers are listed; notification sent.
  - Evidence: Calendar screenshot, volunteer assignment list, notification record.
  - Severity: High

3. Volunteer Information Management
----------------------------------
Objective: Verify volunteer profiles are complete and linked to incidents.

Test cases:
- TC-A6: CRUD on volunteer profiles
  - Steps: Create, edit, and delete a volunteer profile via admin UI.
  - Expected: Changes persist; validations enforce required fields (name, contact, skills).
  - Evidence: API logs, screenshots, DB row before/after.
  - Severity: High

- TC-A7: Link assignments
  - Steps: Assign volunteer to an incident → View incident's assigned volunteer in detail view.
  - Expected: Volunteer appears in incident detail; contact info accessible.
  - Evidence: Screenshot of incident detail with volunteer info.
  - Severity: High

4. Geolocation Services (Talisay City Map)
-----------------------------------------
Objective: Ensure map plotting is accurate and interactive.

Test cases:
- TC-A8: Incident and volunteer pins
  - Steps: Submit incidents with coordinates and update volunteer locations → Open map.
  - Expected: Pins plotted at correct coordinates; clicking a pin reveals details.
  - Evidence: Map screenshot with coordinates overlay and pin detail screenshot.
  - Severity: High

- TC-A9: Map interactions
  - Steps: Zoom, pan, cluster/uncluster pins, filter map pins by status.
  - Expected: Map remains responsive; clusters expand/collapse; filters affect pins.
  - Evidence: Short screen recording or step screenshots.
  - Severity: Medium

5. Automatic Notifications
--------------------------
Objective: Verify notifications send correctly on relevant triggers.

Test cases:
- TC-A10: New incident notification
  - Steps: Submit incident → Confirm admin and assigned volunteers receive notifications.
  - Expected: Notifications arrive via chosen channels (in-app, email, SMS if enabled) within 30s.
  - Evidence: Notification logs, emails, SMS gateway logs.
  - Severity: High

- TC-A11: Status change and schedule updates
  - Steps: Change incident status or modify schedule → Observe notifications.
  - Expected: Relevant recipients receive notification.
  - Evidence: Notification records.
  - Severity: Medium

6. Timely Report Generation
---------------------------
Objective: Verify export of reports is accurate and performant.

Test cases:
- TC-A12: Export PDF/Excel
  - Steps: Generate reports for a date range (include photos if supported) → Download.
  - Expected: File contains all fields, photos embedded or referenced, no missing rows.
  - Evidence: Downloaded file, checksum, timestamp.
  - Severity: Medium

- TC-A13: Performance under load
  - Steps: Generate report with large dataset (thousands of records) in staging.
  - Expected: Report completes within acceptable time (define SLA e.g., <60s) or queued with progress.
  - Evidence: Time-to-generate metrics, server logs.
  - Severity: Low/Medium

==== RESIDENT FEATURES — QA CHECKLIST ====

1. Online Incident Reporting
----------------------------
Objective: Residents can file incidents with required fields and attachments.

Test cases:
- TC-R1: Successful submission
  - Steps: Login as resident → Open report form → Fill description, pick location, set severity, attach photo(s) → Submit.
  - Expected: Submission accepted with confirmation/receipt; appears in resident's report history and admin listing.
  - Evidence: Screenshot of confirmation, API response, admin listing entry.
  - Severity: High

- TC-R2: Validation handling
  - Steps: Try submitting without required fields or invalid photos (too large/unsupported type).
  - Expected: UI prevents submission and displays clear error messages; no incomplete records created.
  - Evidence: Screenshots of validation messages and backend logs.
  - Severity: High

2. Direct Call Functionality
----------------------------
Objective: Residents can call organization directly from app.

Test cases:
- TC-R3: Call from mobile PWA
  - Steps: On mobile, tap the call button → Confirm call prompt/routing.
  - Expected: Call initiated to correct phone number; call logs show outgoing call.
  - Evidence: Phone call screenshot (or call logs), app UI showing call state.
  - Severity: Medium

3. Geolocation Services (Resident)
---------------------------------
Objective: Resident location capture and map interactions are correct.

Test cases:
- TC-R4: Accurate resident location capture
  - Steps: Use mobile device to submit location or pick on map → Submit incident.
  - Expected: Coordinates captured accurately and match map pin.
  - Evidence: Device GPS reading, incident detail location coordinates.
  - Severity: High

- TC-R5: Map responsiveness
  - Steps: Zoom, pan, select incident pins as resident.
  - Expected: UI responsive; modals/sidebars open with incident info.
  - Evidence: Screenshots or short recording.
  - Severity: Medium

==== ADDITIONAL FEATURES — QA CHECKLIST ====

1. Notification Alerts for Responders
-------------------------------------
- TC-AD1: Broadcast to responders
  - Steps: Submit new incident with high severity → Confirm all assigned/responders receive alerts.
  - Expected: Alerts reach responders; show correct incident summary and link.
  - Evidence: In-app notification list, SMS/email logs.
  - Severity: High

2. Real-Time Location Tracker
-----------------------------
- TC-AD2: Responder location updates
  - Steps: Move a test responder (simulate location changes) → Observe admin map.
  - Expected: Location updates appear real-time and with correct timestamps.
  - Evidence: Map updates, websocket logs, sample coordinates.
  - Severity: High

3. PWA (Mobile App)
-------------------
- TC-AD3: PWA install and offline
  - Steps: Open site on mobile → Install PWA → Test offline behavior: open app, submit incident (if offline mode supported), queue for sync.
  - Expected: App installable; offline submit queued and synced when online; direct call still works via device dialer.
  - Evidence: Installed PWA screenshot, offline mode logs, queued submission record.
  - Severity: Medium

4. Incident Report Features
---------------------------
- TC-AD4: Fast submission & acknowledgment
  - Steps: Submit incident repeatedly under load or with poor network → Observe latency and acknowledgment.
  - Expected: App acknowledges receipt quickly or queues gracefully; retries or informative messages on failure.
  - Evidence: Timing metrics, network logs.
  - Severity: Medium

- TC-AD5: Photo capture
  - Steps: Use mobile camera to capture photo → Attach and submit.
  - Expected: Photo uploads succeed; thumbnails visible; full-size accessible.
  - Evidence: Uploaded photo URL, screenshots.
  - Severity: High

5. Coordination with LGUs & Evaluation Forms
-------------------------------------------
- TC-AD6: Cross-LGU sharing
  - Steps: Share incident or generate mutual response request to another LGU → Confirm access/visibility.
  - Expected: LGU users with permissions can view shared incidents.
  - Evidence: Access logs, screenshots.
  - Severity: Low/Medium

- TC-AD7: Training evaluation form
  - Steps: Complete evaluation form after a training session → Submit results.
  - Expected: Responses recorded; summary/analytics available to admins.
  - Evidence: Stored evaluation records and summary charts.
  - Severity: Low

6. Announcements & Severity
---------------------------
- TC-AD8: Announcement posting
  - Steps: Post announcement → Verify visibility on home dashboard and mobile PWA.
  - Expected: Announcement visible to intended audiences; push/in-app notifications optionally sent.
  - Evidence: Announcement screenshot.
  - Severity: Low

- TC-AD9: Severity capture
  - Steps: Create incidents with varying severities → Filter and report by severity.
  - Expected: Severity field stored and used in filters, sorting, and notifications.
  - Evidence: Samples and filtered results.
  - Severity: High

7. SMS Notifications
--------------------
- TC-AD10: SMS delivery
  - Steps: Trigger SMS notifications (resident/responder) → Validate delivery via SMS gateway logs.
  - Expected: SMS delivered within SLA; handle undeliverable numbers gracefully.
  - Evidence: SMS gateway logs and message receipts.
  - Severity: Low/Medium

8. Statistical Tracking
-----------------------
- TC-AD11: Heatmaps & statistics
  - Steps: Generate statistics and heatmaps for incidents by area/time → Verify correctness.
  - Expected: Heatmaps align with incident coordinates; reports show correct counts.
  - Evidence: Heatmap images and raw counts compared to DB queries.
  - Severity: Medium

==== HOME PAGE / DASHBOARD ====

Test cases:
- TC-H1: Announcements and quick actions
  - Steps: Open home dashboard → Verify announcements, quick report button, pending reports list.
  - Expected: Elements visible and functional; quick report links to reporting form.
  - Evidence: Dashboard screenshot.
  - Severity: Medium

- TC-H2: Feedback/rating mechanism
  - Steps: Submit feedback/rating after incident resolution → Confirm it saves and aggregates.
  - Expected: Feedback stored and shown in admin analytics.
  - Evidence: Feedback entry and aggregated stats.
  - Severity: Low

==== CROSS-CUTTING TESTS & DATA INTEGRITY ====

- TC-X1: End-to-end flow
  - Steps: Resident submits incident → System creates DB record → Admin sees and assigns volunteer → Volunteer receives notification and accepts → Volunteer status updated → Incident marked resolved → Generate final report.
  - Expected: Each step completed with matching data across UI and DB.
  - Evidence: API logs, DB rows, UI screenshots at each stage.
  - Severity: Critical

- TC-X2: Consistency checks
  - Steps: Randomly sample incident records and compare DB entries to UI displays.
  - Expected: No mismatch in fields, timestamps, or attachments.
  - Evidence: Matched records and diffs if any.
  - Severity: Critical

- TC-X3: Mobile vs Desktop behavior
  - Steps: Repeat key flows on both mobile and desktop.
  - Expected: Functional parity where expected; responsive UI adjustments correct.
  - Evidence: Side-by-side screenshots.
  - Severity: Medium

==== EVIDENCE & BUG REPORTING TEMPLATE ====

When a test fails, create a bug report with the following template (copy into your issue tracker):

Title: [Feature] — Short description of failure
Environment: staging URL, device, browser, account
Steps to reproduce:
1. ...
Expected result:
Actual result:
Screenshots/Recordings: (attach)
Logs: (API response, server logs, stack trace)
Severity: (Critical/High/Medium/Low)
Suggested fix or notes:

==== SAMPLE TEST EXECUTION LOG ====

Tester: (name)
Date: 2025-10-23
Test run id: TR-20251023-001

Summary: (short summary of pass/fail counts and key blockers)

Detailed results:
- TC-A1: PASS (observed real-time update within 3s)
- TC-A2: FAIL (photo uploader breaks on large jpeg > 8MB) — see bug #123
- ...

==== CHECKLIST FOR AUTOMATION ====

- Map UI interactions: use headless browser with geolocation mocking.
- Notifications: stub or integrate with test SMS/email gateways.
- PWA offline: use service worker test harness or browser devtools emulation.
- Performance: include a small load test for report generation.

==== NEXT STEPS & RECOMMENDATIONS ====

- Run full test run on staging with representative data and multiple concurrent users.
- Prioritize fixes for Critical/High severity failures.
- Add automated e2e coverage for TC-X1, TC-A1, TC-R1, TC-AD2.
- Implement synthetic monitoring for real-time feeds and notification delivery.


Appendix: Quick commands and helpers
-----------------------------------
- Run lint and types: (project may use pnpm)

  pnpm install; pnpm lint; pnpm build

- Run tests (example):

  pnpm test



If you'd like, I can also:
- open a PR adding this file and link checklist items to issues
- generate a baseline automated Cypress/Playwright test for key flows
- stub notification tests for email/SMS


---
End of QA report
