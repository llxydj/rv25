# 📱 SMS Troubleshooting Guide

## 🎯 Current Issue

You're seeing this error:
```
❌ SMS confirmation failed: Unexpected token '<', "<!doctype "... is not valid JSON
❌ Critical alert SMS failed: [
  {
    userId: '7c572ede-99e3-489e-97f5-731555fcafb6',
    success: false,
    error: `Unexpected token '<', "<!doctype "... is not valid JSON`
  }
]
```

## 🔍 Root Cause Analysis

The error `Unexpected token '<', "<!doctype "... is not valid JSON` means the SMS API is returning an HTML error page instead of JSON. This typically happens when:

1. **Wrong API URL** - The endpoint doesn't exist
2. **Authentication failed** - Invalid API key
3. **Server error** - The SMS provider server is down
4. **Network issue** - Can't reach the server

## 🔧 Immediate Fixes

### 1. **Verify API Configuration**

Check your `.env.local` file:
```bash
SMS_ENABLED=true
SMS_API_URL=https://sms.iprogtech.com/api/v1/sms_messages
SMS_API_KEY=555786d4af9d70f819b1e03e738c3d5e76e3de0d
SMS_SENDER=iprogsms
```

### 2. **Test API Key Validity**

Run this test in your browser console or terminal:
```bash
curl -X POST https://sms.iprogtech.com/api/v1/sms_messages \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "555786d4af9d70f819b1e03e738c3d5e76e3de0d",
    "sender": "iprogsms",
    "number": "09123456789",
    "message": "Test message from RVOIS"
  }'
```

### 3. **Check API Endpoint**

Visit in browser: `https://sms.iprogtech.com/api/v1/sms_messages`

If you see an HTML error page, the endpoint might be incorrect.

## 🛠️ Code Improvements Applied

I've enhanced the SMS service with better error handling:

### **Enhanced Debugging**
- ✅ Detailed console logs with request/response info
- ✅ HTML error detection (when API returns error pages)
- ✅ Better error messages with context

### **Improved Error Handling**
- ✅ Timeout increased to 15 seconds
- ✅ Better JSON parsing with fallback error handling
- ✅ More descriptive error messages

## 🧪 Manual Testing

### **Test SMS Directly**

1. **Create a test file** `test-sms.ts`:
```typescript
import { smsService } from './src/lib/sms-service'

async function testSMS() {
  const result = await smsService.sendSMS(
    '09123456789', // Replace with your phone number
    'TEMPLATE_INCIDENT_CONFIRM',
    {
      ref: 'TEST123',
      barangay: 'MATAB-ANG',
      time: '10:45AM'
    },
    {
      incidentId: 'test-incident-id',
      referenceId: 'TEST123',
      triggerSource: 'Manual_Test',
      recipientUserId: 'test-user-id'
    }
  )
  
  console.log('SMS Result:', result)
}

testSMS()
```

2. **Run the test**:
```bash
npx ts-node test-sms.ts
```

## 🔍 Debug Information to Check

Look for these console messages in your terminal when you create an incident:

```
📱 SMS API Request: {
  url: 'https://sms.iprogtech.com/api/v1/sms_messages',
  payload: {
    api_key: '***REDACTED***',
    sender: 'iprogsms',
    number: '09123456789',
    message: '[RVOIS CONFIRM] Report #AB123 received | MATAB-ANG | 10:45AM | Thank you for reporting.'
  }
}

📱 SMS API Response: {
  status: 200,
  ok: true,
  data: { ... }
}

✅ SMS confirmation sent to resident: 09123456789
```

Or error messages:
```
❌ SMS API returned HTML error page: <!DOCTYPE html>...
❌ SMS API JSON parse error: Unexpected token < in JSON at position 0
❌ SMS API Error Response: Invalid API key
```

## 📋 Common Fixes

### **1. Wrong API Key**
- Generate a new API key from iProgTech dashboard
- Update `SMS_API_KEY` in `.env.local`

### **2. Incorrect API URL**
- Current working URL: `https://sms.iprogtech.com/api/v1/sms_messages`
- Check iProgTech documentation for correct endpoint

### **3. Network Issues**
- Ensure your server can reach `https://sms.iprogtech.com`
- Test with: `ping sms.iprogtech.com`

### **4. Phone Number Format**
- Ensure phone number is in correct format: `09123456789`
- No spaces, dashes, or special characters

## 📞 Contact iProgTech Support

If issues persist, contact iProgTech with:
1. Your API key (first 6 and last 4 digits only)
2. The exact error message
3. Timestamp of when you tried to send SMS
4. Phone number you're trying to send to

## 🧪 Emergency Testing

If SMS still doesn't work, you can manually trigger SMS via the API:

```bash
curl -X POST http://localhost:3000/api/sms \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "09123456789",
    "templateCode": "TEMPLATE_INCIDENT_CONFIRM",
    "variables": {
      "ref": "TEST123",
      "barangay": "MATAB-ANG",
      "time": "10:45AM"
    },
    "context": {
      "incidentId": "test-incident-id",
      "referenceId": "TEST123",
      "triggerSource": "Manual_Test",
      "recipientUserId": "your-user-id-here"
    }
  }'
```

## 📊 Check SMS Logs

Visit the admin SMS dashboard: `http://localhost:3000/admin/sms`

Look for:
- Failed SMS entries
- Error messages
- Timestamps matching your incident report

## 🚀 Next Steps

1. **Verify environment variables** are correctly set
2. **Test API key** with direct curl request
3. **Check SMS logs** in admin dashboard
4. **Contact iProgTech** if API key is valid but still failing
5. **Verify phone number** format in resident profile

## 📞 iProgTech API Documentation

For reference, the expected request format is:
```json
{
  "api_key": "your_api_key_here",
  "sender": "your_sender_id",
  "number": "09123456789",
  "message": "Your message here"
}
```

Expected successful response:
```json
{
  "status": "success",
  "message_id": "unique_message_id",
  "message": "Message sent successfully"
}
```

Expected error response:
```json
{
  "status": "error",
  "message": "Error description here"
}
```

If you're getting HTML instead of JSON, that's the core issue we need to fix.
