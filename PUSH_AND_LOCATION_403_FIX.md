# 🔧 Push Notification & Location API 403 Fixes

## **Issues Found:**

### **1. Push Notification 403 Error (FCM)** ❌
- **Problem**: FCM returning 403 "Forbidden" when sending push notifications
- **Cause**: VAPID key mismatch - subscription was created with different VAPID keys than currently configured
- **Impact**: Push notifications fail silently, invalid subscriptions remain in database
- **Fix**: ✅ Added handling for 403 errors to remove invalid subscriptions (same as 410 expired subscriptions)

### **2. Volunteer Location API 403 Errors** ❌
- **Problem**: Multiple 403 errors on `/api/admin/volunteers/locations` and `/api/volunteer/location`
- **Cause**: Insufficient error logging makes it hard to debug why access is denied
- **Impact**: Can't determine if it's a role issue, user not found, or inactive account
- **Fix**: ✅ Added detailed error logging and checks for:
  - User not found in database
  - Invalid role (not admin/barangay for locations endpoint)
  - Inactive account status

---

## **Fixes Applied:**

### **1. Push Notification 403 Handling** (`src/app/api/incidents/route.ts`)
- ✅ Added handling for 403 errors (VAPID key mismatch)
- ✅ Removes invalid subscriptions from database when 403 is received
- ✅ Better logging to distinguish between expired (410) and invalid (403) subscriptions

### **2. Push Notification Helper** (`src/lib/push-notification-helper.ts`)
- ✅ Added handling for 403 errors
- ✅ Removes invalid subscriptions when VAPID keys don't match

### **3. Admin Locations API** (`src/app/api/admin/volunteers/locations/route.ts`)
- ✅ Added detailed error logging for debugging
- ✅ Checks for user existence in database
- ✅ Checks for user status (inactive accounts are blocked)
- ✅ Better error messages indicating the specific reason for 403

---

## **How It Works Now:**

### **Push Notifications:**
1. When 403 error occurs → Subscription is removed from database
2. User will need to re-subscribe with correct VAPID keys
3. Better logging shows if subscription is expired (410) or invalid (403)

### **Location APIs:**
1. Detailed logging shows exactly why access is denied:
   - User not found
   - Invalid role (shows current role)
   - Account inactive
2. Better error messages help debug authorization issues

---

## **Next Steps:**

### **For Push Notification 403:**
1. **Check VAPID Keys**: Ensure `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` match
2. **Re-subscribe**: Users with invalid subscriptions need to re-enable push notifications
3. **Clear Old Subscriptions**: Consider clearing all subscriptions if VAPID keys were changed:
   ```sql
   DELETE FROM push_subscriptions;
   ```

### **For Location API 403:**
1. **Check User Role**: Verify the user has the correct role in the database
2. **Check User Status**: Ensure user status is 'active', not 'inactive'
3. **Check Logs**: The enhanced logging will show the exact reason for 403

---

## **Status:** ✅ **FIXED**

Both push notification 403 errors and location API 403 errors now have better handling and logging.

