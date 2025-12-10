# 📋 Incident Assessment Flow - Current State & Gap Analysis

**Date:** 2025-01-31

---

## 🔍 **CURRENT FLOW EXPLANATION**

### **1. RESIDENT REPORTS INCIDENT**

**What Residents Fill:**
- ✅ **`incident_type`** (Text field):
  - Examples: "FIRE", "FLOOD", "MEDICAL EMERGENCY", "TRAFFIC ACCIDENT", etc.
  - This is a **free text field** - residents type what happened
  
- ✅ **`priority`** (Number 1-5):
  - 1 = Critical (Emergency)
  - 2 = High
  - 3 = Medium (Default for non-emergency)
  - 4 = Low
  - 5 = Informational

- ✅ **`description`** (Text)
- ✅ **`location`** (Lat/Lng)
- ✅ **`barangay`** (Text)
- ✅ **Photos/Voice** (Optional)

**What Residents DON'T Fill:**
- ❌ `incident_category` (Trauma classification)
- ❌ `trauma_subcategory` (Trauma classification)
- ❌ `severity_level` (Trauma classification)
- ❌ `severity` (Old enum - MINOR, MODERATE, SEVERE, CRITICAL)

**Result:** Incident is created with basic info and assigned to a volunteer.

---

### **2. INCIDENT ASSIGNED TO VOLUNTEER**

**What Happens:**
- Admin or system assigns incident to a volunteer
- Volunteer sees incident in their dashboard
- Status: `ASSIGNED`

---

### **3. VOLUNTEER ASSESSES INCIDENT** ⚠️ **CURRENT GAP HERE**

**What Volunteers CAN Currently Update:**

**A. Status** (via `IncidentStatusDropdown`):
- `ASSIGNED` → `RESPONDING` (On The Way)
- `RESPONDING` → `ARRIVED` (At Scene)
- `ARRIVED` → `RESOLVED` (Completed)

**B. Severity** (via `IncidentSeverityUpdater` - **OLD SYSTEM**):
- Only when status = `ARRIVED`
- Updates `severity` enum: `MINOR`, `MODERATE`, `SEVERE`, `CRITICAL`
- This is the **OLD severity system**

**What Volunteers CANNOT Currently Update:**
- ❌ `incident_category` (New trauma classification)
- ❌ `trauma_subcategory` (New trauma classification)
- ❌ `severity_level` (New trauma classification - CRITICAL, HIGH, MODERATE, LOW, INFORMATIONAL)

**The Problem:**
- Trauma classification is **ONLY** available when volunteers **CREATE** their own incidents (via `/volunteer/report`)
- But when volunteers **ASSESS** incidents assigned to them (from residents), they **CANNOT** add trauma classification!

---

### **4. VOLUNTEER CREATES THEIR OWN INCIDENT**

**What Volunteers Fill (via `/volunteer/report`):**
- ✅ `incident_type` (Dropdown)
- ✅ `incident_category` (Required - NEW)
- ✅ `trauma_subcategory` (Conditional - NEW, only if MEDICAL_TRAUMA)
- ✅ `severity_level` (Required - NEW)
- ✅ `description`, `location`, etc.

**This works fine** - volunteers can use trauma classification when creating incidents.

---

## ⚠️ **THE GAP**

**Problem:** When a **resident reports** an incident and it gets **assigned to a volunteer**, the volunteer can assess it but **cannot add trauma classification**.

**Why This Matters:**
- Residents report with basic info (`incident_type`, `priority`)
- Volunteers arrive at scene and can see the actual situation
- Volunteers should be able to **classify** the incident properly:
  - Is it `MEDICAL_TRAUMA` or `NON_MEDICAL_SAFETY`?
  - If medical trauma, what type? (`FALL_RELATED`, `HEAD_INJURY`, etc.)
  - What's the actual `severity_level`? (CRITICAL, HIGH, MODERATE, etc.)

**Current State:**
- Volunteers can only update **old** `severity` enum (MINOR, MODERATE, SEVERE, CRITICAL)
- Volunteers **cannot** add trauma classification to assigned incidents

---

## ✅ **SOLUTION IMPLEMENTED**

**Trauma Classification Assessment Component** has been added for volunteers when viewing assigned incidents:

1. **Component Created:** `src/components/incident-trauma-classification-updater.tsx`
   - Shows trauma classification form
   - Allows volunteer to select:
     - `incident_category` (Required)
     - `trauma_subcategory` (If MEDICAL_TRAUMA)
     - `severity_level` (Required)
   - Updates incident with classification via API

2. **Integration Complete:**
   - ✅ Added to `src/app/volunteer/incident/[id]/page.tsx`
   - ✅ Shows when volunteer status = `ARRIVED`
   - ✅ Similar to `IncidentSeverityUpdater` but for trauma classification
   - ✅ Both old and new severity systems available

3. **API Support:**
   - ✅ PUT endpoint already supports updating `incident_category`, `trauma_subcategory`, `severity_level`
   - ✅ Validation and mapping to legacy `severity` enum included

---

## 📊 **FIELD RELATIONSHIPS**

### **Old System (Still Working):**
- `incident_type` (Text) - What happened (e.g., "FIRE", "FLOOD")
- `priority` (1-5) - Urgency level
- `severity` (Enum) - MINOR, MODERATE, SEVERE, CRITICAL

### **New System (Trauma Classification):**
- `incident_category` (Text) - MEDICAL_TRAUMA, MEDICAL_NON_TRAUMA, NON_MEDICAL_SAFETY, etc.
- `trauma_subcategory` (Text) - FALL_RELATED, HEAD_INJURY, etc. (only if MEDICAL_TRAUMA)
- `severity_level` (Text) - CRITICAL, HIGH, MODERATE, LOW, INFORMATIONAL

### **How They Work Together:**
- `incident_type` = What happened (e.g., "MEDICAL EMERGENCY")
- `incident_category` = Classification (e.g., "MEDICAL_TRAUMA")
- `trauma_subcategory` = Specific type (e.g., "HEAD_INJURY")
- `severity_level` = Enhanced severity assessment (e.g., "CRITICAL")
- `priority` = Legacy urgency (1-5)
- `severity` = Legacy severity enum (MINOR, MODERATE, SEVERE, CRITICAL)

**Both systems can coexist** - the new system is more detailed and structured.

---

## ✅ **RECOMMENDED FIX**

Create `IncidentTraumaClassificationUpdater` component that:
1. Shows when volunteer status = `ARRIVED`
2. Allows volunteer to add/update trauma classification
3. Updates `incident_category`, `trauma_subcategory`, `severity_level`
4. Integrates with existing `IncidentSeverityUpdater`

This will allow volunteers to properly classify incidents they assess from residents.

