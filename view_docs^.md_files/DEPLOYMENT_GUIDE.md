# 🚀 Volunteer Profile Feature - Deployment Guide

## Quick Start (5 Minutes)

### Step 1: Apply Database Migrations

Run these commands in order:

```bash
# Navigate to your project directory
cd "c:/Users/ACER ES1 524/Documents/rv"

# Apply migrations (choose one method)

# Method A: Apply all pending migrations
npx supabase db push

# Method B: Apply individually
npx supabase migration up 20251025000000_add_volunteer_profile_fields
npx supabase migration up 20251025000001_volunteer_activity_logs
npx supabase migration up 20251025000002_volunteer_profile_photos
```

### Step 2: Verify Supabase Storage

1. Open Supabase Dashboard: https://supabase.com/dashboard
2. Navigate to **Storage** section
3. Verify `volunteer-profile-photos` bucket exists
4. Check that policies are active:
   - ✅ Public read access
   - ✅ Authenticated upload/delete

If bucket doesn't exist, it will be created automatically by the migration.

### Step 3: Test the Features

1. **Start your development server:**
   ```bash
   npm run dev
   ```

2. **Login as a volunteer user** and navigate to:
   ```
   http://localhost:3000/volunteer/profile
   ```

3. **Test each section:**
   - Upload a profile photo
   - Fill in personal information (including gender)
   - Add emergency contact details
   - Select skills and availability
   - Toggle assignment availability
   - Click "Save All Changes"
   - Switch to Documents tab and upload a file
   - Switch to Activity Log tab and verify entries

4. **Test export functionality:**
   - Click "Export PDF" button
   - Click "Export CSV" button
   - Verify downloaded files contain all data

---

## Verification Checklist

### Database
- [ ] `users` table has new columns (gender, emergency_contact_*, profile_photo_url)
- [ ] `volunteer_activity_logs` table exists
- [ ] Database triggers are active (check with `\df` in psql or Supabase SQL editor)
- [ ] RLS policies are enabled on new tables

### Storage
- [ ] `volunteer-profile-photos` bucket exists
- [ ] Bucket is set to public
- [ ] Upload policy allows authenticated users
- [ ] Delete policy allows owners/admins

### Frontend
- [ ] Profile page loads without errors
- [ ] All form fields are visible
- [ ] Tabs switch correctly (Profile, Documents, Activity)
- [ ] No console errors

### API Routes
- [ ] `/api/volunteer-profile-photo` - POST works
- [ ] `/api/volunteer-profile-photo` - DELETE works
- [ ] `/api/volunteer-activity-logs` - GET works
- [ ] `/api/volunteer-activity-logs` - POST works
- [ ] `/api/volunteer-documents` - All methods work

---

## Troubleshooting

### Issue: Migrations fail to apply

**Solution:**
```bash
# Check migration status
npx supabase migration list

# Reset if needed (CAUTION: Development only!)
npx supabase db reset

# Reapply migrations
npx supabase db push
```

### Issue: Storage bucket not found

**Solution:**
1. Go to Supabase Dashboard → Storage
2. Click "New Bucket"
3. Name: `volunteer-profile-photos`
4. Public: `true`
5. Apply the RLS policies from migration file manually

### Issue: Photo upload fails with 413 error

**Solution:**
- Check file size (must be < 5MB)
- Verify server upload limits in Next.js config

### Issue: TypeScript errors in volunteers.ts

**Note:** Pre-existing type issues from Supabase codegen. These don't affect runtime.

**Solution (optional):**
```bash
# Regenerate Supabase types
npx supabase gen types typescript --local > src/types/supabase.ts
```

### Issue: Activity logs not appearing

**Solution:**
1. Check database triggers are active:
   ```sql
   SELECT * FROM pg_trigger WHERE tgname LIKE 'log_volunteer%';
   ```
2. Manually test trigger:
   ```sql
   UPDATE volunteer_profiles SET skills = ARRAY['FIRST AID'] WHERE volunteer_user_id = 'your-user-id';
   ```
3. Check activity_logs table for new entry

---

## Production Deployment

### Pre-deployment Checklist

- [ ] All migrations tested in staging
- [ ] No TypeScript compilation errors (runtime issues)
- [ ] All environment variables set
- [ ] Supabase project configured
- [ ] Storage buckets created
- [ ] RLS policies active
- [ ] Rate limiting configured
- [ ] Error tracking setup (Sentry, etc.)

### Deploy Steps

1. **Commit all changes:**
   ```bash
   git add .
   git commit -m "feat: complete volunteer profile feature"
   git push origin main
   ```

2. **Deploy to production:**
   ```bash
   # For Vercel
   vercel --prod

   # For Netlify
   netlify deploy --prod

   # For custom deployment
   npm run build
   npm run start
   ```

3. **Apply production migrations:**
   ```bash
   # Connect to production database
   npx supabase link --project-ref your-production-ref
   
   # Push migrations
   npx supabase db push
   ```

4. **Verify production:**
   - Test profile page
   - Upload a photo
   - Upload a document
   - Check activity logs
   - Test export functions

---

## Environment Variables

Ensure these are set in your `.env.local` and production environment:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

---

## Performance Optimization (Optional)

### Image Optimization
Consider adding image processing:
- Resize images to max 500x500px
- Convert to WebP format
- Generate thumbnails

### Caching
- Cache user profiles in Redis/memory
- Enable CDN for storage bucket
- Implement SWR for data fetching

### Monitoring
- Set up error tracking
- Monitor API response times
- Track upload success rates
- Alert on failed uploads

---

## Support & Maintenance

### Regular Checks
- Monitor storage usage
- Review activity logs for anomalies
- Check failed upload logs
- Update file size limits as needed

### Backup Strategy
- Database: Automatic daily backups via Supabase
- Storage: Enable bucket versioning
- Export logs: Weekly CSV exports

---

## Success Metrics

Track these KPIs:
- Profile completion rate (% with all fields filled)
- Photo upload success rate
- Document upload success rate
- Activity log entries per user
- Export usage frequency

---

**Ready to deploy!** 🎉

For questions or issues, refer to:
- Supabase docs: https://supabase.com/docs
- Next.js docs: https://nextjs.org/docs
- Project README: ./README.md
