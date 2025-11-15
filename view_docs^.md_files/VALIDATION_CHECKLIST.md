# ✅ Volunteer Profile Feature - Final Validation Checklist

## 🎯 Pre-Production Sign-Off Requirements

Complete all sections before marking as production-ready.

---

## 1️⃣ Database & Schema Validation

### A. Migration Safety Check
- [ ] **No column conflicts** - Reviewed `users` table, all new columns use `if not exists`
- [ ] **No table conflicts** - `volunteer_activity_logs` table name doesn't conflict
- [ ] **Foreign keys valid** - All FK references point to existing tables
- [ ] **Indexes created** - Performance indexes on `gender` and `profile_photo_url`

### B. Apply Migrations
```bash
cd "c:/Users/ACER ES1 524/Documents/rv"
npx supabase db push
```

**Verify:**
- [ ] Migrations applied without errors
- [ ] Check output for "migrations applied successfully"
- [ ] No rollback messages

### C. Verify Database Structure
```bash
# Check users table structure
npx supabase db dump --schema public | grep -A 30 "CREATE TABLE public.users"
```

**Confirm columns exist:**
- [ ] `gender text`
- [ ] `emergency_contact_name text`
- [ ] `emergency_contact_phone text`
- [ ] `emergency_contact_relationship text`
- [ ] `profile_photo_url text`

**Confirm new table exists:**
- [ ] `volunteer_activity_logs` table created
- [ ] Table has 8 columns (id, volunteer_id, activity_type, title, description, metadata, created_by, created_at)
- [ ] Foreign key constraints active

### D. Storage Bucket Verification
**Check in Supabase Dashboard:**
- [ ] Navigate to Storage section
- [ ] `volunteer-profile-photos` bucket exists
- [ ] Bucket is marked as "Public"
- [ ] RLS policies show 4 policies (insert, select, update, delete)

**Test bucket access:**
- [ ] Can view bucket in dashboard
- [ ] No error messages

---

## 2️⃣ Role Access & Permissions Testing

### A. Admin → Volunteer Visibility

**Test as Admin:**
```
Login as admin → Navigate to volunteer management
```

- [ ] Can view all volunteer profiles
- [ ] Can see volunteer profile photos
- [ ] Can view volunteer activity logs
- [ ] Can update volunteer status
- [ ] Can assign volunteers to incidents

**Test API Access (Admin):**
- [ ] `GET /api/admin/volunteers` - Returns all volunteers
- [ ] Can access any volunteer's activity logs
- [ ] Can upload photos for any volunteer (if permitted)

### B. Volunteer → Self Access

**Test as Volunteer:**
```
Login as volunteer → Navigate to /volunteer/profile
```

- [ ] Can view own profile
- [ ] Can edit own information
- [ ] Can upload own photo
- [ ] Can view own activity logs
- [ ] Can upload own documents
- [ ] Cannot access other volunteers' data

**Test API Access (Volunteer):**
- [ ] `GET /api/volunteer-activity-logs` - Returns only own logs
- [ ] `POST /api/volunteer-profile-photo` - Can upload own photo
- [ ] `DELETE /api/volunteer-profile-photo` - Can delete own photo
- [ ] Cannot access `/api/volunteer-activity-logs?volunteer_id=OTHER_ID`

### C. Cross-User Protection

**Test unauthorized access:**
- [ ] Volunteer A cannot view Volunteer B's profile
- [ ] Volunteer A cannot upload photo for Volunteer B
- [ ] Volunteer A cannot view Volunteer B's activity logs
- [ ] API returns 401/403 for unauthorized attempts

---

## 3️⃣ API Endpoint Testing (localhost:3000)

### A. Profile Photo API

**POST /api/volunteer-profile-photo**

Test 1: Valid upload
```bash
# Upload valid image (JPG, PNG < 5MB)
# Expected: 200 OK, returns photo URL
```
- [ ] Accepts JPG files
- [ ] Accepts PNG files
- [ ] Accepts WebP files
- [ ] Returns valid Supabase storage URL
- [ ] Updates `users.profile_photo_url` in database

Test 2: Invalid uploads
```bash
# Upload invalid file types
# Expected: 400 Bad Request
```
- [ ] Rejects PDF files (400 error)
- [ ] Rejects files > 5MB (413 error)
- [ ] Rejects non-image files (400 error)
- [ ] Returns helpful error messages

Test 3: Authentication
```bash
# Upload without auth token
# Expected: 401 Unauthorized
```
- [ ] Requires authentication
- [ ] Returns 401 without token

**DELETE /api/volunteer-profile-photo**

Test 1: Delete own photo
```bash
# Delete authenticated user's photo
# Expected: 200 OK
```
- [ ] Deletes photo from storage
- [ ] Sets `profile_photo_url` to null
- [ ] Returns success message

Test 2: Authentication
```bash
# Delete without auth
# Expected: 401
```
- [ ] Requires authentication

### B. Activity Logs API

**GET /api/volunteer-activity-logs**

Test 1: Fetch own logs
```bash
# GET with auth
# Expected: 200 OK, array of logs
```
- [ ] Returns array of activity logs
- [ ] Logs are ordered by created_at DESC
- [ ] Includes related user information
- [ ] Returns empty array if no logs

Test 2: Filter by type
```bash
# GET ?activity_type=profile_updated
# Expected: Filtered results
```
- [ ] Filters by activity_type correctly
- [ ] Returns only matching logs

Test 3: Limit results
```bash
# GET ?limit=10
# Expected: Max 10 results
```
- [ ] Respects limit parameter
- [ ] Defaults to reasonable limit

Test 4: Authentication
```bash
# GET without auth
# Expected: 401
```
- [ ] Requires authentication

**POST /api/volunteer-activity-logs**

Test 1: Create manual log
```bash
POST {
  "activity_type": "other",
  "title": "Test Activity",
  "description": "Manual test"
}
# Expected: 201 Created
```
- [ ] Creates new log entry
- [ ] Returns created log with ID
- [ ] Sets created_by to current user
- [ ] Timestamps created_at correctly

Test 2: Validation
```bash
POST {
  "activity_type": "invalid_type"
}
# Expected: 400 Bad Request
```
- [ ] Validates activity_type enum
- [ ] Requires title field
- [ ] Returns validation errors

Test 3: Authentication
```bash
# POST without auth
# Expected: 401
```
- [ ] Requires authentication

---

## 4️⃣ TypeScript Error Resolution

### A. Type Regeneration
```bash
npx supabase gen types typescript --local > src/types/supabase.ts
```

- [ ] Types regenerated successfully
- [ ] `users` table includes new 5 fields in types
- [ ] `volunteer_activity_logs` table exists in types
- [ ] No "Property does not exist on type 'never'" errors

### B. Build Verification
```bash
npm run build
```

- [ ] Build completes successfully
- [ ] No TypeScript compilation errors
- [ ] No type errors in `volunteers.ts`
- [ ] No type errors in profile page
- [ ] Build output shows "Compiled successfully"

### C. IDE Type Checking
- [ ] Open `src/lib/volunteers.ts` in IDE
- [ ] No red squiggly lines
- [ ] Autocomplete works for new fields
- [ ] Hover shows correct types
- [ ] No "never" type warnings

---

## 5️⃣ Full UI Flow Testing

### Test Flow 1: New Volunteer Profile Setup

**Steps:**
1. Login as new volunteer with empty profile
2. Navigate to `/volunteer/profile`
3. Page loads without errors
4. Upload profile photo (test-photo.jpg)
5. Fill personal info:
   - Phone: `+63 912 345 6789`
   - Gender: `Male`
   - Address: `123 Test Street, City`
   - Barangay: `Test Barangay`
6. Fill emergency contact:
   - Name: `Jane Doe`
   - Phone: `+63 912 987 6543`
   - Relationship: `Spouse`
7. Select skills: `FIRST AID`, `CPR`, `EMERGENCY RESPONSE`
8. Select availability: `MONDAY`, `WEDNESDAY`, `FRIDAY`
9. Add notes: `Available for emergency response`
10. Click "Save All Changes"

**Verify:**
- [ ] No console errors during flow
- [ ] Photo uploads and displays
- [ ] All fields accept input
- [ ] Skills highlight when selected
- [ ] Days highlight when selected
- [ ] Loading spinner shows during save
- [ ] Success toast appears
- [ ] Page doesn't reload unnecessarily

### Test Flow 2: Data Persistence

**Steps:**
1. After completing Test Flow 1
2. Hard refresh page (Ctrl+F5 or Cmd+Shift+R)
3. Wait for page to load

**Verify:**
- [ ] Profile photo displays (same image)
- [ ] Phone number: `+63 912 345 6789`
- [ ] Gender: `Male`
- [ ] Address: `123 Test Street, City`
- [ ] Barangay: `Test Barangay`
- [ ] Emergency name: `Jane Doe`
- [ ] Emergency phone: `+63 912 987 6543`
- [ ] Emergency relationship: `Spouse`
- [ ] Skills: FIRST AID, CPR, EMERGENCY RESPONSE (highlighted)
- [ ] Availability: MONDAY, WEDNESDAY, FRIDAY (highlighted)
- [ ] Notes: `Available for emergency response`

### Test Flow 3: Profile Updates

**Steps:**
1. With saved profile from Test Flow 2
2. Change phone to `+63 917 111 2222`
3. Change gender to `Female`
4. Add skill: `FIREFIGHTING`
5. Remove day: `MONDAY`
6. Update notes: `Updated availability`
7. Click "Save All Changes"
8. Refresh page

**Verify:**
- [ ] Updates saved successfully
- [ ] Phone updated to new number
- [ ] Gender updated to Female
- [ ] FIREFIGHTING skill highlighted
- [ ] MONDAY no longer highlighted
- [ ] Notes show updated text
- [ ] Other fields unchanged

### Test Flow 4: Photo Upload & Replace

**Steps:**
1. Upload initial photo (photo1.jpg)
2. Verify displays correctly
3. Upload replacement photo (photo2.jpg)
4. Verify new photo replaces old one
5. Remove photo using delete button
6. Verify photo removed from display
7. Re-upload photo (photo3.jpg)
8. Refresh page

**Verify:**
- [ ] Initial photo uploads and displays
- [ ] Replacement photo updates (old photo replaced)
- [ ] Delete removes photo from UI
- [ ] Delete sets profile_photo_url to null in DB
- [ ] Re-upload works after delete
- [ ] Photo persists after refresh

### Test Flow 5: Document Management

**Steps:**
1. Switch to "Documents" tab
2. Upload test PDF file
3. Verify document appears in list
4. Upload test image file
5. Verify both documents listed
6. Download first document
7. Delete second document
8. Switch to "Activity Log" tab
9. Verify "document_uploaded" entries appear

**Verify:**
- [ ] Tab switches correctly
- [ ] Upload button functional
- [ ] Documents list updates immediately
- [ ] File names display correctly
- [ ] File sizes display correctly
- [ ] Download works
- [ ] Delete removes document
- [ ] Activity log tracks uploads

### Test Flow 6: Activity Log Tracking

**Steps:**
1. Start with empty activity log
2. Update profile information
3. Switch to "Activity Log" tab
4. Verify "profile_updated" entry
5. Go back to profile, add a skill
6. Save changes
7. Check activity log
8. Verify "skills_updated" entry
9. Upload a document
10. Check activity log
11. Verify "document_uploaded" entry

**Verify:**
- [ ] Activity log initially empty or has entries
- [ ] Profile updates create log entries
- [ ] Skills updates create log entries
- [ ] Document uploads create log entries
- [ ] Entries show timestamps
- [ ] Entries show activity icons
- [ ] Entries are in chronological order

### Test Flow 7: Export Functions

**Steps:**
1. Ensure profile is fully filled out
2. Click "Export PDF" button
3. Verify print dialog opens
4. Check print preview content
5. Close print dialog
6. Click "Export CSV" button
7. Verify CSV downloads
8. Open CSV in Excel/Sheets
9. Verify all data present

**Verify:**
- [ ] PDF button functional
- [ ] Print dialog opens
- [ ] PDF preview shows all data
- [ ] PDF formatted correctly
- [ ] PDF includes profile photo reference
- [ ] CSV button functional
- [ ] CSV downloads automatically
- [ ] CSV file opens correctly
- [ ] CSV contains all fields
- [ ] CSV data matches profile

### Test Flow 8: Availability Toggle

**Steps:**
1. Toggle availability OFF
2. Verify toggle changes to gray
3. Verify text changes to "Not Available"
4. Wait 2 seconds
5. Refresh page
6. Verify toggle state persists (OFF)
7. Switch to Activity Log tab
8. Verify "availability_changed" entry
9. Toggle back ON
10. Verify state changes immediately

**Verify:**
- [ ] Toggle changes visual state
- [ ] Text updates correctly
- [ ] State persists across refresh
- [ ] Activity log entry created
- [ ] No page reload on toggle
- [ ] Loading spinner during update

---

## 6️⃣ Design System Validation

### A. Color Palette Consistency

**Verify these colors are used consistently:**

Primary Colors:
- [ ] Blue #2563eb - Buttons, selected skills, links
- [ ] Green #16a34a - Availability days, success states
- [ ] Purple #9333ea - Activity log, document section
- [ ] Red #dc2626 - Delete actions, error states

Neutral Colors:
- [ ] White #ffffff - Card backgrounds
- [ ] Gray-50 #f9fafb - Subtle backgrounds
- [ ] Gray-100 #f3f4f6 - Borders light
- [ ] Gray-200 #e5e7eb - Main borders
- [ ] Gray-300 #d1d5db - Input borders
- [ ] Gray-500 #6b7280 - Secondary text
- [ ] Gray-700 #374151 - Labels
- [ ] Gray-900 #111827 - Primary text

### B. Spacing & Layout

**Header Section:**
- [ ] Padding: p-6 (24px) on white card
- [ ] Gap between title and stats: mt-4 (16px)
- [ ] Stats grid gap: gap-4 (16px)

**Form Sections:**
- [ ] Card padding: p-6 (24px)
- [ ] Section gap: space-y-6 (24px)
- [ ] Form field gap: gap-6 (24px)
- [ ] Label margin: mb-2 (8px)

**Buttons:**
- [ ] Primary button padding: px-6 py-3 (24px x 12px)
- [ ] Secondary button padding: px-4 py-2 (16px x 8px)
- [ ] Button gap in groups: gap-3 (12px)

**Cards:**
- [ ] Border radius: rounded-lg (8px)
- [ ] Shadow: shadow-sm
- [ ] Border: border border-gray-200

### C. Typography Hierarchy

**Page Title:**
- [ ] Size: text-3xl (30px)
- [ ] Weight: font-bold
- [ ] Color: text-gray-900

**Section Headers:**
- [ ] Size: text-lg (18px)
- [ ] Weight: font-semibold
- [ ] Color: text-gray-900
- [ ] Margin: mb-4 (16px)

**Form Labels:**
- [ ] Size: text-sm (14px)
- [ ] Weight: font-medium
- [ ] Color: text-gray-700
- [ ] Margin: mb-2 (8px)

**Body Text:**
- [ ] Size: text-sm (14px)
- [ ] Weight: font-normal
- [ ] Color: text-gray-900

**Helper Text:**
- [ ] Size: text-sm (14px)
- [ ] Color: text-gray-500

### D. Responsive Breakpoints

**Mobile (< 640px):**
- [ ] Single column layout
- [ ] Statistics stack vertically
- [ ] Form fields full width
- [ ] Buttons stack vertically
- [ ] Tab text wraps appropriately

**Tablet (640px - 1024px):**
- [ ] Statistics in 2-3 columns
- [ ] Form fields in 2 columns
- [ ] Buttons remain horizontal
- [ ] Good spacing maintained

**Desktop (> 1024px):**
- [ ] Statistics in 3 columns
- [ ] Form fields in 2 columns
- [ ] Max width container: max-w-7xl
- [ ] All elements well-spaced

### E. Interactive States

**Buttons:**
- [ ] Hover: Background darkens slightly
- [ ] Focus: 2px ring visible (ring-2)
- [ ] Active: Further darkening
- [ ] Disabled: opacity-50, cursor-not-allowed

**Input Fields:**
- [ ] Normal: border-gray-300
- [ ] Focus: ring-2 ring-blue-500, border-blue-500
- [ ] Error: border-red-500 (if applicable)

**Skill/Day Buttons:**
- [ ] Unselected: white bg, gray border
- [ ] Hover (unselected): border-blue-400, bg-blue-50
- [ ] Selected: blue/green bg, white text, thicker border
- [ ] Transition: smooth color change

**Tabs:**
- [ ] Inactive: gray text, transparent border
- [ ] Hover (inactive): darker gray, gray border
- [ ] Active: blue text, blue border-bottom-2

---

## 7️⃣ Error Handling & Edge Cases

### A. Network Errors

**Simulate network issues:**
- [ ] Disable internet during save
- [ ] Verify error toast appears
- [ ] Verify data not partially saved
- [ ] Re-enable internet and retry
- [ ] Verify save works after reconnect

### B. File Upload Errors

**Test invalid uploads:**
- [ ] Upload file > 5MB → Shows size error
- [ ] Upload non-image file → Shows type error
- [ ] Upload during network issue → Shows upload error
- [ ] Cancel upload mid-process → Handles gracefully

### C. Empty States

**Test with empty data:**
- [ ] No profile photo → Shows placeholder
- [ ] No documents → Shows "No documents" message
- [ ] No activity logs → Shows empty state
- [ ] No skills selected → Form still works
- [ ] No notes → Text area empty but functional

### D. Concurrent Updates

**Test race conditions:**
- [ ] Open profile in two tabs
- [ ] Update field in tab 1, save
- [ ] Update different field in tab 2, save
- [ ] Verify no data loss
- [ ] Refresh both tabs
- [ ] Verify consistent state

---

## 8️⃣ Performance Checks

### A. Page Load Speed
- [ ] Profile page loads in < 2 seconds
- [ ] No layout shift during load
- [ ] Images load progressively
- [ ] No blocking resources

### B. Upload Performance
- [ ] Photo upload completes in < 5 seconds (5MB file)
- [ ] Progress indication during upload
- [ ] No UI freeze during upload

### C. Data Fetching
- [ ] Activity logs load in < 1 second
- [ ] Documents list loads in < 1 second
- [ ] Profile data loads in < 1 second

---

## 9️⃣ Security Validation

### A. Authentication
- [ ] All API routes require authentication
- [ ] Unauthenticated requests return 401
- [ ] Invalid tokens rejected
- [ ] Session expiry handled

### B. Authorization
- [ ] Users can only access own data
- [ ] Cross-user access blocked (403)
- [ ] Admin can access all data
- [ ] File uploads scoped to user

### C. Input Validation
- [ ] SQL injection prevented (parameterized queries)
- [ ] XSS prevented (sanitized inputs)
- [ ] File type validation server-side
- [ ] File size limits enforced

### D. RLS Policies
- [ ] Users can only query own profile
- [ ] Users can only update own profile
- [ ] Users can only upload to own folder
- [ ] Admin override works

---

## 🏁 Final Sign-Off

### All Systems Go?

- [ ] **Database:** All migrations applied, no conflicts
- [ ] **Types:** TypeScript errors resolved, build succeeds
- [ ] **APIs:** All endpoints tested and working
- [ ] **UI:** All flows tested, data persists
- [ ] **Design:** Consistent spacing, colors, typography
- [ ] **Responsive:** Works on mobile, tablet, desktop
- [ ] **Security:** Auth/authz working, RLS active
- [ ] **Performance:** Fast load times, smooth interactions
- [ ] **Error Handling:** Graceful error states
- [ ] **Role Access:** Admin and volunteer permissions correct

### Sign-Off

**Validated by:** ________________  
**Date:** ________________  
**Environment:** [ ] Local [ ] Staging [ ] Production  

**Status:** [ ] ✅ APPROVED FOR PRODUCTION [ ] ❌ NEEDS WORK

**Notes:**
```
[Add any additional notes or observations here]
```

---

## 📸 Screenshot Checklist

Capture these for documentation:
- [ ] Profile page - desktop view (all tabs)
- [ ] Profile page - mobile view
- [ ] Profile with data filled out
- [ ] Photo upload in progress
- [ ] Document list with files
- [ ] Activity log with entries
- [ ] Export PDF preview
- [ ] Success toast message
- [ ] Error state example

---

**Once all checkboxes are marked, feature is PRODUCTION READY!** 🚀
