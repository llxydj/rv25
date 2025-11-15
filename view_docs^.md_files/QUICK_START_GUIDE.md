# 🚀 QUICK START GUIDE - RVOIS System

**Last Updated:** October 24, 2025  
**Version:** 2.0 (Production Ready)

---

## ⚡ QUICK DEPLOYMENT

### 1. Environment Setup (5 minutes)

Create `.env.local` file in project root:

```env
# Required - Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Optional - SMS Notifications  
SMS_API_URL=https://sms.iprogtech.com/
SMS_API_KEY=your_sms_api_key
SMS_SENDER=iprogsms
SMS_ENABLED=true

# Optional - Push Notifications
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_key
```

### 2. Install Dependencies (2 minutes)

```bash
pnpm install
```

### 3. Run Development Server

```bash
pnpm dev
```

Open http://localhost:3000

### 4. Build for Production

```bash
pnpm build
pnpm start
```

---

## 🧪 QUICK TESTING

### Test 1: Real-Time Location Tracking (3 minutes)

**Volunteer Side:**
1. Login as volunteer: http://localhost:3000/login
2. Go to Dashboard
3. Find "Location Sharing" card at top
4. Toggle ON
5. Grant location permissions
6. See "Active - Sharing your location"

**Admin Side (separate browser):**
1. Login as admin: http://localhost:3000/login
2. Go to Dashboard or Live Locations
3. Check header shows "🟢 Live"
4. See volunteer marker on map (updates < 3 seconds)

**Expected Result:** ✅ Admin sees volunteer location update in real-time

---

### Test 2: Incident Reporting with Photo (5 minutes)

**Resident Side:**
1. Login as resident: http://localhost:3000/login
2. Click "Report Incident" button
3. Select incident type: FIRE
4. Choose severity: 🔴 Critical
5. Enter description: "Kitchen fire in building"
6. Click "Use My Location" (or pin on map)
7. Take photo with camera
8. Verify watermark shows (date, time, location)
9. Submit report

**Admin Side:**
1. Refresh dashboard
2. See new incident appear in "Pending Incidents" card
3. Click incident to view details
4. Verify photo, location, and all data

**Expected Result:** ✅ Incident created with photo and location

---

### Test 3: Emergency Call (1 minute)

1. Login as resident
2. Click red floating phone button (bottom-right)
3. See emergency contacts modal
4. Click "Call" on any number
5. Verify device initiates call

**Expected Result:** ✅ Phone call initiated

---

### Test 4: Report Generation (2 minutes)

1. Login as admin
2. Navigate to Reports
3. Select "Last Month" date range
4. Click "Export Report" button
5. Verify CSV file downloads
6. Switch to "PDF Reports" tab
7. Generate PDF report
8. Verify PDF downloads

**Expected Result:** ✅ Reports download correctly

---

## 👥 DEFAULT TEST ACCOUNTS

Create test users in Supabase:

### Admin Account
```sql
-- Create admin user first via Supabase Auth
-- Then update role:
UPDATE users SET role = 'admin' 
WHERE email = 'admin@rvois.local';
```

### Volunteer Account
```sql
-- Create volunteer user
UPDATE users SET role = 'volunteer' 
WHERE email = 'volunteer@rvois.local';

-- Create volunteer profile
INSERT INTO volunteer_profiles (volunteer_user_id, admin_user_id, status, skills)
VALUES ('volunteer_user_id', 'admin_user_id', 'ACTIVE', ARRAY['First Aid', 'Fire Response']);
```

### Resident Account
```sql
-- Create resident (default role)
-- Users are 'resident' by default on signup
```

---

## 📱 PWA TESTING

### Install as App (Desktop)

1. Open http://localhost:3000 in Chrome
2. Look for install icon in address bar
3. Click "Install RVOIS"
4. App opens in standalone window

### Install as App (Mobile)

1. Open site on mobile browser
2. Tap "Add to Home Screen"
3. App icon appears on home screen
4. Opens full-screen like native app

### Test Offline Mode

1. Install PWA
2. Report an incident while online
3. Turn off WiFi/Data
4. Try to report another incident
5. See "Offline" message
6. Incident queued locally
7. Turn WiFi/Data back on
8. Queued incident auto-submits

**Expected Result:** ✅ Offline queue works

---

## 🔍 TROUBLESHOOTING

### Location Tracking Not Working

**Problem:** Toggle enabled but no location updates

**Solutions:**
1. Check browser permissions (Settings > Site Settings > Location)
2. Verify HTTPS connection (localhost is OK)
3. Open browser console, check for errors
4. Verify Supabase Realtime is enabled:
   ```sql
   ALTER TABLE location_tracking REPLICA IDENTITY FULL;
   ```

### Admin Can't See Volunteer Locations

**Problem:** Map shows but no volunteer markers

**Solutions:**
1. Check admin has "🟢 Live" status indicator
2. Verify volunteer has tracking enabled
3. Check RLS policies:
   ```sql
   SELECT * FROM location_tracking LIMIT 1;
   -- Should return data for admin
   ```
4. Check browser console for errors

### SMS Not Sending

**Problem:** Notifications work but no SMS received

**Solutions:**
1. Verify environment variables:
   ```bash
   echo $SMS_ENABLED
   echo $SMS_API_KEY
   ```
2. Check SMS API balance/quota
3. Review SMS logs table:
   ```sql
   SELECT * FROM sms_logs 
   ORDER BY timestamp_sent DESC 
   LIMIT 10;
   ```
4. Check error messages in logs

### Map Not Loading

**Problem:** Blank map or "Loading..." message

**Solutions:**
1. Check Leaflet CSS is loaded
2. Verify coordinates are valid
3. Clear browser cache
4. Check browser console for errors
5. Verify internet connection (map tiles load from external source)

---

## 📊 QUICK HEALTH CHECK

Run these SQL queries in Supabase to verify system health:

### Check Active Users
```sql
SELECT role, COUNT(*) 
FROM users 
GROUP BY role;
```

Expected: At least 1 admin, some volunteers and residents

### Check Recent Incidents
```sql
SELECT status, COUNT(*) 
FROM incidents 
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status;
```

### Check Location Tracking
```sql
SELECT COUNT(*) 
FROM location_tracking 
WHERE timestamp > NOW() - INTERVAL '1 hour';
```

Expected: > 0 if volunteers are tracking

### Check Notifications Sent
```sql
SELECT COUNT(*) 
FROM sms_logs 
WHERE timestamp_sent > NOW() - INTERVAL '24 hours';
```

---

## 🚨 CRITICAL FEATURES CHECKLIST

Before going live, verify:

- [ ] Incident reporting works end-to-end
- [ ] Photo upload and watermarking functional
- [ ] Location tracking updates in real-time
- [ ] Emergency call button works on mobile
- [ ] Admin can assign incidents to volunteers
- [ ] Volunteers receive notifications
- [ ] Reports export correctly (CSV & PDF)
- [ ] PWA installable on mobile devices
- [ ] Offline mode queues reports
- [ ] All RLS policies active
- [ ] HTTPS enabled (for production)
- [ ] Environment variables configured
- [ ] SMS API credentials valid (if using)

---

## 📞 SUPPORT CONTACTS

### Technical Issues
- Developer: [your-email@example.com]
- Supabase Support: https://supabase.com/support
- iProg SMS Support: https://iprogtech.com

### User Training
- Admin Guide: `ADMIN_USER_GUIDE.md`
- Volunteer Guide: `VOLUNTEER_USER_GUIDE.md`
- Resident Guide: `RESIDENT_USER_GUIDE.md`

---

## 🎓 TRAINING SCHEDULE

### Admin Training (2 hours)
1. Dashboard navigation
2. Incident management
3. Volunteer assignment
4. Report generation
5. System monitoring

### Volunteer Training (1 hour)
1. Account setup
2. Location tracking toggle
3. Accepting assignments
4. Updating incident status
5. Communication protocols

### Resident Training (30 minutes)
1. Account registration
2. Reporting incidents
3. Taking photos
4. Emergency calling
5. Tracking report status

---

## 📋 DAILY OPERATIONS

### Morning (Admin)
1. Check overnight incidents
2. Review volunteer availability
3. Assign pending incidents
4. Check system status indicator

### During Incidents
1. Monitor live map
2. Coordinate volunteers
3. Update incident statuses
4. Communicate with barangay officials

### End of Day
1. Generate daily report
2. Follow up on unresolved incidents
3. Review volunteer performance
4. Plan next day assignments

---

## 🔐 SECURITY BEST PRACTICES

1. **Never share** admin credentials
2. **Rotate** API keys monthly
3. **Review** RLS policies quarterly
4. **Monitor** access logs weekly
5. **Backup** database daily (Supabase auto-backup enabled)
6. **Update** dependencies monthly (`pnpm update`)
7. **Test** in staging before production

---

## 📈 MONITORING DASHBOARD

Key metrics to track:

1. **Response Time:** Average time from report to resolution
2. **Volunteer Availability:** % of volunteers available
3. **Incident Volume:** Reports per day/week/month
4. **User Engagement:** Active users per day
5. **System Health:** Uptime, error rate, API latency

Use Supabase dashboard or integrate with:
- Vercel Analytics
- Sentry (error tracking)
- Google Analytics

---

## 🚀 DEPLOYMENT TO VERCEL

### One-Click Deploy

1. Push code to GitHub
2. Go to vercel.com
3. Click "Import Project"
4. Select your repository
5. Configure environment variables
6. Click "Deploy"
7. Done! 🎉

### Custom Domain Setup

1. In Vercel project settings
2. Go to Domains
3. Add your domain (e.g., rvois.talisay.gov.ph)
4. Follow DNS configuration steps
5. Wait for SSL certificate (automatic)

---

## ✅ GO-LIVE CHECKLIST

Final checks before launch:

- [ ] All environment variables set in Vercel
- [ ] Database migrations run successfully
- [ ] Test accounts created for demo
- [ ] Admin accounts created for staff
- [ ] SMS API balance sufficient
- [ ] Custom domain configured
- [ ] SSL certificate active
- [ ] All features tested in production
- [ ] User guides distributed
- [ ] Staff trained
- [ ] Backup procedures documented
- [ ] Monitoring alerts configured
- [ ] Launch announcement prepared

---

**System is ready to serve Talisay City! 🏆**

For detailed documentation, see:
- `CODE_REVIEW_AND_FIXES_OCT24.md` - Complete system audit
- `IMPLEMENTATION_FIXES_COMPLETE_OCT24.md` - All implemented fixes
- Individual feature documentation in `/docs` folder

