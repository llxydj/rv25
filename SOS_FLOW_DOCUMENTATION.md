# 🚨 SOS Emergency Flow - Complete Documentation

## 📤 **HOW SOS IS SENT**

### **Step 1: User Initiates SOS**
1. Resident clicks the **SOS button** (floating red button, bottom-right)
2. Modal opens automatically
3. System immediately starts:
   - Fetching user profile (name, phone, address, barangay)
   - Capturing GPS location

### **Step 2: Data Collection**
```
User Profile Data:
├── Name: First + Last Name
├── Phone: Contact number
├── Address: Home address
└── Barangay: Location barangay

Location Data:
├── GPS Coordinates (lat, lng)
├── Reverse Geocoding (address lookup)
└── Validation (within Talisay City)
```

### **Step 3: SOS Request Submission**
**API Endpoint:** `POST /api/incidents`

**Payload Sent:**
```json
{
  "reporter_id": "user-uuid",
  "incident_type": "EMERGENCY INCIDENT",
  "description": "SOS ALERT: [Name] needs immediate assistance. Contact: [Phone]. Location: [Address/Coordinates]",
  "location_lat": 10.7302,
  "location_lng": 122.9455,
  "address": "Captured address or GPS location",
  "barangay": "User's barangay or UNKNOWN",
  "priority": 1,  // Highest priority (CRITICAL)
  "photo_url": null,
  "photo_urls": [],
  "voice_url": null
}
```

### **Step 4: Server Processing**
1. **Validation:**
   - Validates user authentication
   - Checks location is within Talisay City geofence
   - Verifies priority 1 matches EMERGENCY INCIDENT type
   - Validates all required fields

2. **Database Insert:**
   - Creates incident record in `incidents` table
   - Status: `PENDING`
   - Priority: `1` (Critical)
   - Severity: `CRITICAL` (auto-mapped from priority)
   - Logs creation in `incident_updates` timeline

3. **Notifications Sent:**
   - **Database Trigger:** Creates in-app notifications for all admins
   - **Push Notifications:** Sends push alerts to all admin devices
   - **SMS (if configured):** Sends SMS to admins for critical incidents

4. **Auto-Assignment (Optional):**
   - System attempts to auto-assign to nearest available volunteer
   - Finds volunteers within 15km radius (for priority 1)
   - Scores volunteers by:
     - Distance (40% weight)
     - Availability (30% weight)
     - Skills match (20% weight)
     - Barangay coverage (10% weight)
   - Assigns to best match if found
   - Sends notification to assigned volunteer

### **Step 5: Confirmation**
- Resident sees success message: "SOS Sent Successfully"
- Incident appears in admin dashboard immediately
- Admins receive push notifications

---

## 📥 **HOW SOS CAN BE RESPONDED**

### **ADMIN RESPONSE WORKFLOW**

#### **1. Admin Receives Alert**
- **Push Notification:** "🚨 New Incident Reported - EMERGENCY INCIDENT in [Barangay]"
- **In-App Notification:** Appears in notifications bell
- **Dashboard:** Incident appears in incidents list with red "Critical" badge

#### **2. Admin Views Incident**
**Location:** `/admin/incidents/[id]`

**Information Available:**
- **Incident Details:**
  - Type: EMERGENCY INCIDENT
  - Priority: 1 (Critical) - Red badge
  - Severity: CRITICAL
  - Status: PENDING
  - Description: Full SOS alert with user info and contact
  - Location: GPS coordinates + address
  - Barangay: User's barangay
  - Created: Timestamp

- **Reporter Information:**
  - Name: First + Last Name
  - Phone: Contact number
  - Address: Home address
  - Barangay: Location

- **Map View:**
  - Incident location marked on map
  - Nearby volunteers visible
  - Distance calculations

#### **3. Admin Response Options**

**Option A: Manual Assignment**
1. Click "Assign Volunteer" button
2. Select from list of available volunteers
3. System:
   - Updates incident status to `ASSIGNED`
   - Sets `assigned_to` = volunteer ID
   - Sets `assigned_at` = current timestamp
   - Logs assignment in timeline
   - Sends push notification to volunteer
   - Sends SMS to volunteer (if configured)

**Option B: Auto-Assignment (if not already done)**
- System automatically assigns if:
  - Incident is still PENDING
  - Available volunteers found within radius
  - Volunteer has matching skills

**Option C: Direct Response**
- Admin can call resident directly using phone number displayed
- Admin can update status manually if responding themselves

#### **4. Status Updates**
Admin can update incident status:
- `PENDING` → `ASSIGNED` (when volunteer assigned)
- `ASSIGNED` → `RESPONDING` (volunteer on the way)
- `RESPONDING` → `ARRIVED` (volunteer at scene)
- `ARRIVED` → `RESOLVED` (incident resolved)

---

### **VOLUNTEER RESPONSE WORKFLOW**

#### **1. Volunteer Receives Assignment**
- **Push Notification:** "📋 New Incident Assignment - You have been assigned to EMERGENCY INCIDENT in [Barangay]"
- **In-App Notification:** Appears in notifications
- **Incidents List:** Assigned incident appears in volunteer's incidents page

#### **2. Volunteer Views Incident**
**Location:** `/volunteer/incidents/[id]`

**Information Available:**
- All incident details
- Reporter contact information
- Location on map with directions
- Timeline of updates

#### **3. Volunteer Response Actions**

**Step 1: Accept & Respond**
- Click "On the Way" or "Responding"
- Status changes to `RESPONDING`
- Resident receives notification: "Volunteer is on the way"
- Location tracking starts (if enabled)

**Step 2: Arrive at Scene**
- Click "Arrived"
- Status changes to `ARRIVED`
- Resident receives notification: "Volunteer has arrived"
- **Severity Assessment** becomes available

**Step 3: Assess Severity**
- Volunteer can update severity level:
  - MINOR
  - MODERATE
  - SEVERE
  - CRITICAL
- Adds assessment notes
- Logged in timeline

**Step 4: Resolve Incident**
- Click "Resolve"
- Status changes to `RESOLVED`
- Add resolution notes
- Resident receives notification: "Incident has been resolved"
- Admin sees completion in dashboard

---

## 🔔 **NOTIFICATION FLOW**

### **When SOS is Sent:**
1. **Admins:**
   - Push notification: "🚨 New Incident Reported"
   - In-app notification in notifications table
   - SMS alert (if configured for critical incidents)

2. **Auto-Assigned Volunteer (if applicable):**
   - Push notification: "📋 New Incident Assignment"
   - In-app notification
   - SMS alert

### **When Volunteer Responds:**
1. **Resident:**
   - "Volunteer is on the way" (RESPONDING)
   - "Volunteer has arrived" (ARRIVED)
   - "Incident has been resolved" (RESOLVED)

2. **Admin:**
   - Status update notifications
   - Timeline entries visible in incident detail

---

## 📊 **INCIDENT STATUS FLOW**

```
SOS Sent
   ↓
PENDING (Waiting for assignment)
   ↓
ASSIGNED (Volunteer assigned - manual or auto)
   ↓
RESPONDING (Volunteer on the way)
   ↓
ARRIVED (Volunteer at scene)
   ↓
RESOLVED (Incident completed)
```

---

## 🗺️ **WHERE TO VIEW SOS INCIDENTS**

### **For Admins:**
1. **Dashboard:** `/admin/dashboard`
   - Recent incidents widget
   - Map view with incident markers

2. **Incidents List:** `/admin/incidents`
   - Filter by status, priority, barangay
   - Search by type, description, reporter
   - Priority 1 incidents highlighted in red

3. **Incident Detail:** `/admin/incidents/[id]`
   - Full incident information
   - Assignment interface
   - Timeline of all updates
   - Map with location
   - Reporter contact info

### **For Volunteers:**
1. **My Incidents:** `/volunteer/incidents`
   - Shows only assigned incidents
   - Filter by status
   - Quick status update buttons

2. **Incident Detail:** `/volunteer/incidents/[id]`
   - Full incident information
   - Status update interface
   - Severity assessment tool
   - Map with directions
   - Reporter contact info

### **For Residents:**
1. **Report History:** `/resident/history`
   - View all reported incidents
   - See status updates
   - View timeline

2. **Incident Detail:** `/resident/incident/[id]`
   - View incident details
   - See assigned volunteer
   - Contact volunteer directly
   - View status updates

---

## ⚡ **AUTO-ASSIGNMENT LOGIC**

### **When Auto-Assignment Triggers:**
- Incident is `PENDING`
- Priority 1 (Critical) incidents: Immediate
- Priority 2-4: Immediate
- Priority 5: After 10 minutes delay

### **Assignment Criteria:**
1. **Distance:** Volunteers within radius
   - Priority 1: 15km
   - Priority 2: 12km
   - Priority 3: 8km
   - Priority 4: 5km
   - Priority 5: 3km

2. **Availability:** Volunteers with fewer active assignments

3. **Skills Match:** Volunteers with required skills for incident type

4. **Barangay Coverage:** Volunteers familiar with the area

### **Scoring System:**
- 40% - Distance (closer = higher score)
- 30% - Availability (fewer assignments = higher score)
- 20% - Skills match
- 10% - Barangay coverage

**Result:** Best matching volunteer is automatically assigned

---

## 🚨 **CRITICAL ALERTS**

### **Overdue Incident Monitoring:**
- System monitors all incidents
- Priority 1 incidents overdue by 5+ minutes trigger:
  - **Critical Alert:** "🚨 CRITICAL: 5-Minute Response Time Exceeded!"
  - SMS alerts to all admins
  - Push notifications with high priority
  - Escalation to additional volunteers

---

## ✅ **END-TO-END FLOW SUMMARY**

```
RESIDENT
   ↓
Clicks SOS Button
   ↓
Location + Profile Captured
   ↓
POST /api/incidents
   ↓
DATABASE
   ├── Incident Created (PENDING, Priority 1)
   ├── Timeline Entry Logged
   └── Notifications Created
   ↓
NOTIFICATIONS
   ├── Push to All Admins
   ├── In-App Notifications
   └── SMS (if configured)
   ↓
AUTO-ASSIGNMENT (if available)
   ├── Find Nearby Volunteers
   ├── Score & Rank
   └── Assign Best Match
   ↓
VOLUNTEER NOTIFIED
   ├── Push Notification
   ├── In-App Notification
   └── SMS Alert
   ↓
VOLUNTEER RESPONDS
   ├── Status: RESPONDING
   ├── Status: ARRIVED
   └── Status: RESOLVED
   ↓
RESIDENT NOTIFIED
   ├── "Volunteer on the way"
   ├── "Volunteer arrived"
   └── "Incident resolved"
   ↓
ADMIN MONITORS
   ├── Dashboard View
   ├── Timeline Updates
   └── Status Tracking
```

---

## 🔧 **TECHNICAL DETAILS**

### **API Endpoints Used:**
- `POST /api/incidents` - Create SOS incident
- `GET /api/incidents/[id]` - View incident details
- `POST /api/admin/incidents/assign` - Manual assignment
- `PATCH /api/incidents/[id]/status` - Update status
- `PATCH /api/incidents/[id]/severity` - Update severity

### **Database Tables:**
- `incidents` - Main incident records
- `incident_updates` - Timeline/status history
- `notifications` - In-app notifications
- `push_subscriptions` - Push notification subscriptions
- `users` - User profiles and contact info

### **Real-time Updates:**
- Supabase Realtime subscriptions
- Live status updates
- Real-time notifications
- Live location tracking (if enabled)

---

This complete flow ensures SOS requests are immediately visible to admins, can be quickly assigned to volunteers, and residents receive real-time updates on response progress.

