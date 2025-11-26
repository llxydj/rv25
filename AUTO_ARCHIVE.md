# Automated Report Archiving

## Overview

The RVOIS system now includes an automated report archiving feature that helps maintain system performance and compliance by automatically archiving reports for years that are 2 or more years old.

## How It Works

### Automatic Archiving Logic
- By default, the system automatically identifies years that are 2 or more years old
- Reports from these years are marked as "archived" and become read-only
- Archived reports are still accessible but cannot be modified
- The archiving process is logged for audit purposes

### Manual Archiving
- Administrators can still manually archive specific years through the Admin Portal
- Manual archiving allows for more granular control when needed

## Configuration

### Environment Variables

The auto-archiving feature can be configured using the following environment variables:

| Variable | Description | Default Value |
|----------|-------------|---------------|
| `AUTO_ARCHIVE_ENABLED` | Enable/disable auto-archiving | `true` |
| `AUTO_ARCHIVE_YEARS_OLD` | Archive reports older than this many years | `2` |
| `CRON_AUTH_TOKEN` | Authentication token for internal cron jobs | Required |

### Manual Configuration
To manually specify which years to archive, you can call the API endpoint with a specific list:

```bash
curl -X POST "http://localhost:3000/api/admin/reports/auto-archive" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CRON_AUTH_TOKEN" \
  -d '{"yearsToArchive": [2022, 2023]}'
```

## Implementation Details

### API Endpoints

1. **Auto-Archive Reports** (POST)
   - Endpoint: `/api/admin/reports/auto-archive`
   - Authentication: Requires either admin authentication or valid cron auth token
   - Parameters: Optional `yearsToArchive` array

2. **Get Auto-Archive Configuration** (GET)
   - Endpoint: `/api/admin/reports/auto-archive`
   - Returns current configuration settings

### Automated Execution

The auto-archiving process can be executed in multiple ways:

1. **Manual Trigger**: Through the Admin Portal "Auto Archive Old Years" button
2. **API Call**: Direct POST request to the endpoint
3. **Scheduled Task**: Using the provided scripts

### Scripts

Two scripts are provided for automated execution:

1. **Node.js Script**: `scripts/auto-archive-reports.ts`
2. **Windows Batch File**: `scripts/auto-archive-reports.bat`

## Scheduling

### Linux/macOS (Cron)
Add the following line to your crontab to run daily at 2 AM:

```bash
0 2 * * * cd /path/to/rvois && node scripts/auto-archive-reports.ts >> logs/auto-archive.log 2>&1
```

### Windows (Task Scheduler)
1. Open Task Scheduler
2. Create a new task
3. Set trigger to daily at desired time
4. Set action to run `scripts/auto-archive-reports.bat`

## Benefits

1. **Performance**: Reduces database load by marking old reports as read-only
2. **Compliance**: Maintains audit trails while improving system performance
3. **Automation**: Reduces manual administrative overhead
4. **Flexibility**: Allows both automatic and manual archiving options

## Troubleshooting

### Common Issues

1. **Authentication Errors**: Ensure `CRON_AUTH_TOKEN` is properly configured
2. **Network Issues**: Verify the site URL is accessible
3. **Permission Errors**: Confirm the service account has proper permissions

### Logs

All auto-archiving activities are logged in the system logs table with the action `REPORTS_AUTO_ARCHIVED`.

## Security

- The auto-archive endpoint requires authentication
- Only administrators or systems with the cron auth token can trigger archiving
- All actions are logged for audit purposes
- Archived reports remain accessible but read-only