# ⚡ NOTIFICATION SYSTEM - QUICK START GUIDE

**For Developers:** How to use the new notification system

---

## 🎯 **TL;DR**

✅ **Automatic notifications** via database triggers  
✅ **Manual notifications** via NotificationService  
❌ **Never use** `user_id: null`  
❌ **Don't manually insert** into notifications table (unless using service)

---

## 📦 **WHAT'S AVAILABLE**

### **1. Database Triggers (Automatic)**

These fire automatically - **NO CODE NEEDED:**

| Trigger | Fires When | Notifies |
|---------|-----------|----------|
| `notify_admins_on_new_incident` | New incident inserted | All admins |
| `notify_barangay_on_new_incident` | New incident inserted | Barangay staff in area |
| `notify_volunteer_on_assignment` | Incident.assigned_to changes | Assigned volunteer |
| `notify_resident_on_status_change` | Incident.status changes | Incident reporter |
| `notify_admins_on_escalation` | Incident.severity decreases | All admins |

---

### **2. NotificationService (Manual)**

Use for complex scenarios requiring business logic:

```typescript
import { notificationService } from '@/lib/notification-service'
```

**Available Methods:**

```typescript
// Notify all admins
await notificationService.notifyAdmins({
  title: '⚠️ Alert',
  body: 'Something happened',
  type: 'alert',
  data: { url: '/admin/page' }
})

// Notify barangay staff
await notificationService.notifyBarangayStaff('ZONE 1', {
  title: '📍 Local Alert',
  body: 'Event in your barangay',
  type: 'local_alert',
  data: { url: '/barangay/events' }
})

// Notify specific volunteer
await notificationService.notifyVolunteer(volunteerId, {
  title: '📋 Task Assigned',
  body: 'You have a new task',
  type: 'task_alert',
  data: { task_id: 'abc', url: '/volunteer/tasks/abc' }
})

// Notify specific resident
await notificationService.notifyResident(residentId, {
  title: '✅ Update',
  body: 'Your request was processed',
  type: 'status_update',
  data: { request_id: 'xyz' }
})

// Notify all volunteers (e.g., training announcement)
await notificationService.notifyAllVolunteers({
  title: '📚 Training Scheduled',
  body: 'First Aid training on Monday',
  type: 'training_alert',
  data: { training_id: '123', url: '/volunteer/trainings/123' }
})

// Notify all users (system-wide broadcast)
await notificationService.notifyAllUsers({
  title: '🔔 System Announcement',
  body: 'Scheduled maintenance tonight',
  type: 'system_alert',
  data: { url: '/announcements' }
})
```

---

## 🚀 **COMMON USE CASES**

### **Use Case 1: Creating an Incident**

**NO CODE NEEDED** - Triggers handle it automatically!

```typescript
// Just insert the incident
const { data: incident } = await supabase
  .from('incidents')
  .insert({
    reporter_id: userId,
    incident_type: 'FIRE',
    barangay: 'ZONE 1',
    // ... other fields
  })
  .select()
  .single()

// ✅ Admins automatically notified (trigger)
// ✅ Barangay staff automatically notified (trigger)
```

---

### **Use Case 2: Assigning a Volunteer**

**NO CODE NEEDED** - Trigger handles it!

```typescript
// Just update the incident
await supabase
  .from('incidents')
  .update({ 
    assigned_to: volunteerId,
    status: 'ASSIGNED'
  })
  .eq('id', incidentId)

// ✅ Volunteer automatically notified (trigger)
// ✅ Resident automatically notified of status change (trigger)
```

---

### **Use Case 3: Custom Announcement**

**USE SERVICE** - Not a standard database event:

```typescript
import { notificationService } from '@/lib/notification-service'

// Create announcement
const { data: announcement } = await supabase
  .from('announcements')
  .insert({ title, content })
  .select()
  .single()

// Manually notify all volunteers
await notificationService.notifyAllVolunteers({
  title: '📢 New Announcement',
  body: announcement.title,
  type: 'announcement',
  data: { 
    announcement_id: announcement.id,
    url: `/volunteer/announcements/${announcement.id}`
  }
})
```

---

### **Use Case 4: Custom Alert for Specific User**

**USE SERVICE:**

```typescript
import { notificationService } from '@/lib/notification-service'

// Notify specific user about something
await notificationService.notifyResident(userId, {
  title: '🎉 Achievement Unlocked',
  body: 'You completed 10 reports!',
  type: 'achievement',
  data: { achievement: 'reporter_10', url: '/resident/achievements' }
})
```

---

## ❌ **WHAT NOT TO DO**

### **DON'T: Manually Insert with user_id: null**

```typescript
// ❌ BROKEN - Nobody can see this!
await supabase.from('notifications').insert({
  user_id: null,  // RLS blocks this!
  title: 'Alert',
  body: 'Something happened'
})
```

**WHY IT'S BROKEN:**
- RLS policy requires `user_id = currentUserId`
- `null` doesn't match any user ID
- Notification is invisible to everyone

**DO THIS INSTEAD:**

```typescript
// ✅ Use NotificationService to broadcast
await notificationService.notifyAllUsers({
  title: 'Alert',
  body: 'Something happened',
  type: 'broadcast',
  data: {}
})
```

---

### **DON'T: Manually Insert for Standard Events**

```typescript
// ❌ BAD - Trigger already does this!
const { data: incident } = await supabase
  .from('incidents')
  .insert({ ... })

// Don't do this - trigger handles it:
await supabase.from('notifications').insert({
  user_id: adminId,
  title: 'New Incident',
  ...
})
```

**WHY:**
- Trigger already creates notifications
- You'll create duplicates
- Wastes database space

**DO THIS INSTEAD:**

```typescript
// ✅ Just create the incident - triggers handle notifications
await supabase.from('incidents').insert({ ... })
```

---

### **DON'T: Use Client Supabase for Notifications**

```typescript
// ❌ BAD - RLS will block you
const supabase = createClient(ANON_KEY)
await supabase.from('notifications').insert({
  user_id: someOtherUserId,  // RLS blocks this!
  ...
})
```

**WHY:**
- Client can only insert notifications for themselves
- RLS prevents creating notifications for other users

**DO THIS INSTEAD:**

```typescript
// ✅ Use NotificationService (uses service role)
import { notificationService } from '@/lib/notification-service'
await notificationService.notifyResident(someOtherUserId, { ... })
```

---

## 🔍 **HOW TO CHECK IF IT'S WORKING**

### **Development Console:**

```typescript
// Subscribe to notification changes
const channel = supabase
  .channel('test-notifications')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
    },
    (payload) => {
      console.log('🔔 New notification:', payload.new)
    }
  )
  .subscribe()

// Now create an incident and watch console
```

### **Database Query:**

```sql
-- Check recent notifications
SELECT 
  n.id,
  u.email,
  u.role,
  n.title,
  n.type,
  n.created_at
FROM notifications n
JOIN users u ON u.id = n.user_id
WHERE n.created_at > NOW() - INTERVAL '5 minutes'
ORDER BY n.created_at DESC;
```

---

## 🐛 **TROUBLESHOOTING**

### **"Notifications not appearing"**

**Check:**
1. Are triggers installed? `SELECT trigger_name FROM information_schema.triggers WHERE trigger_name LIKE 'trigger_notify%';`
2. Is user subscribed to realtime channel? Check browser console
3. Is RLS blocking? Try querying notifications table directly

---

### **"Duplicate notifications"**

**Cause:** Both trigger AND service are firing

**Fix:** Use ONLY trigger OR service, not both

**Check:**
```sql
SELECT 
  user_id, type, title, COUNT(*)
FROM notifications
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY user_id, type, title
HAVING COUNT(*) > 1;
```

---

### **"Performance is slow"**

**Check trigger execution time:**
```sql
EXPLAIN ANALYZE
INSERT INTO incidents (...) VALUES (...);
```

**Expected:** < 100ms  
**If > 200ms:** Check indexes on users table

---

## 📚 **FULL DOCUMENTATION**

For complete details, see:

- **[NOTIFICATION_SYSTEM_FINAL_IMPLEMENTATION.md](file://c:\Users\ACER%20ES1%20524\Documents\rv\NOTIFICATION_SYSTEM_FINAL_IMPLEMENTATION.md)** - Complete architecture
- **[NOTIFICATION_TESTING_GUIDE.md](file://c:\Users\ACER%20ES1%20524\Documents\rv\NOTIFICATION_TESTING_GUIDE.md)** - Testing procedures
- **[src/lib/notification-service.ts](file://c:\Users\ACER%20ES1%20524\Documents\rv\src\lib\notification-service.ts)** - Service source code

---

## ✅ **CHECKLIST FOR NEW FEATURES**

When adding a new feature that should notify users:

- [ ] Check if database trigger already covers it
- [ ] If not, decide: trigger (simple) or service (complex)?
- [ ] If trigger: Add new trigger to migration file
- [ ] If service: Call `notificationService.notifyX()` method
- [ ] Test in development
- [ ] Verify no duplicates created
- [ ] Update this guide if needed

---

**Last Updated:** 2025-10-25  
**Questions?** Check full documentation or ask the team
