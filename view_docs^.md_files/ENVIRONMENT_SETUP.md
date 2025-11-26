# Environment Variables Setup for RVOIS

## Required Environment Variables

Add these to your `.env.local` file:

```bash
# VAPID Keys for Push Notifications
# Generate these using: npx web-push generate-vapid-keys
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public_key_here
VAPID_PRIVATE_KEY=your_vapid_private_key_here

# Supabase Configuration (if not already set)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Feature Flags
NEXT_PUBLIC_FEATURE_GEO_POLYGON_GUARD=true
NEXT_PUBLIC_FEATURE_TRAININGS_ENABLED=false
NEXT_PUBLIC_FEATURE_FEEDBACK_ENABLED=false
```

## How to Generate VAPID Keys

1. Install web-push globally:
   ```bash
   npm install -g web-push
   ```

2. Generate VAPID keys:
   ```bash
   npx web-push generate-vapid-keys
   ```

3. Copy the generated keys to your `.env.local` file

## Database Setup

1. Run the migrations in this order:
   ```sql
   -- 1. First, create the update_timestamp function
   -- Run: 20250120000000_create_update_timestamp_function.sql
   
   -- 2. Then, create the location tracking tables
   -- Run: 20250120000001_add_location_tracking_simple.sql
   
   -- 3. Finally, create the notification tables
   -- Run: 20250120000002_add_notifications_simple.sql
   ```

## Testing the Setup

1. **Test Push Notifications:**
   - Open the app in a browser
   - Grant notification permission when prompted
   - Check the browser console for any errors

2. **Test Location Tracking:**
   - Go to the incident reporting page
   - Enable location tracking
   - Check if your location appears on the map

3. **Test Database Integration:**
   - Check if the new tables were created
   - Verify RLS policies are working
   - Test the new functions

## Troubleshooting

### Common Issues:

1. **"VAPID keys not set" error:**
   - Make sure both VAPID keys are in your `.env.local` file
   - Restart your development server after adding the keys

2. **"Function update_timestamp() does not exist" error:**
   - Run the function creation migration first
   - Then run the table creation migrations

3. **"Permission denied" for location:**
   - Make sure to grant location permission in your browser
   - Check if HTTPS is enabled (required for geolocation)

4. **"Service worker not registered" error:**
   - Check if the service worker file is accessible
   - Verify the service worker registration in the browser

## Production Deployment

1. **Set environment variables in your hosting platform:**
   - Vercel: Add to Environment Variables in project settings
   - Netlify: Add to Site Settings > Environment Variables
   - Other platforms: Follow their environment variable setup

2. **Update VAPID keys for production:**
   - Generate new VAPID keys for production
   - Update the keys in your hosting platform

3. **Test in production:**
   - Verify push notifications work
   - Test location tracking
   - Check database connectivity

## Feature Flags Reference

- **NEXT_PUBLIC_FEATURE_GEO_POLYGON_GUARD**
  - Type: boolean
  - Default: `true`
  - Purpose: Enables polygon-based geofence validation in the client and API.

- **NEXT_PUBLIC_FEATURE_TRAININGS_ENABLED**
  - Type: boolean
  - Default: `false`
  - Purpose: Enables trainings and training evaluation UI and related endpoints.

- **NEXT_PUBLIC_FEATURE_FEEDBACK_ENABLED**
  - Type: boolean
  - Default: `false`
  - Purpose: Enables feedback/rating UI and endpoints on the resident side.
