# Notification System Test Plan

## Test Scenarios

### 1. User Preference Testing

#### Scenario 1.1: User with all notifications enabled
- **Setup**: Create user with all notification preferences enabled
- **Action**: Trigger incident creation
- **Expected**: User receives notification

#### Scenario 1.2: User with push notifications disabled
- **Setup**: Create user with push_enabled = false
- **Action**: Trigger incident creation
- **Expected**: User does NOT receive notification

#### Scenario 1.3: User with incident alerts disabled
- **Setup**: Create user with incident_alerts = false
- **Action**: Trigger incident creation
- **Expected**: User does NOT receive notification

#### Scenario 1.4: User with status updates disabled
- **Setup**: Create user with status_updates = false
- **Action**: Change incident status
- **Expected**: User does NOT receive notification

#### Scenario 1.5: User with escalation alerts disabled
- **Setup**: Create user with escalation_alerts = false
- **Action**: Escalate incident
- **Expected**: User does NOT receive notification

### 2. Role-Based Notification Testing

#### Scenario 2.1: Admin notifications
- **Setup**: Create admin user with all notifications enabled
- **Action**: Create new incident
- **Expected**: Admin receives notification

#### Scenario 2.2: Barangay notifications
- **Setup**: Create barangay user with all notifications enabled
- **Action**: Create incident in their barangay
- **Expected**: Barangay user receives notification

#### Scenario 2.3: Volunteer notifications
- **Setup**: Create volunteer user with all notifications enabled
- **Action**: Assign incident to volunteer
- **Expected**: Volunteer receives notification

#### Scenario 2.4: Resident notifications
- **Setup**: Create resident user with all notifications enabled
- **Action**: Change status of resident's incident
- **Expected**: Resident receives notification

### 3. Notification Delivery Testing

#### Scenario 3.1: Notification appears in bell icon
- **Setup**: Create user with all notifications enabled
- **Action**: Trigger notification
- **Expected**: Bell icon shows notification count

#### Scenario 3.2: Notification dropdown displays correctly
- **Setup**: Create user with all notifications enabled
- **Action**: Trigger multiple notifications
- **Expected**: All notifications appear in dropdown

#### Scenario 3.3: Mark notification as read
- **Setup**: Create user with notification
- **Action**: Click on notification
- **Expected**: Notification marked as read, count decreases

#### Scenario 3.4: Mark all notifications as read
- **Setup**: Create user with multiple notifications
- **Action**: Click "Mark all as read"
- **Expected**: All notifications marked as read, count becomes zero

### 4. Edge Cases

#### Scenario 4.1: User with no preferences record
- **Setup**: Create user without notification preferences record
- **Action**: Trigger notification
- **Expected**: User receives notification (default behavior)

#### Scenario 4.2: Database error when checking preferences
- **Setup**: Simulate database error when checking preferences
- **Action**: Trigger notification
- **Expected**: User receives notification (fail-safe behavior)

## Test Execution Steps

### Step 1: Set up test users
1. Create test users for each role (admin, barangay, volunteer, resident)
2. Set notification preferences for each user

### Step 2: Test database triggers
1. Create incidents and verify notifications are created based on preferences
2. Assign incidents to volunteers and verify notifications
3. Change incident statuses and verify notifications
4. Escalate incidents and verify notifications

### Step 3: Test notification service
1. Use NotificationService to send notifications to users with different preferences
2. Verify that notifications are only sent to users with appropriate preferences

### Step 4: Test UI components
1. Verify bell icon updates correctly
2. Verify notification dropdown displays correctly
3. Test mark as read functionality
4. Test mark all as read functionality

## Expected Results

All tests should pass, demonstrating that:
1. Notifications are only sent to users with appropriate preferences
2. UI components work correctly
3. Database triggers respect user preferences
4. Notification service respects user preferences
5. Edge cases are handled gracefully