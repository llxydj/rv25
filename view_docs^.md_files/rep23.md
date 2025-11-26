# RVOIS Audit Findings — rep23

Date: 2025-10-23
Generated from: `QA_oct23.md` and `RVOIS_FULL_CODEBASE_AUDIT.md`

Summary
-------
This document provides a concise, tabular summary of audit findings and recommended actions for the RVOIS codebase. Each finding has an ID, area, short description, severity, evidence placeholder, recommended fix, suggested owner, and current status.

Findings Table
--------------
| ID | Area | Short description | Severity | Evidence | Recommended fix | Owner | Status |
|----|------|-------------------|----------|----------|-----------------|-------|--------|
| F-001 | Admin - Incident Reporting | Real-time listing latency observed under test (new incident appears after ~12s) | High | Screenshot: /evidence/F-001.png; API logs | Investigate websocket/polling implementation; optimize server push and reduce payloads | Backend Team | Open |
| F-002 | Admin - Photo Upload | Photo uploader fails on large JPEGs (>8MB) with 413/timeout | High | Upload logs: /evidence/F-002.log; Screenshot | Increase upload limits, implement client-side resizing, add clear UI error for large files | Frontend Team | Open |
| F-003 | Volunteer Management | Missing validation on volunteer phone number format | Medium | Unit test missing; sample input | Add validation and unit tests; enforce format on backend & frontend | Backend/Frontend | Open |
| F-004 | Map / Geolocation | Some incident pins plotted offset from reported coordinates (edge cases) | High | Map screenshot: /evidence/F-004.png; coordinate mismatch log | Verify coordinate storage and conversion (lat/lng vs lon/lat); add integration tests for geolocation | Geo/Backend Team | Open |
| F-005 | Notifications | SMS fallback not configured; SMS attempts fail silently in staging | Medium | SMS gateway logs: /evidence/F-005.log | Implement error handling and alerting for SMS failures; add retry policy and fallback to email/in-app | Notifications Team | Open |
| F-006 | Reports | PDF export missing reporter contact info when images are included | Low | Sample PDF: /evidence/F-006.pdf | Ensure export templates include all fields; add export unit/integration tests | Backend Team | Open |
| F-007 | PWA Offline | Offline submission not queued properly; submissions lost when offline | High | Offline logs: /evidence/F-007.log | Implement service worker background sync / local queue; ensure retries on reconnect | Frontend Team | Open |
| F-008 | Security | Several endpoints allow overly broad user input without sanitization | Critical | Security scan summary: /evidence/F-008.txt | Add input sanitization, parameterized queries, and review authentication/authorization on endpoints | Security Team | Open |
| F-009 | Database | Missing index on incidents.created_at causing slow report queries | Medium | Query plan: /evidence/F-009.txt | Add index on `incidents(created_at)` and other high-usage columns; re-run explain plans | DB Team | Open |
| F-010 | CI / Docs | README lacks staging setup and test account details | Low | README diff | Update README with staging URL, test account credentials (non-sensitive), and run instructions | DevOps / Docs | Open |

Notes on evidence
- Evidence files listed above are placeholders; capture screenshots, logs, DB query outputs, and attach to each issue when filing.

Execution & Prioritization
--------------------------
- Critical/High items: F-008, F-001, F-002, F-004, F-007 — fix these first.
- Medium items: F-003, F-005, F-009 — schedule in sprints after urgent fixes.
- Low items: F-006, F-010 — minor improvements.

Suggested workflow
- Create issues for each finding using the Bug Report template in `RVOIS_FULL_CODEBASE_AUDIT.md`.
- Assign owners and set priority/labels.
- Track fixes and attach evidence of resolution.

Appendix: How to file an issue (example)
----------------------------------------
Title: [F-002] Photo uploader fails for large JPEGs
Labels: bug, upload, frontend, high
Description:
- Steps to reproduce:
  1. Login as resident
  2. Open incident report form
  3. Attach a JPEG ~9MB and submit
- Expected: Photo uploaded or user-friendly error message
- Actual: Upload fails with 413 or timeout
- Evidence: /evidence/F-002.log, screenshot
- Suggested fix: Client-side resizing + increase server upload limit

If you'd like, I can:
- convert this table into a CSV for import to your issue tracker,
- automatically open issues in GitHub for each finding (I will need repo access), or
- scaffold minimal PRs for low-risk fixes (docs, README, small validation fixes).


End of rep23
