# 🔒 RVOIS SMS Fallback System - Environment Configuration

## Required Environment Variables

Add the following environment variables to your `.env.local` file:

```bash
# SMS Service Configuration
SMS_ENABLED=true
SMS_API_URL=https://sms.iprogtech.com/
SMS_API_KEY=your_iprogtech_api_key_here
SMS_SENDER=iprogsms

# SMS Rate Limiting
SMS_RATE_LIMIT_MINUTE=10
SMS_RATE_LIMIT_HOUR=100

# SMS Retry Configuration
SMS_RETRY_ATTEMPTS=1
SMS_RETRY_DELAY_MS=5000

# Base URL for API calls
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

## iProgTech SMS API Setup

### 1. Account Registration
- Visit [iProgTech SMS](https://sms.iprogtech.com/)
- Register for an account
- Verify your account and phone number

### 2. API Key Generation
- Log into your iProgTech dashboard
- Navigate to API settings
- Generate a new API key
- Copy the API key to your environment variables

### 3. Sender ID Configuration
- Set your sender ID to `iprogsms` (or customize as needed)
- Ensure the sender ID is approved for your account

## SMS Templates Configuration

The system includes default templates that can be customized:

### Default Templates

1. **Incident Confirmation** (`TEMPLATE_INCIDENT_CONFIRM`)
   ```
   [RVOIS CONFIRM] Report #{{ref}} received | {{barangay}} | {{time}} | Thank you for reporting.
   ```

2. **Incident Assignment** (`TEMPLATE_INCIDENT_ASSIGN`)
   ```
   [RVOIS ALERT] Incident #{{ref}} | {{type}} | {{barangay}} | {{time}} | Confirm response via app.
   ```

3. **Admin Critical Alert** (`TEMPLATE_ADMIN_CRITICAL`)
   ```
   [RVOIS CRITICAL] {{type}} reported | {{barangay}} | {{time}} | Verify in system.
   ```

4. **Barangay Alert** (`TEMPLATE_BARANGAY_ALERT`)
   ```
   [RVOIS BARANGAY] {{type}} in {{barangay}} | {{time}} | Check system for details.
   ```

5. **Volunteer Fallback** (`TEMPLATE_VOLUNTEER_FALLBACK`)
   ```
   [RVOIS FALLBACK] Incident #{{ref}} | {{type}} | {{barangay}} | {{time}} | Push notification failed, responding via SMS.
   ```

### Template Variables

Available variables for all templates:
- `{{ref}}` - Short reference ID (e.g., AB123)
- `{{type}}` - Incident type (e.g., FIRE, FLOOD)
- `{{barangay}}` - Barangay name
- `{{time}}` - Formatted time (e.g., 10:45AM)

## Database Migration

Run the SMS database migration:

```bash
# Apply the migration
supabase db push

# Or if using SQL directly
psql -d your_database -f supabase/migrations/20250123_sms_fallback_system.sql
```

## Testing SMS Functionality

### 1. Test SMS Sending
```bash
# Test SMS API endpoint
curl -X POST http://localhost:3000/api/sms \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+639123456789",
    "templateCode": "TEMPLATE_INCIDENT_CONFIRM",
    "variables": {
      "ref": "AB123",
      "barangay": "Matab-ang",
      "time": "10:45AM"
    },
    "context": {
      "incidentId": "test-incident-id",
      "referenceId": "AB123",
      "triggerSource": "Test",
      "recipientUserId": "test-user-id"
    }
  }'
```

### 2. Test Template Management
```bash
# Get all templates
curl http://localhost:3000/api/sms/templates

# Create new template
curl -X POST http://localhost:3000/api/sms/templates \
  -H "Content-Type: application/json" \
  -d '{
    "code": "TEMPLATE_TEST",
    "name": "Test Template",
    "content": "Test message with {{variable}}",
    "variables": ["variable"],
    "is_active": true
  }'
```

## Monitoring and Logs

### SMS Logs
- All SMS sends are logged in the `sms_logs` table
- View logs via admin dashboard at `/admin/sms`
- Export logs as CSV for analysis

### Fallback Monitoring
- Volunteer fallback events are logged in `volunteer_fallback_logs`
- Monitor active fallback timers in the admin dashboard
- Track SMS delivery success rates

## Rate Limiting

The system implements strict rate limiting:

- **Per minute**: 10 SMS per phone number
- **Per hour**: 100 SMS per phone number
- **Retry attempts**: 1 retry for failed sends
- **Retry delay**: 5 seconds between retries

## Privacy Compliance

### Data Protection
- Phone numbers are masked in logs (e.g., +63*******45)
- Only operational information is included in SMS
- No personal details or full addresses are sent

### Message Content
SMS messages only contain:
- Incident type
- Barangay name
- Time
- Short reference ID
- System identifier ([RVOIS])

## Troubleshooting

### Common Issues

1. **SMS not sending**
   - Check API key validity
   - Verify sender ID is approved
   - Check rate limits
   - Review error logs

2. **Templates not working**
   - Verify template variables match content
   - Check template is active
   - Validate template syntax

3. **Fallback not triggering**
   - Check volunteer phone number exists
   - Verify fallback monitoring is enabled
   - Review fallback logs

### Debug Mode

Enable verbose logging by setting:
```bash
NODE_ENV=development
SMS_DEBUG=true
```

## Production Deployment

### Security Checklist
- [ ] API keys stored securely in environment variables
- [ ] Rate limiting configured appropriately
- [ ] SMS templates reviewed and approved
- [ ] Privacy compliance verified
- [ ] Monitoring and alerting configured
- [ ] Backup notification channels tested

### Performance Optimization
- [ ] Database indexes created
- [ ] SMS logs cleanup scheduled
- [ ] Rate limit cleanup configured
- [ ] Fallback timer cleanup implemented

## Support

For technical support:
- Check SMS logs in admin dashboard
- Review fallback monitoring logs
- Verify API connectivity
- Test with iProgTech support if needed

---

**⚠️ Important**: SMS fallback is a critical safety system. Test thoroughly before production deployment and ensure all monitoring is in place.
