# RVOIS FULL CODEBASE AUDIT CHECKLIST

Comprehensive QA and developer checklist to verify every file, function, module, and workflow end-to-end.

Date: 2025-10-23
Author: QA Team

Overview
--------
This document expands the checklist provided and adds practical execution steps, Windows PowerShell commands, evidence collection templates, and next steps for issue filing. Use it as the single-source audit plan for a full codebase review.

How to use this checklist
-------------------------
- Work top-to-bottom. For each item, perform the checks, mark the checkbox, and collect evidence (screenshots, logs, DB queries).
- When you find an issue, open an issue in the tracker using the Bug Report template in the "Issue Template" section.
- Use provided PowerShell commands and sample API calls to validate endpoints and scripts.

Contents
--------
1. Directory / File Structure Review
2. Backend / Server-side Code
3. Database
4. Frontend / UI
5. Functional Features Check (module-by-module)
6. Security Audit
7. Performance & Stress Test
8. Documentation / Maintenance
9. QA & Verification Notes
10. Evidence & Issue Templates

---

## 1️⃣ DIRECTORY / FILE STRUCTURE REVIEW

Actions & commands
- List root contents:

```powershell
Get-ChildItem -Force | Sort-Object Name
```

- Search for large or stale files (over 10MB):

```powershell
Get-ChildItem -Recurse | Where-Object { -not $_.PSIsContainer -and $_.Length -gt 10MB } | Sort-Object Length -Descending
```

Checklist
- [ ] Verify all expected directories exist (backend, frontend, database, scripts, assets, config)
- [ ] Check for unnecessary or unused files
- [ ] Ensure naming conventions for directories and files are consistent
- [ ] Validate version control structure (.gitignore, branches, tags)
- [ ] Confirm all config files (.env, settings.json, config.yaml) have correct parameters

Notes
- If repo uses monorepo structure, inspect `pnpm-workspace.yaml`, `package.json` workspaces.
- For any `.env` files found, ensure they are not committed with secrets. If secrets are present, rotate them.

---

## 2️⃣ BACKEND / SERVER-SIDE CODE

Approach
- Walk directory tree for `backend/`, `server/`, or `src/api` and review each file. For each file, run static analysis, unit tests, and basic runtime checks.

PowerShell helper: run linter and tests (adjust commands to project):

```powershell
pnpm install
pnpm lint
pnpm test --silent
pnpm build
```

Checklist per file
- [ ] Review every function for correct inputs/outputs
- [ ] Validate error handling and return codes
- [ ] Confirm data validation and sanitization
- [ ] Check for security risks (XSS, SQL injection, CSRF)
- [ ] Ensure API routing and reachability
- [ ] Confirm endpoint responses match documented contract (status codes, payload shape)
- [ ] Review database queries for accuracy and efficiency
- [ ] Confirm background jobs and scheduled tasks run properly
- [ ] Ensure logging includes meaningful context and avoids sensitive data

Practical steps
- Use `grep`-style search to find API route definitions and list them. In Windows PowerShell:

```powershell
Select-String -Path . -Pattern "\.get\(|\.post\(|app\.use\(|router\." -List | Select-Object Path, LineNumber, Line
```

- Smoke-test endpoints with `curl` or `Invoke-RestMethod`:

```powershell
# example
Invoke-RestMethod -Uri http://localhost:3000/api/incidents -Method Get
```

Security focus
- Ensure prepared statements or parameterized queries for DB access.
- Check for use of unsanitized template rendering or user HTML injection.

---

## 3️⃣ DATABASE

Checklist
- [ ] Verify table structure and naming
- [ ] Check foreign keys, relationships, constraints
- [ ] Validate indexes for performance-critical queries
- [ ] Test CRUD operations for each table
- [ ] Ensure migrations and seed scripts run cleanly
- [ ] Confirm data consistency between related tables
- [ ] Test backups and restores
- [ ] Audit triggers, stored procedures, and views

Practical steps
- If using supabase/Postgres, connect and list schema:

```powershell
psql postgres://username:password@host:5432/dbname -c "\dt" 
# or use psql via PG cli
```

- Run sample CRUD tests (example for incidents):

```powershell
# Insert
psql -c "INSERT INTO incidents (description, location, severity) VALUES ('test','POINT(123 456)', 'low');"
# Read
psql -c "SELECT * FROM incidents ORDER BY created_at DESC LIMIT 5;"
```

- Check migration status and run:

```powershell
# example for knex or prisma
pnpm prisma migrate status
pnpm prisma migrate deploy
```

---

## 4️⃣ FRONTEND / UI

Approach
- Review UI components in `components/` and `app/`.
- Use automated e2e harness (Cypress/Playwright) plus manual checks on device browsers.

Checklist
- [ ] Verify UI elements match design specifications
- [ ] Check every form input for validation and error messaging
- [ ] Test all buttons and interactive elements
- [ ] Confirm API integration and data flow
- [ ] Test responsive layout across resolutions
- [ ] Ensure PWA installability and offline capabilities
- [ ] Validate map geolocation, pin placement, and updates
- [ ] Test photo upload and attachment flows
- [ ] Confirm direct call functionality works as expected

PowerShell: run dev server and open in default browser

```powershell
pnpm dev
Start-Process "http://localhost:3000"
```

Testing tips
- Use browser devtools to emulate mobile and geolocation coordinates.
- For file upload testing, prepare a set of images with varied sizes/formats.

---

## 5️⃣ FUNCTIONAL FEATURES CHECK (MODULE BY MODULE)

Admin
- [ ] Online incident monitoring & reporting
- [ ] Activity monitoring & scheduling
- [ ] Volunteer management
- [ ] Notifications and alerts
- [ ] Reports generation (PDF, Excel)
- [ ] Map geolocation display

Resident
- [ ] Online incident submission
- [ ] Direct call feature
- [ ] Geolocation and incident pinning
- [ ] Severity capture
- [ ] Image attachments
- [ ] SMS/email notifications

Shared / Additional
- [ ] Real-time location tracking
- [ ] Evaluation forms
- [ ] Announcements & landing page updates
- [ ] Feedback and rating mechanism
- [ ] Analytics (incident hotspots)
- [ ] Cross-LGU coordination

Execution
- For each item, execute the end-to-end path: UI -> API -> DB -> Notification -> UI confirmation.
- Log timestamps for each step and compare.

---

## 6️⃣ SECURITY AUDIT

Checklist
- [ ] Verify authentication and authorization flows
- [ ] Validate role-based access control enforcement
- [ ] Ensure sensitive data encryption in transit and at rest
- [ ] Check session management and token handling
- [ ] Inspect input sanitization and escape user content
- [ ] Confirm logging does not leak sensitive info

Tools & commands
- Use security scanners (Snyk, npm audit):

```powershell
pnpm audit
```

- Run a simple static security scan or run dependency vulnerability checks.

---

## 7️⃣ PERFORMANCE & STRESS TEST

Checklist
- [ ] Measure response times for critical endpoints
- [ ] Load test DB queries and API endpoints
- [ ] Stress test real-time channels (websockets)
- [ ] Monitor memory and CPU usage under load

Tools
- Use k6, Apache Bench, or Artillery for load testing. Example k6 command:

```powershell
# Save script to loadtest.js then run
k6 run loadtest.js
```

---

## 8️⃣ DOCUMENTATION / MAINTENANCE

Checklist
- [ ] README up-to-date with setup, build, and run instructions
- [ ] API documentation accurate (OpenAPI/Swagger where applicable)
- [ ] Comments explain complex logic
- [ ] Changelog present and accurate
- [ ] Deployment scripts functional (CI/CD)

---

## 9️⃣ QA & VERIFICATION NOTES

- [ ] Audit every single file for dead code, unused imports, or TODO comments
- [ ] Track bugs and fixes in a log or issue tracker
- [ ] Collect screenshots, logs, DB snapshots for reproducible errors
- [ ] Verify end-to-end flow from DB → backend → frontend → notification → report

Practical tip: use this PowerShell to list all .js/.ts/.tsx/.jsx files and count lines for manual review planning:

```powershell
Get-ChildItem -Recurse -Include *.js,*.ts,*.tsx,*.jsx | ForEach-Object {
  $lines = (Get-Content $_.FullName -ErrorAction SilentlyContinue).Count
  [PSCustomObject]@{File=$_.FullName; Lines=$lines}
} | Sort-Object Lines -Descending | Out-File file_counts.csv
```

---

## 10️⃣ EVIDENCE & ISSUE TEMPLATES

Bug report template (paste into issue tracker):

Title: [Component] — Short description
Environment: staging URL, device, browser, account
Steps to reproduce:
1. 
2. 
3. 
Expected result:
Actual result:
Evidence: attach screenshots, logs, timestamps
Severity: Critical/High/Medium/Low
Suggested fix:

Sample API smoke test (PowerShell):

```powershell
# GET incidents list
Invoke-RestMethod -Uri http://localhost:3000/api/incidents -Method Get | ConvertTo-Json -Depth 10

# POST new incident
$body = @{ description = "audit test"; location = "POINT(123 456)"; severity = "low" } | ConvertTo-Json
Invoke-RestMethod -Uri http://localhost:3000/api/incidents -Method Post -Body $body -ContentType 'application/json'
```

Checklist CSV for import (format shown below):
- Create a CSV from the checklist headings to import into test management tools. Example headers: area, item, steps, expected, severity

Final notes
-----------
- This audit is intentionally exhaustive: unblock by creating issues for Critical/High items first.
- If you want, I can generate:
  - a CSV or JSON export of the checklist
  - a lightweight Playwright/Cypress test scaffold for core flows
  - a PR to add this file and link top issue backlog items


---
End of RVOIS FULL CODEBASE AUDIT CHECKLIST
