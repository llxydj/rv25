# Overdue Incidents Monitoring Setup

This document explains how to set up the 5-minute response policy enforcement for incidents in the RVOIS system.

## Overview

The system automatically monitors incidents to ensure they receive a response or update within 5 minutes of being reported or last updated. Overdue incidents are highlighted in the admin dashboard and generate alerts for administrators.

## Components

### 1. Database Functions
- `is_incident_overdue(incident_row)`: Function that determines if an incident is overdue
- `is_overdue` computed column: Added to the incidents table for easy querying
- `overdue_incidents` view: Pre-filtered view of all currently overdue incidents
- `check_overdue_incidents()`: Function to automatically check and send notifications

### 2. API Endpoints
- `/api/overdue-incidents`: Endpoint to manually check and send alerts for overdue incidents
- `/api/test-overdue`: Test endpoint to verify functionality

### 3. UI Components
- Admin incidents table highlights overdue incidents with a red border and "Overdue" badge

## Setup Instructions

### 1. Database Migration
The database functions are automatically created when you run the migrations:
```bash
npx supabase db push
```

### 2. Cron Job Setup
To automatically check for overdue incidents every 5 minutes, you need to set up a cron job.

#### Option A: Using Supabase Cron (if available)
```sql
SELECT cron.schedule('check-overdue-incidents', '*/5 * * * *', $$SELECT check_overdue_incidents();$$);
```

#### Option B: Using External Scheduler
Set up an external scheduler (like GitHub Actions, AWS Lambda, or a dedicated server) to call the API endpoint every 5 minutes:
```bash
curl -X POST https://your-domain.com/api/overdue-incidents
```

#### Option C: Manual Triggering
Administrators can manually trigger the check by calling:
```bash
curl https://your-domain.com/api/overdue-incidents
```

## How It Works

1. **Overdue Detection**:
   - Pending incidents that are more than 5 minutes old are considered overdue
   - Assigned/Responding incidents that haven't been updated in 5 minutes are considered overdue
   - Resolved/Cancelled incidents are never considered overdue

2. **Visual Highlighting**:
   - Overdue incidents appear with a red left border in the admin incidents table
   - An "Overdue" badge is displayed next to the incident type

3. **Alerts**:
   - When incidents become overdue, notifications are sent to all administrators
   - Assigned volunteers also receive notifications for their overdue incidents

## Testing

To test the functionality:
1. Create a test incident
2. Wait 5 minutes without updating it
3. Visit the admin incidents page - it should be highlighted as overdue
4. Call the test endpoint: `curl https://your-domain.com/api/test-overdue`

## Customization

You can adjust the time threshold by modifying the SQL functions in:
- `supabase/migrations/20251103000008_add_incident_response_time_check.sql`
- `supabase/migrations/20251103000009_add_overdue_incidents_cron_function.sql`