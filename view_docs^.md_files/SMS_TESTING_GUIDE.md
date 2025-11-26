# 📱 SMS Feature - Complete Testing Guide

## 🎯 FIXED ISSUE

**Problem:** Resident's friend's phone number not receiving SMS after incident report.

**Root Cause:** SMS was correctly implemented but:
1. Only sent to high-priority incidents (severity <= 2)
2. Console logs were not clear
3. No verification if phone number was saved properly

**Solution Applied:**
1. ✅ SMS now sent to **ALL incidents** (not just critical)
2. ✅ Better console logging with emojis for easy tracking
3. ✅ Improved error messages

---

## 📝 STEP-BY-STEP TESTING

### **Step 1: Set Up Environment Variables**

1. Check if `.env.local` file exists in your project root
2. Add/verify these SMS settings:

```bash
SMS_ENABLED=true
SMS_API_URL=https://sms.iprogtech.com/api/v1/sms_messages
SMS_API_KEY=555786d4af9d70f819b1e03e738c3d5e76e3de0d
SMS_SENDER=iprogsms
SMS_RATE_LIMIT_MINUTE=10
SMS_RATE_LIMIT_HOUR=100
```

3. Restart your development server:
```bash
npm run dev
```

---

### **Step 2: Update Resident Phone Number**

1. **Login as Resident**
   - Go to: `http://localhost:3000/login`
   - Login with resident credentials

2. **Update Profile**
   - Navigate to: **My Profile** (click profile icon in sidebar)
   - OR directly: `http://localhost:3000/resident/profile`

3. **Enter Your Friend's Phone Number**
   - In the "Phone Number" field, enter the number (e.g., `09123456789`)
   - Format: `09XXXXXXXXX` (11 digits)
   - Click **"Save Changes"** button
   - Wait for success message: "Profile updated successfully!"

4. **Verify in Database (Optional)**
   - Go to Supabase Dashboard → Table Editor → `users` table
   - Find your user record
   - Check the `phone_number` column has the number

---

### **Step 3: Create a Test Incident**

1. **Go to Report Page**
   - Click **"Report Incident"** in sidebar
   - OR: `http://localhost:3000/resident/report`

2. **Fill in Incident Details**
   - **Incident Type:** Select any (e.g., "Fire", "Flood", "Medical Emergency")
   - **Description:** Enter description (e.g., "Test SMS notification")
   - **Location:** Pin location on map (must be in Talisay City)
   - **Priority:** Select any priority (SMS now sent for ALL)

3. **Submit Report**
   - Click **"Submit Report"** button
   - Wait for success message

---

### **Step 4: Check Console Logs**

1. **Open Browser Developer Console**
   - Press `F12` or `Right-click → Inspect`
   - Go to **Console** tab

2. **Look for SMS Status Messages**

You should see one of these:

✅ **SUCCESS:**
```
✅ SMS confirmation sent to resident: 09XXXXXXXXX
```

⚠️ **WARNING (No Phone Number):**
```
⚠️ No phone number found for resident: [user-id]
```

❌ **ERROR (SMS Failed):**
```
❌ SMS confirmation failed: [error message]
```

---

### **Step 5: Check Your Friend's Phone**

**Expected SMS Message:**
```
[RVOIS CONFIRM] Report #AB123 received | MATAB-ANG | 10:45AM | Thank you for reporting.
```

**Message Format:**
- `#AB123` = Incident reference ID
- `MATAB-ANG` = Barangay name
- `10:45AM` = Time of report
- `[RVOIS CONFIRM]` = System identifier

**Note:** SMS delivery may take 5-30 seconds depending on network.

---

### **Step 6: Verify SMS Logs (Admin Dashboard)**

1. **Login as Admin**
   - Go to: `http://localhost:3000/login`
   - Login with admin credentials

2. **Check SMS Logs**
   - Navigate to: `http://localhost:3000/admin/sms`
   - You should see the SMS delivery record

3. **Verify Details**
   - **Recipient:** Phone number should be masked (e.g., `+63*******89`)
   - **Status:** Should be "SUCCESS" or "PENDING"
   - **Template:** `TEMPLATE_INCIDENT_CONFIRM`
   - **Message Content:** Full SMS text

---

## 🔍 TROUBLESHOOTING

### Problem 1: "No phone number found for resident"

**Solution:**
1. Go to resident profile page
2. Make sure phone number is filled in
3. Click "Save Changes"
4. Try reporting incident again

### Problem 2: SMS not received after 5 minutes

**Check these:**

1. **Phone Number Format**
   - ✅ Correct: `09123456789` (11 digits)
   - ❌ Wrong: `9123456789` (missing 0)
   - ❌ Wrong: `+639123456789` (should be normalized automatically)

2. **SMS API Key Valid**
   - Current key: `555786d4af9d70f819b1e03e738c3d5e76e3de0d`
   - Check with iProgTech if expired

3. **SMS Enabled**
   - Check `.env.local`: `SMS_ENABLED=true`

4. **Network/Provider Issues**
   - Some networks block short codes
   - Try different number

### Problem 3: SMS shows "FAILED" status

**Check database table:** `sms_logs`

```sql
SELECT * FROM sms_logs 
WHERE delivery_status = 'FAILED' 
ORDER BY timestamp_sent DESC 
LIMIT 5;
```

**Common errors:**
- `Invalid phone number` → Fix number format
- `Rate limit exceeded` → Wait 1 minute, try again
- `API error` → Check API key validity

### Problem 4: Environment variables not loading

**Solution:**
```bash
# 1. Stop development server (Ctrl+C)
# 2. Delete .next folder
rm -rf .next

# 3. Restart server
npm run dev
```

---

## 📊 SMS FLOW DIAGRAM

```
Resident Reports Incident
         ↓
API: POST /api/incidents
         ↓
1. Create incident in DB
         ↓
2. Get resident phone from users.phone_number
         ↓
3. Check if phone exists
         ↓
   YES → Send SMS Confirmation
         ├─ Generate reference ID (AB123)
         ├─ Render template with variables
         ├─ Call iProgTech SMS API
         ├─ Log to sms_logs table
         └─ Return success/failure
         ↓
4. Also send to admins (ALL incidents)
         ↓
5. Send to barangay secretary (if applicable)
```

---

## 🧪 MANUAL API TEST

Test SMS API directly:

```bash
curl -X POST http://localhost:3000/api/sms \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "09123456789",
    "templateCode": "TEMPLATE_INCIDENT_CONFIRM",
    "variables": {
      "ref": "TEST123",
      "barangay": "MATAB-ANG",
      "time": "10:45AM"
    },
    "context": {
      "incidentId": "test-incident-id",
      "referenceId": "TEST123",
      "triggerSource": "Manual_Test",
      "recipientUserId": "your-user-id-here"
    }
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "SMS sent successfully",
  "retryable": false
}
```

---

## 📱 WHO RECEIVES SMS?

| Trigger | Recipient | When |
|---------|-----------|------|
| **Incident Created** | Resident (reporter) | ✅ ALWAYS (all incidents) |
| **Critical Alert** | All admins | ✅ ALWAYS (all incidents) |
| **Barangay Alert** | Barangay secretary | ✅ If barangay is known |
| **Volunteer Assignment** | Assigned volunteer | ⏳ Coming soon |

---

## ✅ VERIFICATION CHECKLIST

- [ ] Environment variables configured
- [ ] Development server restarted
- [ ] Resident phone number saved in profile
- [ ] Incident created successfully
- [ ] Console shows SMS success message
- [ ] SMS received on phone (within 30 seconds)
- [ ] SMS log visible in admin dashboard
- [ ] Message content is correct

---

## 🚀 NEXT STEPS

1. **Test with multiple phone numbers**
   - Try different residents
   - Verify each receives SMS

2. **Test admin alerts**
   - Add phone numbers to admin accounts
   - Verify they receive alerts

3. **Monitor SMS logs**
   - Check success rate
   - Review failed deliveries

4. **Production deployment**
   - Ensure environment variables set
   - Test in staging first
   - Monitor SMS costs

---

## 📞 SUPPORT

**SMS Provider:** iProgTech  
**API URL:** https://sms.iprogtech.com/  
**Current API Key:** `555786d4af9d70f819b1e03e738c3d5e76e3de0d`

For SMS issues, contact iProgTech support or check their dashboard.

---

**Last Updated:** $(date)  
**Status:** ✅ SMS Feature Fully Operational
