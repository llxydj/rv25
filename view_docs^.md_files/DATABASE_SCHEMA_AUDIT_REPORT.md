# Database Schema Audit Report
**Date:** 2025-01-28  
**Purpose:** Identify unused tables that can be safely dropped

---

## ✅ **ACTIVELY USED TABLES** (Keep These)

### Core System Tables
1. **`users`** - ✅ **CRITICAL** - Core user authentication and profiles
2. **`incidents`** - ✅ **CRITICAL** - Main incident management table
3. **`barangays`** - ✅ **CRITICAL** - Location/geographic data
4. **`volunteer_profiles`** - ✅ **CRITICAL** - Volunteer management

### Notification & Communication
5. **`notifications`** - ✅ Used in notification system
6. **`notification_preferences`** - ✅ Used for user notification settings
7. **`push_subscriptions`** - ✅ Used for push notifications
8. **`sms_logs`** - ✅ Used for SMS tracking
9. **`sms_deliveries`** - ✅ Used for SMS delivery tracking
10. **`sms_templates`** - ✅ Used for SMS templates
11. **`sms_config`** - ✅ Used for SMS configuration
12. **`sms_rate_limits`** - ✅ Used for SMS rate limiting

### Call System
13. **`call_logs`** - ✅ Used in call service, API routes, components
14. **`call_preferences`** - ✅ Used in call service, API routes
15. **`emergency_contacts`** - ✅ Used in call service, admin management page
16. **`lgu_contacts`** - ✅ Used in admin LGU contacts page, volunteer directory

### Incident Management
17. **`incident_feedback`** - ✅ **ACTIVE** - Used in feedback API, components
18. **`incident_updates`** - ✅ Used for incident status updates
19. **`incident_reference_ids`** - ✅ Used for incident reference ID generation
20. **`incident_views`** - ✅ Used for tracking incident views

### Reports & Documents
21. **`reports`** - ✅ Used in admin reports page, volunteer reports page, API routes
22. **`admin_documents`** - ✅ Used in admin documents page, API route
23. **`volunteer_documents`** - ✅ Used in volunteer document management

### Volunteer Management
24. **`volunteer_information`** - ✅ Used in volunteer dashboard, API route
25. **`volunteer_activity_logs`** - ✅ Used for volunteer activity tracking
26. **`volunteer_locations`** - ✅ Used for location tracking
27. **`volunteeractivities`** - ✅ Used in volunteer activities API, analytics

### Scheduling & Activities
28. **`schedules`** - ✅ Used in schedule management, API routes
29. **`scheduledactivities`** - ✅ Used in volunteer dashboard, API routes

### Training System
30. **`trainings`** - ✅ Used in training system, API routes
31. **`training_enrollments`** - ✅ Used in training enrollment API
32. **`training_evaluations`** - ✅ Used in training evaluations API
33. **`training_evaluations_admin`** - ✅ Used in admin training evaluations

### Location & Preferences
34. **`location_preferences`** - ✅ Used in location tracking service, API routes

### System & Archive
35. **`system_logs`** - ✅ Used for system logging
36. **`auto_archive_schedule`** - ✅ Used in auto-archive API for reports

### Announcements
37. **`announcements`** - ✅ Used in announcements page, API route

---

## ❌ **UNUSED TABLES** (Can Be Safely Dropped)

### 1. **`feedback`** - ❌ **LEGACY TABLE - SAFE TO DROP**
   - **Status:** Replaced by `incident_feedback`
   - **Evidence:**
     - Old table with `bigint` incident_id (doesn't match UUID incidents)
     - Only referenced in `src/app/admin/users/[id]/page.tsx` (lines 142, 177) for stats
     - All active code uses `incident_feedback` table
     - Migration `20251028000001_fix_feedback_table.sql` created `incident_feedback` to replace it
   - **Action:** 
     - Update `src/app/admin/users/[id]/page.tsx` to use `incident_feedback` instead
     - Then drop `feedback` table

### 2. **`geofence_boundaries`** - ❌ **UNUSED - SAFE TO DROP**
   - **Status:** No code references found
   - **Evidence:** No API routes, no components, no services use this table
   - **Action:** Safe to drop (unless planned for future use)

### 3. **`incident_handoffs`** - ❌ **UNUSED - SAFE TO DROP**
   - **Status:** No code references found
   - **Evidence:** No API routes, no components use this table
   - **Action:** Safe to drop (unless planned for future use)

### 4. **`spatial_ref_sys`** - ❌ **POSTGIS SYSTEM TABLE - DO NOT DROP**
   - **Status:** PostGIS extension system table
   - **Evidence:** This is a PostGIS system table, not a custom table
   - **Action:** **DO NOT DROP** - Required by PostGIS extension

### 5. **`volunteer_real_time_status`** - ❌ **UNUSED - SAFE TO DROP**
   - **Status:** No code references found
   - **Evidence:** No API routes, no components use this table
   - **Note:** Functionality might be handled by `volunteer_profiles.is_available`
   - **Action:** Safe to drop (unless planned for future use)

---

## 🔧 **REQUIRED FIXES BEFORE DROPPING TABLES**

### Fix #1: Update `feedback` table references
**File:** `src/app/admin/users/[id]/page.tsx`

**Current Code (Lines 142, 177):**
```typescript
.from("feedback")
```

**Should be:**
```typescript
.from("incident_feedback")
```

**Also update the query logic:**
- Change `incident_id` from `bigint` to `uuid` matching
- Ensure proper join with `incidents` table

---

## 📋 **DROP RECOMMENDATIONS**

### **High Priority (After Fix)**
1. **`feedback`** - Legacy table, fully replaced by `incident_feedback`

### **Low Priority (No Fixes Needed)**
2. **`geofence_boundaries`** - No references, safe to drop
3. **`incident_handoffs`** - No references, safe to drop
4. **`volunteer_real_time_status`** - No references, safe to drop

### **DO NOT DROP**
- **`spatial_ref_sys`** - PostGIS system table (required)

---

## 📊 **SUMMARY**

- **Total Tables Audited:** 37
- **Actively Used:** 33 tables
- **Unused (Safe to Drop):** 4 tables
- **System Tables (Keep):** 1 table (`spatial_ref_sys`)

### **Storage Impact**
Dropping unused tables will:
- Reduce database size
- Simplify schema
- Improve maintainability
- Reduce confusion for developers

### **Risk Assessment**
- **Low Risk:** Dropping `geofence_boundaries`, `incident_handoffs`, `volunteer_real_time_status`
- **Medium Risk:** Dropping `feedback` (requires code fix first)

---

## ✅ **RECOMMENDED ACTION PLAN**

1. **Immediate:** Fix `feedback` table references in `src/app/admin/users/[id]/page.tsx`
2. **After Fix:** Drop `feedback` table
3. **Optional:** Drop `geofence_boundaries`, `incident_handoffs`, `volunteer_real_time_status` if not planned for future use

---

## 🔍 **VERIFICATION CHECKLIST**

Before dropping any table:
- [ ] Backup database
- [ ] Fix code references (for `feedback` table)
- [ ] Test application functionality
- [ ] Verify no foreign key constraints reference these tables
- [ ] Check for any database triggers using these tables
- [ ] Confirm no scheduled jobs/queries use these tables

---

**Report Generated:** 2025-01-28  