# 🔧 **Supabase Password Reset Configuration Guide**

**Quick 10-Minute Setup**

---

## ✅ **Step-by-Step Configuration**

### **1. Add Redirect URLs (Required)**

1. Open **Supabase Dashboard**
2. Go to **Authentication** > **URL Configuration**
3. Find **"Redirect URLs"** section
4. Add these URLs (one per line):

**For Development:**
```
http://localhost:3000/reset-password
http://localhost:3000/auth/callback
```

**For Production:**
```
https://yourdomain.com/reset-password
https://yourdomain.com/auth/callback
```

4. Click **Save**

---

### **2. Verify Email Service (Auto-Enabled)**

1. Go to **Project Settings** > **Auth**
2. Scroll to **"Email Auth"**
3. Verify **"Enable email confirmations"** is ON
4. ✅ Default Supabase email service works automatically

---

### **3. Customize Email Template (Optional)**

1. Go to **Authentication** > **Email Templates**
2. Click **"Reset Password"** template
3. Replace with this:

```html
<h2>Reset Your Password</h2>

<p>Hi there,</p>

<p>You requested to reset your password for <strong>RVOIS</strong> (Rescue Volunteers Operations Information System).</p>

<p>Click the button below to create a new password:</p>

<p>
  <a href="{{ .ConfirmationURL }}" style="display: inline-block; padding: 12px 24px; background-color: #DC2626; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">
    Reset Password
  </a>
</p>

<p><strong>This link expires in 1 hour.</strong></p>

<p>If you didn't request this, you can safely ignore this email. Your password will not be changed.</p>

<p>If the button doesn't work, copy and paste this link into your browser:</p>
<p style="color: #6B7280; font-size: 12px;">{{ .ConfirmationURL }}</p>

<hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">

<p style="color: #6B7280; font-size: 12px;">
  Talisay City Disaster Risk Reduction and Management Office<br>
  Rescue Volunteers Operations Information System (RVOIS)
</p>
```

4. Click **Save**

---

### **4. Test the System**

#### **Test 1: Send Reset Email**
```bash
1. Go to http://localhost:3000/login
2. Click "Forgot your password?"
3. Enter your admin/volunteer email
4. Click "Send Reset Link"
5. ✅ Should show success message
```

#### **Test 2: Check Email**
```bash
1. Open email inbox
2. ✅ Should receive email within 1 minute
3. Check spam if not in inbox
4. Verify link is present
```

#### **Test 3: Reset Password**
```bash
1. Click the link in email
2. ✅ Should open /reset-password page
3. Enter new password (min 8 chars)
4. Confirm password
5. Click "Reset Password"
6. ✅ Should redirect to login
```

#### **Test 4: Login with New Password**
```bash
1. Go to /login
2. Enter email and NEW password
3. Click "Sign in"
4. ✅ Should successfully log in
```

---

## 🔍 **Verification Checklist**

After configuration, verify:

- [ ] Redirect URLs added to Supabase
- [ ] Email service is enabled
- [ ] Email template customized (optional)
- [ ] Tested with real email account
- [ ] Reset email received
- [ ] Reset link works
- [ ] Password successfully updated
- [ ] Can log in with new password

---

## 🎯 **Common Configuration Issues**

### **Issue: Redirect URL Not Allowed**

**Error Message:** "redirect_to is not allowed"

**Solution:**
```
1. Go to Authentication > URL Configuration
2. Add exact URL to Redirect URLs list
3. Include http:// or https://
4. Match exactly (no trailing slash differences)
5. Save and wait 1 minute for changes to propagate
```

---

### **Issue: Email Not Sending**

**Solutions:**
```
1. Check Supabase Auth Logs:
   - Go to Authentication > Logs
   - Look for password_recovery_request events
   
2. Verify email address is registered:
   - Go to Authentication > Users
   - Search for the email
   
3. Check spam folder

4. Verify Email Auth is enabled:
   - Project Settings > Auth
   - Enable email confirmations = ON
```

---

### **Issue: Token Invalid/Expired**

**Solutions:**
```
1. Tokens expire after 1 hour
2. Request a new reset link
3. Use the link immediately
4. Don't refresh the page after clicking link
```

---

## 🎨 **Email Template Variables**

Available variables in email templates:

| Variable | Description | Example |
|----------|-------------|---------|
| `{{ .ConfirmationURL }}` | Full reset link with token | `https://...com/reset-password?token=...` |
| `{{ .Token }}` | Just the token | `abc123def...` |
| `{{ .TokenHash }}` | Hashed token | `xyz789...` |
| `{{ .Email }}` | User's email | `admin@example.com` |
| `{{ .SiteURL }}` | Your site URL | `https://yourdomain.com` |

---

## 📧 **Email Template Best Practices**

### **DO:**
- ✅ Keep it simple and clear
- ✅ Include your branding
- ✅ Show expiration time
- ✅ Provide text link as fallback
- ✅ Explain what happens if they ignore it

### **DON'T:**
- ❌ Use too many images (may look like spam)
- ❌ Make button too small
- ❌ Forget to test on mobile
- ❌ Use confusing language
- ❌ Leave out expiration info

---

## 🚀 **Production Deployment Checklist**

Before going live:

- [ ] Replace `localhost` URLs with production domain
- [ ] Test on production environment
- [ ] Verify HTTPS is enabled
- [ ] Test from different email providers (Gmail, Outlook, Yahoo)
- [ ] Test on mobile devices
- [ ] Document process for your team
- [ ] Set up monitoring for auth events
- [ ] Train support staff on password reset process

---

## 📊 **Monitoring Password Resets**

### **View Reset Activity in Supabase:**

1. Go to **Authentication** > **Logs**
2. Filter by action type:
   - `password_recovery_request` - User requested reset
   - `password_recovery` - User completed reset
3. Monitor for unusual activity

### **SQL Query for Recent Resets:**
```sql
SELECT 
  created_at,
  action,
  actor_email,
  ip_address
FROM auth.audit_log_entries
WHERE action IN ('password_recovery_request', 'password_recovery')
ORDER BY created_at DESC
LIMIT 50;
```

---

## 🔐 **Security Settings (Already Configured)**

These are built into Supabase:

| Setting | Value | Description |
|---------|-------|-------------|
| **Token Expiry** | 1 hour | Reset links expire automatically |
| **One-time Use** | Enforced | Tokens can't be reused |
| **Rate Limiting** | Built-in | Prevents spam/abuse |
| **HTTPS** | Required | Secure transmission |
| **Password Min Length** | 8 chars | Enforced in your code |

---

## 💡 **Pro Tips**

### **Tip 1: Test with Multiple Emails**
Test with:
- Gmail (most common)
- Outlook/Hotmail
- Yahoo
- Your organization's domain

### **Tip 2: Mobile Testing**
- Verify emails look good on mobile
- Test reset flow on phone
- Check button sizes

### **Tip 3: Support Documentation**
Create a simple guide for your users:
```
"Forgot your password?
1. Click 'Forgot your password?' on login page
2. Enter your email address
3. Check your email inbox
4. Click the reset link
5. Enter your new password
6. Log in with your new password"
```

### **Tip 4: Monitor Failed Attempts**
Watch for:
- Multiple failed reset attempts
- Requests for non-existent emails
- Unusual IP addresses

---

## ⏱️ **Configuration Time**

| Task | Time |
|------|------|
| Add redirect URLs | 2 min |
| Customize email template | 5 min |
| Test full flow | 3 min |
| **Total** | **~10 min** |

---

## ✅ **You're Done!**

After completing this configuration:
- ✅ Password reset works for all user types
- ✅ Emails are sent automatically
- ✅ Security is handled by Supabase
- ✅ Your users can self-serve password resets

**No additional code or deployment needed!**

---

## 📞 **Need Help?**

If something doesn't work:

1. **Check the logs:**
   - Supabase Dashboard > Authentication > Logs
   
2. **Verify configuration:**
   - URL Configuration
   - Email Auth enabled
   
3. **Test systematically:**
   - Request reset
   - Check email
   - Click link
   - Reset password
   - Log in

4. **Common fixes:**
   - Clear browser cache
   - Try incognito/private mode
   - Check spam folder
   - Verify email is registered

---

**Next Steps:**
1. Complete this configuration
2. Test thoroughly
3. Document for your team
4. ✅ Go live!

---

**Configuration Guide By:** Cascade AI  
**Date:** October 26, 2025  
**Status:** Ready to Configure
