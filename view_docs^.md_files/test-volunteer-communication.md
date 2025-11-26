# Volunteer Communication Flow Test

## Test Overview
This test verifies that the volunteer communication system properly notifies admins and residents when volunteers update incident status.

## Test Scenarios

### 1. Volunteer Marks Incident as RESPONDING
**Expected Behavior:**
- ✅ Incident status updates to "RESPONDING"
- ✅ `responding_at` timestamp is set
- ✅ Resident (reporter) receives notification: "🚀 Volunteer Responding"
- ✅ All admins receive notification: "📋 Incident Status Update"
- ✅ Status change is logged in `incident_updates` table
- ✅ Notification attempt is logged in `notification_logs` table

### 2. Volunteer Marks Incident as RESOLVED
**Expected Behavior:**
- ✅ Incident status updates to "RESOLVED"
- ✅ `resolved_at` timestamp is set
- ✅ `resolution_notes` are saved
- ✅ Volunteer profile `total_incidents_resolved` count increases
- ✅ Volunteer becomes available again (`is_available: true`)
- ✅ Resident (reporter) receives notification: "✅ Incident Resolved"
- ✅ All admins receive notification: "✅ Incident Resolved"
- ✅ Status change is logged in `incident_updates` table
- ✅ Notification attempt is logged in `notification_logs` table

## Test Steps

### Step 1: Create Test Incident
1. Login as resident
2. Report a new incident
3. Verify incident is created with status "PENDING"

### Step 2: Assign to Volunteer
1. Login as admin
2. Assign incident to a volunteer
3. Verify incident status changes to "ASSIGNED"
4. Verify volunteer receives assignment notification

### Step 3: Test RESPONDING Status
1. Login as assigned volunteer
2. Navigate to incident details page
3. Click "Mark as Responding"
4. Verify:
   - Status updates to "RESPONDING"
   - Success message shows notification info
   - Resident receives notification
   - Admins receive notification

### Step 4: Test RESOLVED Status
1. Still logged in as volunteer
2. Add resolution notes
3. Click "Mark as Resolved"
4. Verify:
   - Status updates to "RESOLVED"
   - Resolution notes are saved
   - Success message shows notification info
   - Resident receives notification
   - Admins receive notification
   - Volunteer profile count increases

## Database Verification

### Check incident_updates table:
```sql
SELECT * FROM incident_updates 
WHERE incident_id = 'your-test-incident-id' 
ORDER BY created_at;
```

### Check notification_logs table:
```sql
SELECT * FROM notification_logs 
WHERE incident_id = 'your-test-incident-id' 
ORDER BY created_at;
```

### Check volunteer_profiles table:
```sql
SELECT total_incidents_resolved, is_available 
FROM volunteer_profiles 
WHERE volunteer_user_id = 'your-test-volunteer-id';
```

## Notification Content Verification

### Resident Notification (RESPONDING):
- Title: "🚀 Volunteer Responding"
- Body: "[Volunteer Name] is now responding to the incident"
- Data: Contains incident_id, status, volunteer_name, url

### Admin Notification (RESPONDING):
- Title: "📋 Incident Status Update"
- Body: "[Volunteer Name] is responding to incident #[ID]"
- Data: Contains incident_id, status, volunteer_name, url

### Resident Notification (RESOLVED):
- Title: "✅ Incident Resolved"
- Body: "Your incident has been resolved by [Volunteer Name]"
- Data: Contains incident_id, status, volunteer_name, url

### Admin Notification (RESOLVED):
- Title: "✅ Incident Resolved"
- Body: "Incident #[ID] has been resolved by [Volunteer Name]"
- Data: Contains incident_id, status, volunteer_name, url

## Error Handling Tests

### Test 1: Notification Service Failure
- Simulate notification service failure
- Verify incident status still updates successfully
- Verify error is logged but doesn't break the flow

### Test 2: Database Update Failure
- Simulate database update failure
- Verify graceful error handling
- Verify user sees appropriate error message

### Test 3: Missing Volunteer Information
- Test with volunteer that has missing name data
- Verify notifications still work with fallback "Volunteer" name

## Performance Tests

### Test 1: Multiple Status Updates
- Rapidly update status multiple times
- Verify no race conditions
- Verify all notifications are sent

### Test 2: Large Admin List
- Test with many admin users
- Verify all admins receive notifications
- Verify performance is acceptable

## Success Criteria

✅ **All test scenarios pass**
✅ **Notifications are delivered to correct recipients**
✅ **Database updates are consistent**
✅ **Error handling works gracefully**
✅ **Performance is acceptable**
✅ **User experience is smooth**

## Rollback Plan

If issues are found:
1. Revert `src/lib/incidents.ts` to previous version
2. Revert `src/app/volunteer/incident/[id]/page.tsx` to previous version
3. Test basic functionality still works
4. Investigate and fix issues
5. Re-deploy fixes

## Monitoring

After deployment, monitor:
- Notification delivery rates
- Database update success rates
- User feedback on communication
- Error logs for notification failures
