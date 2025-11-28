# 🔔 NOTIFICATION MIGRATION GUIDE

## **STATUS: ✅ MIGRATION SUCCESSFUL**

---

## **WHAT "SUCCESS. NO ROWS RETURNED" MEANS**

### **This is NORMAL and CORRECT!** ✅

**Explanation:**
- `CREATE FUNCTION` and `CREATE TRIGGER` are DDL (Data Definition Language) statements
- They create/modify database objects, not return data
- "No rows returned" means the functions and triggers were created successfully
- **This is the expected behavior - your migration worked!**

---

## **WHAT WAS CREATED**

### **Functions Created:**
1. ✅ `notify_admins_on_status_change()` - Notifies admins on status changes
2. ✅ `notify_volunteer_on_status_change()` - Notifies volunteers on status changes

### **Triggers Created:**
1. ✅ `trigger_notify_admins_on_status_change` - Fires on incident status change
2. ✅ `trigger_notify_volunteer_on_status_change` - Fires on incident status change

---

## **NEXT STEP: UPDATE MESSAGES FOR OTW & ARRIVED**

### **Why Update?**
The migration you ran works, but the messages don't mention:
- **OTW** (On The Way) - Currently says "responding" instead of "on the way"
- **ARRIVED** - Not explicitly handled (falls through to generic message)

### **Run This Update Migration:**

```sql
-- Run this in Supabase SQL Editor
-- This updates the functions to include OTW and ARRIVED status

-- Update admin notifications
CREATE OR REPLACE FUNCTION notify_admins_on_status_change()
RETURNS TRIGGER AS $$
DECLARE
  status_message TEXT;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    CASE NEW.status
      WHEN 'ASSIGNED' THEN
        status_message := 'Incident has been assigned to a volunteer';
      WHEN 'RESPONDING' THEN
        status_message := 'Volunteer is on the way (OTW) to the incident';
      WHEN 'ARRIVED' THEN
        status_message := 'Volunteer has arrived at the incident location';
      WHEN 'RESOLVED' THEN
        status_message := 'Incident has been resolved';
      WHEN 'CANCELLED' THEN
        status_message := 'Incident has been cancelled';
      ELSE
        status_message := 'Incident status changed to ' || NEW.status;
    END CASE;
    
    INSERT INTO notifications (user_id, title, body, type, data)
    SELECT 
      u.id,
      '📋 Incident Status Changed',
      NEW.incident_type || ' in ' || NEW.barangay || ': ' || status_message,
      'status_update',
      jsonb_build_object(
        'incident_id', NEW.id,
        'status', NEW.status,
        'url', '/admin/incidents/' || NEW.id
      )
    FROM users u
    LEFT JOIN notification_preferences np ON u.id = np.user_id
    WHERE u.role = 'admin'
      AND (np.push_enabled IS NULL OR np.push_enabled = TRUE)
      AND (np.incident_alerts IS NULL OR np.incident_alerts = TRUE);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update volunteer notifications
CREATE OR REPLACE FUNCTION notify_volunteer_on_status_change()
RETURNS TRIGGER AS $$
DECLARE
  status_message TEXT;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.assigned_to IS NOT NULL THEN
    CASE NEW.status
      WHEN 'ASSIGNED' THEN
        status_message := 'Your assigned incident is now assigned';
      WHEN 'RESPONDING' THEN
        status_message := 'You are on the way (OTW) to the incident';
      WHEN 'ARRIVED' THEN
        status_message := 'You have arrived at the incident location';
      WHEN 'RESOLVED' THEN
        status_message := 'Your assigned incident has been resolved';
      WHEN 'CANCELLED' THEN
        status_message := 'Your assigned incident has been cancelled';
      ELSE
        status_message := 'Your assigned incident status changed to ' || NEW.status;
    END CASE;
    
    IF EXISTS (
      SELECT 1 
      FROM notification_preferences np
      WHERE np.user_id = NEW.assigned_to
        AND (np.push_enabled IS NULL OR np.push_enabled = TRUE)
        AND (np.status_updates IS NULL OR np.status_updates = TRUE)
    ) THEN
      INSERT INTO notifications (user_id, title, body, type, data)
      VALUES (
        NEW.assigned_to,
        '📋 Incident Status Update',
        NEW.incident_type || ' in ' || NEW.barangay || ': ' || status_message,
        'status_update',
        jsonb_build_object(
          'incident_id', NEW.id,
          'status', NEW.status,
          'url', '/volunteer/incident/' || NEW.id
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update resident notifications (to match)
CREATE OR REPLACE FUNCTION notify_resident_on_status_change()
RETURNS TRIGGER AS $$
DECLARE
  status_message TEXT;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    CASE NEW.status
      WHEN 'ASSIGNED' THEN
        status_message := 'Your incident has been assigned to a volunteer';
      WHEN 'RESPONDING' THEN
        status_message := 'A volunteer is on the way (OTW) to your incident';
      WHEN 'ARRIVED' THEN
        status_message := 'A volunteer has arrived at your incident location';
      WHEN 'RESOLVED' THEN
        status_message := 'Your incident has been resolved';
      WHEN 'CANCELLED' THEN
        status_message := 'Your incident has been cancelled';
      ELSE
        status_message := 'Your incident status has been updated to ' || NEW.status;
    END CASE;
    
    IF EXISTS (
      SELECT 1 
      FROM notification_preferences np
      WHERE np.user_id = NEW.reporter_id
        AND (np.push_enabled IS NULL OR np.push_enabled = TRUE)
        AND (np.status_updates IS NULL OR np.status_updates = TRUE)
    ) THEN
      INSERT INTO notifications (user_id, title, body, type, data)
      VALUES (
        NEW.reporter_id,
        '📋 Incident Status Update',
        status_message,
        'status_update',
        jsonb_build_object(
          'incident_id', NEW.id, 
          'status', NEW.status,
          'url', '/resident/history?incident=' || NEW.id
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## **HOW TO VERIFY IT'S WORKING**

### **Test Steps:**

1. **Create a test incident** (as resident)
   - Should see notification in admin bell ✅
   - Should see notification in resident bell ✅

2. **Assign a volunteer** (as admin)
   - Should see notification in volunteer bell ✅
   - Should see notification in admin bell ✅

3. **Volunteer marks OTW** (changes to RESPONDING)
   - Should see notification in resident bell ✅
   - Should see notification in admin bell ✅
   - Should see notification in volunteer bell ✅
   - Message should say "on the way (OTW)" ✅

4. **Volunteer marks ARRIVED**
   - Should see notification in resident bell ✅
   - Should see notification in admin bell ✅
   - Should see notification in volunteer bell ✅
   - Message should mention "arrived" ✅

5. **Volunteer marks RESOLVED**
   - Should see notification in resident bell ✅
   - Should see notification in admin bell ✅
   - Should see notification in volunteer bell ✅

---

## **VERIFICATION QUERIES**

### **Check if triggers exist:**
```sql
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name LIKE '%status_change%'
ORDER BY trigger_name;
```

### **Check if functions exist:**
```sql
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_name LIKE '%status_change%'
ORDER BY routine_name;
```

### **Test notification creation:**
```sql
-- Manually test by updating an incident status
-- Then check notifications table
SELECT 
  id,
  user_id,
  title,
  body,
  type,
  created_at
FROM notifications
WHERE type = 'status_update'
ORDER BY created_at DESC
LIMIT 10;
```

---

## **TROUBLESHOOTING**

### **If notifications aren't appearing:**

1. **Check trigger is enabled:**
   ```sql
   SELECT * FROM pg_trigger WHERE tgname LIKE '%status_change%';
   ```

2. **Check notification preferences:**
   ```sql
   SELECT * FROM notification_preferences 
   WHERE user_id = 'YOUR_USER_ID';
   ```
   - If no row exists, preferences default to enabled
   - If `push_enabled = FALSE` or `incident_alerts = FALSE`, notifications won't be created

3. **Check user roles:**
   ```sql
   SELECT id, email, role FROM users WHERE id = 'YOUR_USER_ID';
   ```

4. **Manually test trigger:**
   ```sql
   -- Update an incident status and see if notification is created
   UPDATE incidents 
   SET status = 'RESPONDING' 
   WHERE id = 'SOME_INCIDENT_ID';
   
   -- Then check notifications
   SELECT * FROM notifications 
   WHERE incident_id = 'SOME_INCIDENT_ID' 
   ORDER BY created_at DESC;
   ```

---

## **SUMMARY**

✅ **Your migration ran successfully!**  
✅ **Functions and triggers are created**  
⚠️ **Run the update migration above to improve OTW/ARRIVED messages**  
✅ **Test the notification flow to verify everything works**

The "Success. No rows returned" message is **completely normal** for DDL statements. Your triggers are now active and will create notifications automatically!

