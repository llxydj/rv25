# Map Marker Color Debug Guide

## 🔍 Complete Code Flow Analysis

### 1. **Data Source (API/Database)**
**File:** `src/lib/incidents.ts` - `getResidentIncidents()`
- Fetches incidents from Supabase `incidents` table
- Returns `status` field directly from database
- **Status values from DB:** `PENDING`, `ASSIGNED`, `RESPONDING`, `RESOLVED`, `CANCELLED`
- **Debug logging added:** Logs status distribution and sample incidents

### 2. **Data Transformation (Dashboard)**
**File:** `src/app/resident/dashboard/page.tsx` - Line 43-68
- Receives incidents from `getResidentIncidents()`
- Maps to `mapMarkers` array
- **Normalizes status:** Trims whitespace, converts to uppercase
- **Debug logging added:** Logs each incident's status details

### 3. **Color Mapping Function**
**File:** `src/components/ui/map-internal.tsx` - Line 136-166
- `getIncidentColor(status: string)` function
- **Color mapping:**
  - `PENDING` → `#ef4444` (red)
  - `ASSIGNED` → `#f59e0b` (amber)
  - `RESPONDING` → `#3b82f6` (blue)
  - `RESOLVED` → `#10b981` (green)
  - `CANCELLED` → `#6b7280` (gray) ⚠️
  - `Unknown/Missing` → `#ef4444` (red)
- **Normalization:** Trims whitespace, uppercase, handles "CANCELED" spelling

### 4. **Icon Creation Function**
**File:** `src/components/ui/map-internal.tsx` - Line 108-133
- `createCustomIcon(color: string, type: 'incident' | 'volunteer' | 'user')`
- Creates HTML div with inline styles
- **Uses:** `background-color: ${validColor} !important`
- **Size:** 30px for incidents
- **Border:** 3px solid white
- **Shadow:** Enhanced for visibility

### 5. **Marker Rendering**
**File:** `src/components/ui/map-internal.tsx` - Line 633-680
- Maps through markers array
- Normalizes status again (double-check)
- Calls `getIncidentColor()` → `createCustomIcon()`
- **Debug logging added:** Logs original status, normalized status, color, and if it will be gray

### 6. **CSS Styling**
**File:** `src/app/globals.css` - Line 178-190
- `.custom-marker` class with drop-shadow filter
- `.custom-marker div` with transition
- **Added:** `background-color: inherit !important` to prevent overrides

## 🐛 Common Issues & Solutions

### Issue 1: Markers Appear Gray
**Possible Causes:**
1. ✅ Status is `CANCELLED` → Intentional gray color
2. ✅ Status has whitespace → Now trimmed
3. ✅ Status is undefined/null → Now defaults to red
4. ✅ Status case mismatch → Now case-insensitive
5. ✅ Unknown status value → Now defaults to red with warning

### Issue 2: Colors Not Applied
**Possible Causes:**
1. ✅ CSS override → Added `!important` flags
2. ✅ Invalid color format → Added color validation
3. ✅ Missing display property → Added `display: block`

## 🔧 Debug Checklist

### Step 1: Check Browser Console
Look for these log messages:
- `[getResidentIncidents] Status distribution:` - Shows all statuses from DB
- `[Resident Dashboard] Fetched incidents:` - Shows what dashboard received
- `[Resident Dashboard] Incident:` - Shows each incident's status details
- `[Map Internal] Marker:` - Shows status processing and color assignment
- `[createCustomIcon] Creating incident marker with color:` - Shows final color used
- `[Map Internal] Marker with CANCELLED status will be gray` - Confirms CANCELLED status

### Step 2: Check Popup Content
Click on a marker - the popup should show:
- Status badge with color indicator
- Development mode: Color hex code and normalized status

### Step 3: Verify Database Status Values
Run this query in Supabase:
```sql
SELECT status, COUNT(*) 
FROM incidents 
WHERE reporter_id = '<your-user-id>'
GROUP BY status;
```

Expected values: `PENDING`, `ASSIGNED`, `RESPONDING`, `RESOLVED`, `CANCELLED`

## 📊 Status Color Reference

| Status | Color | Hex Code | Visual |
|--------|-------|----------|--------|
| PENDING | Red | `#ef4444` | 🔴 |
| ASSIGNED | Amber | `#f59e0b` | 🟠 |
| RESPONDING | Blue | `#3b82f6` | 🔵 |
| RESOLVED | Green | `#10b981` | 🟢 |
| CANCELLED | Gray | `#6b7280` | ⚪ |
| Unknown | Red | `#ef4444` | 🔴 |

## 🎯 Quick Fixes Applied

1. ✅ Status normalization (trim + uppercase) at multiple points
2. ✅ Color validation in `createCustomIcon`
3. ✅ `!important` flags to prevent CSS overrides
4. ✅ Comprehensive debug logging throughout the flow
5. ✅ Default to red instead of gray for unknown statuses
6. ✅ Visual color indicator in popup
7. ✅ CSS rule to preserve background color

## 🚨 If Still Gray

If markers are still gray after these fixes:

1. **Check console logs** - Look for `willBeGray: true` messages
2. **Check if status is CANCELLED** - This is intentional gray
3. **Verify database values** - Run SQL query above
4. **Check browser DevTools** - Inspect marker element, check computed styles
5. **Clear browser cache** - Hard refresh (Ctrl+Shift+R)

## 📝 Files Modified

1. `src/lib/incidents.ts` - Added debug logging
2. `src/app/resident/dashboard/page.tsx` - Added status normalization and logging
3. `src/components/ui/map-internal.tsx` - Enhanced color function, added logging
4. `src/app/globals.css` - Added CSS to preserve background color

