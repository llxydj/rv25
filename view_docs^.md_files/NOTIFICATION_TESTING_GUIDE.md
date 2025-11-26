# 🧪 NOTIFICATION SYSTEM - TESTING & VALIDATION GUIDE

**Purpose:** Ensure database triggers and centralized service work correctly without duplicates  
**Priority:** 🔴 HIGH - Must validate before production deployment

---

## 🎯 **TESTING OBJECTIVES**

1. ✅ Verify triggers fire correctly
2. ✅ Ensure no duplicate notifications
3. ✅ Validate role-based targeting
4. ✅ Confirm RLS policies work
5. ✅ Test real-time delivery
6. ✅ Verify service fallback logic

---

## 🔧 **TEST ENVIRONMENT SETUP**

### **Step 1: Apply Triggers to Dev Database**

```bash
# Option A: Using Supabase CLI
supabase db push

# Option B: Using Supabase Dashboard
# 1. Go to SQL Editor
# 2. Paste contents of: supabase/migrations/20250125000000_add_notification_triggers.sql
# 3. Click "Run"
```

### **Step 2: Verify Triggers Installed**

```sql
-- Check all notification triggers exist
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name LIKE 'trigger_notify%'
ORDER BY trigger_name;

-- Expected output (5 triggers):
-- trigger_notify_admins_on_escalation
-- trigger_notify_admins_on_new_incident
-- trigger_notify_barangay_on_new_incident
-- trigger_notify_resident_on_status_change
-- trigger_notify_volunteer_on_assignment
```

### **Step 3: Verify Functions Exist**

```sql
-- Check all notification functions
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name LIKE 'notify_%'
AND routine_schema = 'public';

-- Expected output (5 functions):
-- notify_admins_on_escalation
-- notify_admins_on_new_incident
-- notify_barangay_on_new_incident
-- notify_resident_on_status_change
-- notify_volunteer_on_assignment
```

---

## 🧪 **SCENARIO-BASED TESTS**

### **Test 1: New Incident Creation**

**Objective:** Verify triggers create notifications for admins and barangay staff

```sql
-- Step 1: Clear existing notifications (optional)
DELETE FROM notifications WHERE created_at > NOW() - INTERVAL '1 hour';

-- Step 2: Count admins and barangay staff
SELECT role, barangay, COUNT(*) as user_count
FROM users
WHERE role IN ('admin', 'barangay')
GROUP BY role, barangay;

-- Step 3: Create test incident
INSERT INTO incidents (
  reporter_id,
  incident_type,
  description,
  location_lat,
  location_lng,
  barangay,
  city,
  province,
  priority,
  severity
) VALUES (
  (SELECT id FROM users WHERE role = 'resident' LIMIT 1),
  'FIRE',
  'Test incident for notification testing',
  10.3157,
  123.1854,
  'ZONE 1',
  'TALISAY CITY',
  'NEGROS OCCIDENTAL',
  1,
  1
) RETURNING id;

-- Step 4: Verify notifications created
SELECT 
  n.id,
  n.user_id,
  u.role,
  u.barangay as user_barangay,
  n.title,
  n.body,
  n.type,
  n.created_at
FROM notifications n
JOIN users u ON u.id = n.user_id
WHERE n.created_at > NOW() - INTERVAL '1 minute'
ORDER BY n.created_at DESC;

-- Expected result:
-- - Notifications for ALL admin users (role = 'admin')
-- - Notifications for barangay staff in ZONE 1 (role = 'barangay', barangay = 'ZONE 1')
-- - Title: "🚨 New Incident Reported"
-- - Body: "FIRE in ZONE 1"
```

**✅ PASS CRITERIA:**
- [ ] Notification created for each admin user
- [ ] Notification created for barangay staff in ZONE 1
- [ ] NO duplicate notifications
- [ ] NO notifications with `user_id = null`

**❌ FAIL IF:**
- Duplicate notifications exist
- Notifications missing for any admin
- `user_id = null` exists
- Wrong barangay staff notified

---

### **Test 2: Volunteer Assignment**

**Objective:** Verify volunteer receives notification when assigned

```sql
-- Step 1: Get incident ID from previous test
-- (or create new incident)

-- Step 2: Assign volunteer
UPDATE incidents
SET 
  assigned_to = (SELECT id FROM users WHERE role = 'volunteer' LIMIT 1),
  assigned_at = NOW(),
  status = 'ASSIGNED'
WHERE id = '<INCIDENT_ID_FROM_TEST_1>';

-- Step 3: Verify notification created
SELECT 
  n.id,
  n.user_id,
  u.first_name,
  u.role,
  n.title,
  n.body,
  n.type,
  n.data
FROM notifications n
JOIN users u ON u.id = n.user_id
WHERE n.created_at > NOW() - INTERVAL '1 minute'
AND n.type = 'assignment_alert'
ORDER BY n.created_at DESC;

-- Expected result:
-- - ONE notification for assigned volunteer
-- - Title: "📋 New Incident Assignment"
-- - Type: "assignment_alert"
```

**✅ PASS CRITERIA:**
- [ ] Exactly ONE notification created
- [ ] Notification sent to correct volunteer
- [ ] Data includes incident_id and url

**❌ FAIL IF:**
- Duplicate notifications
- Notification sent to wrong user
- Missing incident_id in data

---

### **Test 3: Status Change (Resident Notification)**

**Objective:** Verify resident receives notification when status changes

```sql
-- Step 1: Change incident status
UPDATE incidents
SET status = 'RESPONDING'
WHERE id = '<INCIDENT_ID_FROM_TEST_1>';

-- Step 2: Verify resident notification
SELECT 
  n.id,
  n.user_id,
  u.role,
  n.title,
  n.body,
  n.data->>'status' as new_status
FROM notifications n
JOIN users u ON u.id = n.user_id
WHERE n.created_at > NOW() - INTERVAL '1 minute'
AND n.type = 'status_update'
ORDER BY n.created_at DESC;

-- Expected result:
-- - ONE notification for incident reporter
-- - Title: "📋 Incident Status Update"
-- - Body: "A volunteer is responding to your incident"
-- - Data contains new status
```

**✅ PASS CRITERIA:**
- [ ] Exactly ONE notification created
- [ ] Sent to incident reporter (resident)
- [ ] Correct status message
- [ ] Data includes new status

---

### **Test 4: Incident Escalation**

**Objective:** Verify admins notified when severity increases

```sql
-- Step 1: Escalate incident (decrease severity number = higher priority)
UPDATE incidents
SET severity = 1 -- CRITICAL
WHERE id = '<INCIDENT_ID_FROM_TEST_1>'
AND severity > 1;

-- Step 2: Verify admin notifications
SELECT 
  COUNT(*) as notification_count,
  COUNT(DISTINCT n.user_id) as unique_admins
FROM notifications n
JOIN users u ON u.id = n.user_id
WHERE n.created_at > NOW() - INTERVAL '1 minute'
AND n.type = 'escalation_alert'
AND u.role = 'admin';

-- Expected result:
-- - notification_count = number of admin users
-- - unique_admins = number of admin users
-- - notification_count should equal unique_admins (no duplicates)
```

**✅ PASS CRITERIA:**
- [ ] All admins notified
- [ ] No duplicate notifications
- [ ] Message includes severity level

---

## 🔍 **DUPLICATE DETECTION QUERIES**

### **Query 1: Check for Duplicate Notifications**

```sql
-- Find duplicate notifications (same user, type, incident within 1 minute)
SELECT 
  user_id,
  type,
  data->>'incident_id' as incident_id,
  title,
  COUNT(*) as duplicate_count,
  ARRAY_AGG(id) as notification_ids,
  ARRAY_AGG(created_at) as timestamps
FROM notifications
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY user_id, type, data->>'incident_id', title
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Expected result: ZERO rows
```

**✅ PASS:** No rows returned  
**❌ FAIL:** Any duplicates found (investigate why)

---

### **Query 2: Check for NULL user_id (Broken Broadcasts)**

```sql
-- Find notifications with NULL user_id (broken under RLS)
SELECT 
  id,
  title,
  body,
  type,
  created_at
FROM notifications
WHERE user_id IS NULL
AND created_at > NOW() - INTERVAL '24 hours';

-- Expected result: ZERO rows
```

**✅ PASS:** No rows returned  
**❌ FAIL:** Any NULL user_id found (critical bug)

---

## 🎭 **END-TO-END INTEGRATION TEST**

### **Complete Incident Lifecycle Test**

```javascript
// Test script (run via Node.js or browser console)
async function testIncidentLifecycle() {
  const supabase = createClient(/* your config */)
  
  console.log('🧪 Starting E2E notification test...')
  
  // Track notification counts before each step
  async function countNotifications() {
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 60000).toISOString())
    return count || 0
  }
  
  // Step 1: Create incident
  console.log('📝 Step 1: Creating incident...')
  const beforeCreate = await countNotifications()
  
  const { data: incident, error } = await supabase
    .from('incidents')
    .insert({
      reporter_id: '<RESIDENT_USER_ID>',
      incident_type: 'MEDICAL EMERGENCY',
      description: 'E2E Test Incident',
      location_lat: 10.3157,
      location_lng: 123.1854,
      barangay: 'ZONE 1',
      city: 'TALISAY CITY',
      province: 'NEGROS OCCIDENTAL',
      priority: 1,
      severity: 1
    })
    .select()
    .single()
  
  await new Promise(r => setTimeout(r, 2000)) // Wait for triggers
  const afterCreate = await countNotifications()
  console.log(`✅ Notifications created: ${afterCreate - beforeCreate}`)
  
  // Step 2: Assign volunteer
  console.log('👤 Step 2: Assigning volunteer...')
  const beforeAssign = await countNotifications()
  
  await supabase
    .from('incidents')
    .update({ 
      assigned_to: '<VOLUNTEER_USER_ID>',
      status: 'ASSIGNED'
    })
    .eq('id', incident.id)
  
  await new Promise(r => setTimeout(r, 2000))
  const afterAssign = await countNotifications()
  console.log(`✅ Notifications created: ${afterAssign - beforeAssign}`)
  
  // Step 3: Change status
  console.log('📋 Step 3: Updating status...')
  const beforeStatus = await countNotifications()
  
  await supabase
    .from('incidents')
    .update({ status: 'RESPONDING' })
    .eq('id', incident.id)
  
  await new Promise(r => setTimeout(r, 2000))
  const afterStatus = await countNotifications()
  console.log(`✅ Notifications created: ${afterStatus - beforeStatus}`)
  
  // Step 4: Check for duplicates
  console.log('🔍 Step 4: Checking for duplicates...')
  const { data: duplicates } = await supabase
    .rpc('check_duplicate_notifications', { 
      incident_id_param: incident.id 
    })
  
  if (duplicates && duplicates.length > 0) {
    console.error('❌ DUPLICATES FOUND:', duplicates)
  } else {
    console.log('✅ No duplicates found')
  }
  
  console.log('🎉 E2E test complete!')
}

// Run test
testIncidentLifecycle()
```

---

## 📊 **PERFORMANCE BENCHMARKS**

### **Query: Measure Trigger Execution Time**

```sql
-- Enable timing
\timing on

-- Test trigger performance
EXPLAIN ANALYZE
INSERT INTO incidents (
  reporter_id,
  incident_type,
  description,
  location_lat,
  location_lng,
  barangay,
  priority,
  severity
) VALUES (
  (SELECT id FROM users WHERE role = 'resident' LIMIT 1),
  'FIRE',
  'Performance test',
  10.3157,
  123.1854,
  'ZONE 1',
  1,
  1
);

-- Expected execution time: < 50ms
-- Acceptable: < 100ms
-- Investigate if > 200ms
```

**✅ PASS:** Execution time < 100ms  
**⚠️ REVIEW:** Execution time 100-200ms (optimize if needed)  
**❌ FAIL:** Execution time > 200ms (critical performance issue)

---

## 🚨 **ROLLBACK PROCEDURES**

### **If Triggers Cause Issues:**

```sql
-- Disable all triggers (temporary fix)
ALTER TABLE incidents DISABLE TRIGGER trigger_notify_admins_on_new_incident;
ALTER TABLE incidents DISABLE TRIGGER trigger_notify_barangay_on_new_incident;
ALTER TABLE incidents DISABLE TRIGGER trigger_notify_volunteer_on_assignment;
ALTER TABLE incidents DISABLE TRIGGER trigger_notify_resident_on_status_change;
ALTER TABLE incidents DISABLE TRIGGER trigger_notify_admins_on_escalation;

-- Re-enable after fix
ALTER TABLE incidents ENABLE TRIGGER trigger_notify_admins_on_new_incident;
-- ... repeat for all triggers
```

### **If Complete Removal Needed:**

```sql
-- Drop all notification triggers
DROP TRIGGER IF EXISTS trigger_notify_admins_on_new_incident ON incidents;
DROP TRIGGER IF EXISTS trigger_notify_barangay_on_new_incident ON incidents;
DROP TRIGGER IF EXISTS trigger_notify_volunteer_on_assignment ON incidents;
DROP TRIGGER IF EXISTS trigger_notify_resident_on_status_change ON incidents;
DROP TRIGGER IF EXISTS trigger_notify_admins_on_escalation ON incidents;

-- Drop all notification functions
DROP FUNCTION IF EXISTS notify_admins_on_new_incident;
DROP FUNCTION IF EXISTS notify_barangay_on_new_incident;
DROP FUNCTION IF EXISTS notify_volunteer_on_assignment;
DROP FUNCTION IF EXISTS notify_resident_on_status_change;
DROP FUNCTION IF EXISTS notify_admins_on_escalation;
```

---

## ✅ **TESTING CHECKLIST**

### **Pre-Deployment:**
- [ ] All triggers installed successfully
- [ ] All functions created without errors
- [ ] Test 1: New incident notifications work
- [ ] Test 2: Volunteer assignment notifications work
- [ ] Test 3: Status change notifications work
- [ ] Test 4: Escalation notifications work
- [ ] No duplicate notifications found
- [ ] No NULL user_id notifications exist
- [ ] Performance benchmarks meet targets
- [ ] E2E integration test passes

### **Post-Deployment (Monitor for 7 days):**
- [ ] Monitor duplicate notification count
- [ ] Monitor NULL user_id count
- [ ] Track notification delivery rate
- [ ] Monitor trigger execution time
- [ ] Gather user feedback on notification timing
- [ ] Verify real-time delivery working

---

## 📞 **TROUBLESHOOTING**

### **Issue: Duplicates Found**

**Diagnosis:**
```sql
-- Find which trigger/service is creating duplicates
SELECT 
  type,
  title,
  COUNT(*),
  MIN(created_at) as first_created,
  MAX(created_at) as last_created,
  MAX(created_at) - MIN(created_at) as time_diff
FROM notifications
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY type, title
HAVING COUNT(*) > (SELECT COUNT(*) FROM users WHERE role = 'admin');
```

**Solutions:**
1. If time_diff < 100ms: Trigger firing twice (check trigger definition)
2. If time_diff > 1s: Both trigger AND service firing (disable one)
3. Add unique constraint to prevent duplicates

---

### **Issue: Missing Notifications**

**Diagnosis:**
```sql
-- Check if triggers are enabled
SELECT 
  tgname,
  tgenabled
FROM pg_trigger
WHERE tgname LIKE 'trigger_notify%';

-- tgenabled should be 'O' (enabled)
```

**Solutions:**
1. Re-enable triggers if disabled
2. Check function definitions
3. Verify user roles in database

---

### **Issue: Performance Degradation**

**Diagnosis:**
```sql
-- Check notification table size
SELECT 
  pg_size_pretty(pg_total_relation_size('notifications')) as table_size,
  COUNT(*) as row_count
FROM notifications;

-- If > 100k rows, consider cleanup
```

**Solutions:**
1. Archive old notifications (> 30 days)
2. Add database indexes
3. Implement notification cleanup job

---

## 🎯 **SUCCESS CRITERIA**

### **System is Production-Ready When:**
✅ All tests pass  
✅ Zero duplicates detected  
✅ Zero NULL user_id found  
✅ Performance < 100ms  
✅ E2E test completes successfully  
✅ 7-day monitoring shows stability  

---

**Testing Guide Version:** 1.0  
**Last Updated:** 2025-10-25  
**Status:** Ready for Validation
