# 🔍 Pre-Production Validation Checklist

## ✅ 1. Schema Validation - No Conflicts Detected

### Current `users` Table Structure (from schema.sql)
```sql
CREATE TABLE public.users (
  id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  email text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  role USER-DEFINED NOT NULL,
  phone_number text,      -- ✅ EXISTS
  address text,           -- ✅ EXISTS
  barangay text,          -- ✅ EXISTS
  city text,
  province text,
  confirmation_phrase text,
  last_active timestamp with time zone DEFAULT now()
);
```

### New Fields Being Added (Migration 20251025000000)
```sql
-- ✅ NO CONFLICTS - All use "add column if not exists"
- gender text                          -- NEW
- emergency_contact_name text          -- NEW  
- emergency_contact_phone text         -- NEW
- emergency_contact_relationship text  -- NEW
- profile_photo_url text               -- NEW
```

**Status:** ✅ **SAFE** - No conflicts. All new columns use `if not exists` clause.

---

## ✅ 2. New Tables Validation

### `volunteer_activity_logs` Table (Migration 20251025000001)
```sql
create table if not exists public.volunteer_activity_logs (
  id uuid primary key default uuid_generate_v4(),
  volunteer_id uuid not null references public.users(id) on delete cascade,
  activity_type text not null,
  title text not null,
  description text,
  metadata jsonb,
  created_by uuid references public.users(id),
  created_at timestamp with time zone default now()
);
```

**Dependencies:**
- ✅ References `public.users(id)` - EXISTS
- ✅ Uses standard UUID generation
- ✅ Has proper foreign key constraints with CASCADE

**Triggers Created:**
- `log_volunteer_profile_update` - Tracks profile updates
- `log_volunteer_skills_update` - Tracks skills changes
- `log_volunteer_document_upload` - Tracks document uploads

**Status:** ✅ **SAFE** - Proper foreign keys, no conflicts

---

## ✅ 3. Storage Bucket Validation

### `volunteer-profile-photos` Bucket (Migration 20251025000002)
```sql
insert into storage.buckets (id, name, public)
values ('volunteer-profile-photos', 'volunteer-profile-photos', true)
on conflict (id) do nothing;
```

**RLS Policies:**
- ✅ Public read access (for displaying photos)
- ✅ Authenticated upload (users can upload their own)
- ✅ Authenticated update/delete (users can manage their own)
- ✅ Admin override (admins can manage all photos)

**Status:** ✅ **SAFE** - Proper security policies, conflict handling

---

## 🔐 4. Role Access & Permissions Testing

### Test Matrix

| Action | Volunteer (Self) | Volunteer (Other) | Admin |
|--------|------------------|-------------------|-------|
| View own profile | ✅ Should work | ❌ Should fail | ✅ Should work |
| Edit own profile | ✅ Should work | ❌ Should fail | ✅ Should work |
| Upload own photo | ✅ Should work | ❌ Should fail | ✅ Should work |
| View activity logs | ✅ Should work | ❌ Should fail | ✅ Should work |
| Update volunteer status | ❌ Should fail | ❌ Should fail | ✅ Should work |

### API Endpoints to Test

#### `/api/volunteer-profile-photo` (POST)
```bash
# Test as volunteer
curl -X POST http://localhost:3000/api/volunteer-profile-photo \
  -H "Authorization: Bearer YOUR_VOLUNTEER_TOKEN" \
  -F "file=@test-photo.jpg"

# Expected: 200 OK with photo URL
```

#### `/api/volunteer-profile-photo` (DELETE)
```bash
# Test as volunteer
curl -X DELETE http://localhost:3000/api/volunteer-profile-photo \
  -H "Authorization: Bearer YOUR_VOLUNTEER_TOKEN"

# Expected: 200 OK
```

#### `/api/volunteer-activity-logs` (GET)
```bash
# Test as volunteer
curl http://localhost:3000/api/volunteer-activity-logs \
  -H "Authorization: Bearer YOUR_VOLUNTEER_TOKEN"

# Expected: 200 OK with activity logs array
```

#### `/api/volunteer-activity-logs` (POST)
```bash
# Test as volunteer
curl -X POST http://localhost:3000/api/volunteer-activity-logs \
  -H "Authorization: Bearer YOUR_VOLUNTEER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "activity_type": "other",
    "title": "Manual test entry",
    "description": "Testing activity log creation"
  }'

# Expected: 201 Created
```

---

## 🧪 5. Full UI Flow Testing

### Test Scenario 1: Complete Profile Setup
**Steps:**
1. Login as volunteer
2. Navigate to `/volunteer/profile`
3. Upload profile photo (test image < 5MB)
4. Fill in personal information:
   - Phone: +63 912 345 6789
   - Gender: Select any option
   - Address: 123 Test Street
   - Barangay: Test Barangay
5. Fill emergency contact:
   - Name: Jane Doe
   - Phone: +63 912 987 6543
   - Relationship: Spouse
6. Select skills (at least 3)
7. Select availability (at least 3 days)
8. Add notes: "Test volunteer profile"
9. Click "Save All Changes"
10. **Verify:** Success toast appears
11. **Verify:** No console errors

### Test Scenario 2: Data Persistence
**Steps:**
1. After saving (Scenario 1)
2. Hard refresh page (Ctrl+F5)
3. **Verify:** All data persists:
   - Profile photo displays
   - All personal fields populated
   - Emergency contact fields populated
   - Skills selected (highlighted)
   - Availability days selected
   - Notes text visible
   - Assignment toggle state correct

### Test Scenario 3: Document Upload
**Steps:**
1. Click "Documents" tab
2. Upload a test PDF/image file
3. **Verify:** Document appears in list
4. Click "Activity Log" tab
5. **Verify:** "document_uploaded" entry appears
6. Return to Documents tab
7. Download the uploaded file
8. **Verify:** File downloads correctly
9. Delete the document
10. **Verify:** Document removed from list

### Test Scenario 4: Export Functionality
**Steps:**
1. Click "Profile Information" tab
2. Ensure profile is fully filled
3. Click "Export PDF"
4. **Verify:** Print dialog opens with formatted data
5. Save/print to verify formatting
6. Click "Export CSV"
7. **Verify:** CSV file downloads
8. Open CSV in Excel/spreadsheet
9. **Verify:** All profile data present

### Test Scenario 5: Availability Toggle
**Steps:**
1. Click availability toggle OFF
2. **Verify:** Toggle changes to gray/OFF state
3. **Verify:** Text changes to "Not Available"
4. Refresh page
5. **Verify:** Toggle state persists
6. Click "Activity Log" tab
7. **Verify:** "availability_changed" entry appears
8. Toggle back ON
9. **Verify:** State changes and persists

---

## 🎨 6. Design System Validation

### Color Palette Check
```
Primary Blue: #2563eb (bg-blue-600)
Success Green: #16a34a (bg-green-600)
Warning/Info Purple: #9333ea (bg-purple-600)
Error Red: #dc2626 (bg-red-600)
Gray Scale: #f9fafb → #1f2937 (50-900)
```

**Verify in UI:**
- [ ] Statistics cards use color-coded backgrounds
- [ ] Buttons use consistent blue (#2563eb)
- [ ] Skills use blue when selected
- [ ] Availability uses green when selected
- [ ] Status badges use appropriate colors
- [ ] Borders use gray-200 (#e5e7eb)

### Spacing & Layout Check
**Verify:**
- [ ] Section padding: p-6 (24px) on cards
- [ ] Gap between cards: space-y-6 (24px)
- [ ] Form field spacing: gap-6 (24px)
- [ ] Button padding: px-6 py-3 (24px x 12px)
- [ ] Consistent border radius: rounded-lg (8px)

### Typography Check
**Verify:**
- [ ] Page title: text-3xl font-bold
- [ ] Section headers: text-lg font-semibold  
- [ ] Form labels: text-sm font-medium
- [ ] Body text: text-sm
- [ ] Placeholder text: text-gray-500

### Responsive Breakpoints
**Test at:**
- [ ] Mobile (< 640px): Single column layout
- [ ] Tablet (640-1024px): 2-column forms
- [ ] Desktop (> 1024px): Full layout with 3-col stats

---

## 🛠️ 7. Supabase Type Regeneration

### Steps to Fix Type Errors

1. **Ensure migrations are applied:**
   ```bash
   cd "c:/Users/ACER ES1 524/Documents/rv"
   npx supabase db push
   ```

2. **Regenerate types:**
   ```bash
   # Generate new types from current database schema
   npx supabase gen types typescript --local > src/types/database.types.ts
   ```

3. **Update imports in affected files:**
   ```typescript
   // Add to src/lib/supabase.ts
   import { Database } from '@/types/database.types'
   
   export const supabase = createClient<Database>(...)
   ```

4. **Verify no runtime errors:**
   ```bash
   npm run build
   ```

### Alternative: Use Type Assertions (Temporary)
If regeneration doesn't work immediately, add type assertions:

```typescript
// In volunteers.ts
const { data: volunteerUsers, error: usersError } = await supabase
  .from('users')
  .select('*')
  .eq('role', 'volunteer') as any // Temporary fix
```

---

## ✅ Testing Commands

### Run Migrations
```bash
cd "c:/Users/ACER ES1 524/Documents/rv"

# Check current migration status
npx supabase migration list

# Apply all pending migrations
npx supabase db push

# Or apply individually
npx supabase migration up 20251025000000_add_volunteer_profile_fields
npx supabase migration up 20251025000001_volunteer_activity_logs  
npx supabase migration up 20251025000002_volunteer_profile_photos
```

### Start Development Server
```bash
npm run dev
```

### Check for Build Errors
```bash
npm run build
```

### View Database Schema
```bash
npx supabase db dump --schema public > current_schema.sql
```

---

## 📋 Final Validation Checklist

### Database
- [ ] Migrations applied successfully
- [ ] No migration errors in console
- [ ] `users` table has 5 new columns
- [ ] `volunteer_activity_logs` table exists
- [ ] Triggers are active
- [ ] Storage bucket exists
- [ ] RLS policies are active

### API Endpoints
- [ ] Profile photo POST works (with real image)
- [ ] Profile photo DELETE works
- [ ] Activity logs GET returns data
- [ ] Activity logs POST creates entries
- [ ] Authentication required (401 without token)
- [ ] Authorization working (can't access others' data)

### UI Components
- [ ] Profile photo upload works
- [ ] All form fields visible and functional
- [ ] Gender dropdown works
- [ ] Emergency contact fields save
- [ ] Skills multi-select works
- [ ] Availability multi-select works
- [ ] Save button works
- [ ] Loading states display
- [ ] Success/error toasts show
- [ ] Tabs switch correctly
- [ ] Document upload works
- [ ] Activity log displays
- [ ] Export PDF works
- [ ] Export CSV works

### Data Persistence
- [ ] All fields persist after save
- [ ] Data survives page refresh
- [ ] Profile photo URL persists
- [ ] Activity logs accumulate
- [ ] Documents list persists

### Design Consistency
- [ ] Colors match design system
- [ ] Spacing is consistent (24px gaps)
- [ ] Typography hierarchy correct
- [ ] Responsive on mobile
- [ ] Responsive on tablet
- [ ] Responsive on desktop
- [ ] No layout shifts
- [ ] Icons aligned properly
- [ ] Buttons have hover states
- [ ] Focus states visible

### TypeScript
- [ ] No build errors
- [ ] Types regenerated (optional)
- [ ] No runtime type errors
- [ ] Proper interfaces used

---

## 🚦 Sign-Off Criteria

**Ready for Production when:**
- ✅ All database validations pass
- ✅ All API tests return expected results
- ✅ Complete UI flow works end-to-end
- ✅ Data persists across sessions
- ✅ Design system is consistent
- ✅ No console errors
- ✅ No build errors
- ✅ TypeScript issues resolved/documented
- ✅ Admin access tested and verified
- ✅ Role permissions working correctly

---

## 📝 Testing Notes

**Record findings here:**

### Schema Conflicts
```
Status: ✅ PASS - No conflicts detected
Notes: All new columns use "if not exists"
```

### API Testing
```
Status: [ ] PASS / [ ] FAIL
Notes: 

Photo Upload: 
Activity Logs: 
Authentication: 
Authorization: 
```

### UI Flow Testing
```
Status: [ ] PASS / [ ] FAIL
Notes:

Profile Setup: 
Data Persistence: 
Document Upload: 
Export Functions: 
```

### Design Validation
```
Status: [ ] PASS / [ ] FAIL
Notes:

Colors: 
Spacing: 
Typography: 
Responsive: 
```

### Type Errors
```
Status: [ ] RESOLVED / [ ] DOCUMENTED
Notes:

Build Status: 
Runtime Errors: 
```

---

**Once all sections pass, feature is ready for production deployment!** ✅
