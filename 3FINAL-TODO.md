# 🚨 Hybrid "Guest SOS" Mode - Full Implementation Proposal

> **Status**: Proposal  
> **Date**: 2025-01-31  
> **Goal**: Add fast emergency reporting without breaking existing resident system

---

## 📋 **EXECUTIVE SUMMARY**

**What We're Building:**
- ✅ Fast emergency reporting (no login required)
- ✅ Status tracking via temporary ID
- ✅ Guest profile stored in LocalStorage
- ✅ Optional account upgrade path
- ✅ **Zero impact on existing resident system**

**Key Principle:**
- Guest SOS is an **additional feature**, not a replacement
- Existing authenticated residents continue working exactly as before
- Both systems coexist seamlessly

---

## 🎯 **USER FLOWS**

### **Flow 1: Guest SOS (New Users)**

```
1. User opens app → Sees login page
2. Clicks "🚨 Quick SOS" button (big red button)
3. Quick profile form appears:
   - Name (required)
   - Phone (required)
   - Address (optional, auto-filled from GPS)
   - Barangay (dropdown)
4. User fills form → Clicks "Send SOS"
5. System:
   - Saves profile to LocalStorage
   - Gets GPS location
   - Creates guest incident (no login)
   - Generates tracking ID
6. Redirects to status page: `/guest/incident/[trackingId]`
7. User can:
   - View incident status
   - See volunteer assignment
   - Get updates (via polling)
   - Option: "Create Account" button
```

### **Flow 2: Existing Resident (No Change)**

```
1. User logs in (Google OAuth or email/password)
2. Goes to dashboard
3. Everything works exactly as before
4. No changes to existing flow
```

### **Flow 3: Guest → Account Upgrade**

```
1. Guest views incident status
2. Clicks "Create Account" button
3. System:
   - Pre-fills registration form with guest profile
   - Links guest incident to new account
   - Migrates LocalStorage profile to account
4. User completes registration
5. All future incidents use authenticated account
```

---

## 🏗️ **TECHNICAL ARCHITECTURE**

### **1. Database Schema Changes**

**Option A: Allow NULL reporter_id (Recommended)**
```sql
-- Modify incidents table to allow NULL reporter_id
ALTER TABLE incidents 
  ALTER COLUMN reporter_id DROP NOT NULL;

-- Add guest tracking fields
ALTER TABLE incidents 
  ADD COLUMN guest_tracking_id VARCHAR(12) UNIQUE,
  ADD COLUMN guest_name VARCHAR(255),
  ADD COLUMN guest_phone VARCHAR(20),
  ADD COLUMN is_guest BOOLEAN DEFAULT FALSE;

-- Add index for guest tracking
CREATE INDEX idx_incidents_guest_tracking ON incidents(guest_tracking_id) 
  WHERE guest_tracking_id IS NOT NULL;
```

**Option B: Create Guest User System**
```sql
-- Create special "guest" user account
-- All guest incidents link to this account
-- Store actual guest info in guest_name, guest_phone fields
```

**Recommendation**: **Option A** - Cleaner, more flexible

---

### **2. New API Endpoints**

#### **POST `/api/guest/sos`**
```typescript
// Create guest incident without authentication
{
  name: string,
  phone: string,
  address?: string,
  barangay: string,
  location_lat: number,
  location_lng: number,
  incident_type: "EMERGENCY INCIDENT",
  description?: string,
  photo_urls?: string[]
}

// Response:
{
  success: true,
  tracking_id: "SOS-ABC123",
  incident_id: "uuid",
  status_url: "/guest/incident/SOS-ABC123"
}
```

#### **GET `/api/guest/incident/[trackingId]`**
```typescript
// Get incident status by tracking ID (no auth required)
// Response:
{
  success: true,
  incident: {
    id: "uuid",
    status: "PENDING" | "ASSIGNED" | "RESPONDING" | "RESOLVED",
    incident_type: string,
    created_at: string,
    assigned_to: {
      first_name: string,
      last_name: string,
      phone_number: string
    } | null,
    timeline: [...]
  }
}
```

#### **POST `/api/guest/upgrade-account`**
```typescript
// Upgrade guest incident to authenticated account
{
  tracking_id: string,
  email: string,
  password: string,
  // Profile already in LocalStorage
}

// Response:
{
  success: true,
  user_id: "uuid",
  // Links guest incident to new account
}
```

---

### **3. New Pages/Components**

#### **`/guest/sos` - Quick SOS Form**
- Simple form (name, phone, address, barangay)
- GPS location capture
- Photo upload (optional)
- Big red "Send SOS" button
- Stores profile in LocalStorage

#### **`/guest/incident/[trackingId]` - Status Tracking**
- Shows incident status
- Real-time updates (polling every 5 seconds)
- Volunteer assignment info
- Timeline of updates
- "Create Account" button (optional)

#### **Login Page Enhancement**
- Add big red "🚨 Quick SOS" button
- Positioned prominently (above or beside login form)
- Links to `/guest/sos`

---

### **4. LocalStorage Schema**

```typescript
interface GuestProfile {
  name: string
  phone: string
  address?: string
  barangay?: string
  saved_at: string // ISO timestamp
}

interface GuestIncident {
  tracking_id: string
  incident_id: string
  created_at: string
}

// Storage keys:
localStorage.setItem('guest_profile', JSON.stringify(profile))
localStorage.setItem('guest_incidents', JSON.stringify([...incidents]))
```

---

## 🔒 **SECURITY & SPAM PREVENTION**

### **Rate Limiting**
```typescript
// Rate limit guest SOS by:
1. IP address (max 3 per hour)
2. Phone number (max 5 per day)
3. Device fingerprint (max 10 per day)
```

### **Validation**
- Phone number format validation
- GPS location must be within Talisay City
- Barangay must be valid
- Name must be 2+ characters

### **Spam Detection**
- Flag incidents with same phone + location within 5 minutes
- Admin can mark as spam
- Block phone numbers after 3 spam reports

---

## 📱 **UI/UX DESIGN**

### **Login Page Layout**
```
┌─────────────────────────────────┐
│         RVOIS Logo               │
│   [🚨 QUICK SOS - BIG RED BTN]  │
│                                  │
│   ──── OR ────                   │
│                                  │
│   [Google Sign In]              │
│   [Email/Password Login]         │
└─────────────────────────────────┘
```

### **Quick SOS Form**
```
┌─────────────────────────────────┐
│  🚨 Emergency Report            │
│                                  │
│  Name: [___________]             │
│  Phone: [___________]             │
│  Address: [___________]         │
│  Barangay: [Dropdown ▼]         │
│                                  │
│  📍 Getting your location...     │
│                                  │
│  [📷 Add Photo] (optional)       │
│                                  │
│  [🚨 SEND SOS] (Big Red Button) │
└─────────────────────────────────┘
```

### **Status Tracking Page**
```
┌─────────────────────────────────┐
│  Incident: SOS-ABC123           │
│  Status: ASSIGNED ✅             │
│                                  │
│  Volunteer:                      │
│  Juan Dela Cruz                  │
│  📞 09123456789                  │
│                                  │
│  Timeline:                       │
│  • Created: 2:30 PM              │
│  • Assigned: 2:35 PM             │
│  • Responding: 2:40 PM          │
│                                  │
│  [Create Account] (optional)    │
└─────────────────────────────────┘
```

---

## 🔄 **MIGRATION & UPGRADE PATH**

### **Guest → Account Upgrade Flow**

1. **User clicks "Create Account"**
2. **Pre-fill registration form** with LocalStorage data
3. **Create account** (Google OAuth or email/password)
4. **Link guest incident** to new account:
   ```sql
   UPDATE incidents 
   SET reporter_id = $1, 
       is_guest = FALSE,
       guest_tracking_id = NULL
   WHERE guest_tracking_id = $2
   ```
5. **Migrate LocalStorage** → Database profile
6. **Redirect to dashboard** with all incidents linked

---

## ✅ **IMPLEMENTATION CHECKLIST**

### **Phase 1: Database & API (Backend)**
- [ ] Modify `incidents` table schema (allow NULL reporter_id)
- [ ] Add guest tracking fields
- [ ] Create `POST /api/guest/sos` endpoint
- [ ] Create `GET /api/guest/incident/[trackingId]` endpoint
- [ ] Add rate limiting for guest SOS
- [ ] Add spam detection logic
- [ ] Create `POST /api/guest/upgrade-account` endpoint

### **Phase 2: Frontend Pages**
- [ ] Create `/guest/sos` page (Quick SOS form)
- [ ] Create `/guest/incident/[trackingId]` page (Status tracking)
- [ ] Add LocalStorage utilities
- [ ] Add GPS location capture
- [ ] Add photo upload (optional)

### **Phase 3: Login Page Enhancement**
- [ ] Add "🚨 Quick SOS" button to login page
- [ ] Style button prominently (big, red)
- [ ] Add routing to `/guest/sos`

### **Phase 4: Account Upgrade**
- [ ] Create upgrade flow UI
- [ ] Pre-fill registration form
- [ ] Link guest incidents to account
- [ ] Migrate LocalStorage data

### **Phase 5: Testing**
- [ ] Test guest SOS flow end-to-end
- [ ] Test status tracking
- [ ] Test rate limiting
- [ ] Test spam prevention
- [ ] Test account upgrade
- [ ] Verify existing resident system still works

---

## 🚫 **WHAT WON'T CHANGE**

### **Existing Resident System:**
- ✅ Login flow (Google OAuth, email/password)
- ✅ Dashboard (`/resident/dashboard`)
- ✅ History page (`/resident/history`)
- ✅ Incident reporting (`/resident/report`)
- ✅ Profile management
- ✅ Notifications
- ✅ All existing features

**Zero breaking changes to authenticated residents.**

---

## 📊 **DATA FLOW DIAGRAM**

```
┌─────────────┐
│  Guest User │
└──────┬──────┘
       │
       │ 1. Fills Quick SOS Form
       ▼
┌─────────────────┐
│  LocalStorage   │ ← Saves profile
│  (Guest Profile)│
└─────────────────┘
       │
       │ 2. POST /api/guest/sos
       ▼
┌─────────────────┐
│  Database       │
│  incidents      │ ← Creates with is_guest=true
│  (reporter_id=NULL)│
└─────────────────┘
       │
       │ 3. Returns tracking_id
       ▼
┌─────────────────┐
│  Status Page    │
│  /guest/incident│ ← Polls for updates
│  /[trackingId]  │
└─────────────────┘
       │
       │ 4. Optional: Upgrade
       ▼
┌─────────────────┐
│  Create Account │
│  Links incident │ ← reporter_id updated
└─────────────────┘
```

---

## 🎯 **SUCCESS METRICS**

1. **Fast Emergency Reporting**
   - Target: < 30 seconds from app open to SOS sent
   - No login required

2. **Status Tracking**
   - Real-time updates (5-second polling)
   - Volunteer assignment visible

3. **Zero Breaking Changes**
   - Existing residents: 100% functionality preserved
   - No regressions

4. **Account Upgrade Rate**
   - Track: % of guests who upgrade to accounts
   - Target: > 20% conversion

---

## 🔧 **TECHNICAL DETAILS**

### **Tracking ID Generation**
```typescript
function generateTrackingId(): string {
  const prefix = 'SOS'
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `${prefix}-${random}` // e.g., "SOS-ABC123"
}
```

### **Status Polling**
```typescript
// Poll every 5 seconds when status is not RESOLVED
useEffect(() => {
  if (status === 'RESOLVED') return
  
  const interval = setInterval(async () => {
    const response = await fetch(`/api/guest/incident/${trackingId}`)
    const data = await response.json()
    setIncident(data.incident)
  }, 5000)
  
  return () => clearInterval(interval)
}, [trackingId, status])
```

### **LocalStorage Management**
```typescript
// Save guest profile
function saveGuestProfile(profile: GuestProfile) {
  localStorage.setItem('guest_profile', JSON.stringify({
    ...profile,
    saved_at: new Date().toISOString()
  }))
}

// Load guest profile
function loadGuestProfile(): GuestProfile | null {
  const stored = localStorage.getItem('guest_profile')
  return stored ? JSON.parse(stored) : null
}

// Save guest incident
function saveGuestIncident(trackingId: string, incidentId: string) {
  const incidents = loadGuestIncidents()
  incidents.push({ trackingId, incidentId, created_at: new Date().toISOString() })
  localStorage.setItem('guest_incidents', JSON.stringify(incidents))
}
```

---

## 🚀 **ROLLOUT PLAN**

### **Week 1: Backend**
- Database migration
- API endpoints
- Rate limiting
- Testing

### **Week 2: Frontend**
- Quick SOS form
- Status tracking page
- Login page enhancement
- LocalStorage utilities

### **Week 3: Integration & Testing**
- End-to-end testing
- Account upgrade flow
- Performance testing
- Security audit

### **Week 4: Launch**
- Soft launch (beta)
- Monitor metrics
- Gather feedback
- Iterate

---

## ❓ **QUESTIONS TO ANSWER**

1. **Should guest incidents appear in admin dashboard?**
   - ✅ YES - Admins need to see all incidents

2. **Should guests receive SMS notifications?**
   - ✅ YES - Use guest_phone field

3. **Should guests receive push notifications?**
   - ❌ NO - Requires account (can't subscribe without auth)

4. **How long should guest incidents be stored?**
   - ✅ 30 days (same as regular incidents)

5. **Should guests be able to add photos?**
   - ✅ YES - Same upload flow, store in same bucket

---

## 📝 **FINAL NOTES**

This proposal maintains **100% backward compatibility** with existing resident system while adding fast emergency reporting for new users. The two systems coexist seamlessly, and guests can upgrade to full accounts at any time.

**Key Benefits:**
- ✅ Fast emergency reporting (no login)
- ✅ Status tracking (via tracking ID)
- ✅ Account upgrade path
- ✅ Zero breaking changes
- ✅ Spam prevention
- ✅ Clean architecture

**Ready to implement?** Let me know and I'll start with Phase 1! 🚀

