# SMS Delivery Status Verification Fix

## 🔍 Issue Identified

**Problem**: SMS messages show as "completed" in the SMS provider dashboard, but residents are not receiving them.

**Root Cause**: 
- The iProgSMS API returns "SMS successfully queued for delivery" when the SMS is **queued**, not **delivered**
- Our system was treating "queued" as "delivered" (SUCCESS)
- No delivery status verification was being performed

**Phone Number**: `639707183560` ✅ (Correct format: 12 digits, starts with 639)

---

## ✅ Fixes Implemented

### 1. **Delivery Status Tracking** (`src/lib/sms-service.ts`)

**Changes**:
- Added `statusLink` to `SMSDeliveryResult` interface
- Store `message_status_link` from API response in SMS log
- Set initial `delivery_status` to `PENDING` instead of `SUCCESS` when queued
- Automatically check delivery status after 30 seconds

**Code**:
```typescript
// Store status link for delivery verification
const statusLink = responseData.message_status_link || null

// Set to PENDING if queued, will be verified later
delivery_status: result.success ? 'PENDING' : 'FAILED'

// Schedule async delivery status check (after 30 seconds)
if (result.success && result.statusLink) {
  setTimeout(async () => {
    await this.checkDeliveryStatus(smsLog.id, result.statusLink!)
  }, 30000)
}
```

### 2. **Delivery Status Check Method**

Added `checkDeliveryStatus()` method that:
- Fetches delivery status from the status link provided by iProgSMS
- Parses the response to determine actual delivery status
- Updates SMS log with actual status: `SUCCESS`, `FAILED`, or `PENDING`

**Status Mapping**:
- `delivered` / `completed` / `success` → `SUCCESS`
- `failed` / `error` / `rejected` → `FAILED`
- `pending` / `queued` → `PENDING`

### 3. **Manual Status Check API** (`/api/sms/check-status`)

Created new endpoint for admins to manually check delivery status:

```
GET /api/sms/check-status?phone=639707183560
```

**Response**:
```json
{
  "success": true,
  "phoneNumber": "6397****60",
  "results": [
    {
      "logId": "...",
      "incidentId": "...",
      "referenceId": "TC-99NH",
      "status": "SUCCESS",
      "timestamp": "2025-01-28T..."
    }
  ]
}
```

---

## 🔧 How to Verify Delivery Status

### Option 1: Check SMS Logs in Database

```sql
SELECT 
  id,
  reference_id,
  phone_masked,
  delivery_status,
  api_response->>'statusLink' as status_link,
  timestamp_sent,
  created_at
FROM sms_logs
WHERE phone_masked LIKE '%7183%'  -- Last 4 digits of phone
ORDER BY timestamp_sent DESC;
```

### Option 2: Use Admin API

```bash
# Check delivery status for phone number
curl -X GET "http://localhost:3000/api/sms/check-status?phone=639707183560" \
  -H "Cookie: your-session-cookie"
```

### Option 3: Check iProgSMS Dashboard

1. Log into iProgSMS dashboard
2. Go to "Message Status" or "Delivery Reports"
3. Search for message ID from the API response
4. Check actual delivery status

---

## 📊 Delivery Status Flow

```
1. SMS Sent → API Response: "queued for delivery"
   └─> Status: PENDING
   └─> Store status_link

2. After 30 seconds → Check delivery status
   └─> GET status_link
   └─> Parse response
   └─> Update status: SUCCESS / FAILED / PENDING

3. Manual Check (if needed)
   └─> GET /api/sms/check-status?phone=...
   └─> Re-check all recent SMS for that phone
```

---

## 🐛 Troubleshooting

### SMS shows "completed" in provider but not received

**Possible Causes**:
1. **Phone number blocked**: Carrier may have blocked the number
2. **Network issue**: Temporary carrier network problem
3. **Spam filter**: Phone's spam filter may have blocked it
4. **Wrong number**: Number may be incorrect or inactive
5. **Provider delay**: SMS provider may show "completed" but delivery is delayed

**Actions**:
1. Check actual delivery status using `/api/sms/check-status`
2. Verify phone number format: `639XXXXXXXXX` (12 digits)
3. Check SMS logs in database for error messages
4. Contact iProgSMS support with message ID for investigation

### Delivery status stuck on PENDING

**Possible Causes**:
1. Status link not available in API response
2. Status check failed (network error)
3. Provider hasn't updated status yet

**Actions**:
1. Wait a few minutes and check again
2. Manually check using the status link from `api_response` in database
3. Contact iProgSMS support if status doesn't update after 5 minutes

---

## 📝 Notes

- **Phone Number Format**: Must be `639XXXXXXXXX` (12 digits, starts with 639)
- **Status Check Timing**: Automatic check happens 30 seconds after sending
- **Manual Check**: Can be done anytime via `/api/sms/check-status` endpoint
- **Status Updates**: Delivery status is updated in real-time as provider reports

---

## ✅ Next Steps

1. **Test the fix**: Send a test SMS and verify delivery status updates correctly
2. **Monitor logs**: Check SMS logs to see delivery status changes
3. **Verify phone**: Ensure phone number `639707183560` is correct and active
4. **Contact provider**: If status shows "delivered" but SMS not received, contact iProgSMS support

---

*Last Updated: 2025-01-28*

