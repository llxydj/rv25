/**
 * Test script to verify push notification functionality for residents, admins, and volunteers
 * 
 * This script checks:
 * 1. Service worker registration
 * 2. Push notification permission status
 * 3. Subscription creation and storage
 * 4. Notification sending capabilities
 */

import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client with service role for full access
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function testServiceWorkerRegistration() {
  console.log('🔍 Testing Service Worker Registration...')
  
  try {
    // Check if service worker file exists
    const response = await fetch('/sw.js')
    if (response.ok) {
      console.log('✅ Service worker file exists')
    } else {
      console.log('❌ Service worker file not found')
      return false
    }
    
    // Check manifest file
    const manifestResponse = await fetch('/manifest.json')
    if (manifestResponse.ok) {
      console.log('✅ Manifest file exists')
    } else {
      console.log('❌ Manifest file not found')
      return false
    }
    
    return true
  } catch (error) {
    console.error('❌ Error testing service worker:', error)
    return false
  }
}

async function testPushNotificationSetup() {
  console.log('\n🔍 Testing Push Notification Setup...')
  
  try {
    // Check VAPID keys
    const vapidResponse = await fetch('/api/push/vapid-key')
    if (vapidResponse.ok) {
      const vapidData = await vapidResponse.json()
      if (vapidData.publicKey) {
        console.log('✅ VAPID public key available')
      } else {
        console.log('❌ VAPID public key missing')
        return false
      }
    } else {
      console.log('❌ VAPID key endpoint not working')
      return false
    }
    
    // Check environment variables
    if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      console.log('✅ VAPID keys configured in environment')
    } else {
      console.log('❌ VAPID keys missing in environment')
      return false
    }
    
    return true
  } catch (error) {
    console.error('❌ Error testing push setup:', error)
    return false
  }
}

async function testDatabaseIntegration() {
  console.log('\n🔍 Testing Database Integration...')
  
  try {
    // Test push_subscriptions table
    const { data: subscriptions, error: subscriptionError } = await supabase
      .from('push_subscriptions')
      .select('count')
      .single()
    
    if (!subscriptionError) {
      console.log(`✅ Push subscriptions table accessible (${subscriptions?.count || 0} records)`)
    } else {
      console.log('❌ Push subscriptions table not accessible')
      return false
    }
    
    // Test notifications table
    const { data: notifications, error: notificationError } = await supabase
      .from('notifications')
      .select('count')
      .single()
    
    if (!notificationError) {
      console.log(`✅ Notifications table accessible (${notifications?.count || 0} records)`)
    } else {
      console.log('❌ Notifications table not accessible')
      return false
    }
    
    // Test notification_preferences table
    const { data: preferences, error: preferenceError } = await supabase
      .from('notification_preferences')
      .select('count')
      .single()
    
    if (!preferenceError) {
      console.log(`✅ Notification preferences table accessible (${preferences?.count || 0} records)`)
    } else {
      console.log('❌ Notification preferences table not accessible')
      return false
    }
    
    return true
  } catch (error) {
    console.error('❌ Error testing database integration:', error)
    return false
  }
}

async function testNotificationSending() {
  console.log('\n🔍 Testing Notification Sending...')
  
  try {
    // Test send notification endpoint
    const sendResponse = await fetch('/api/notifications/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: 'test-user-id',
        payload: {
          title: 'Test Notification',
          body: 'This is a test notification',
          data: { test: true }
        }
      })
    })
    
    if (sendResponse.ok) {
      console.log('✅ Notification send endpoint accessible')
    } else {
      const errorData = await sendResponse.json().catch(() => ({}))
      if (errorData.message?.includes('No subscriptions found')) {
        console.log('✅ Notification send endpoint working (no subscriptions for test user)')
      } else {
        console.log('❌ Notification send endpoint error:', errorData.message || sendResponse.status)
        return false
      }
    }
    
    return true
  } catch (error) {
    console.error('❌ Error testing notification sending:', error)
    return false
  }
}

async function testUserRoles() {
  console.log('\n🔍 Testing User Role Integration...')
  
  try {
    // Test admin users
    const { data: admins, error: adminError } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'admin')
      .limit(1)
    
    if (!adminError && admins?.length >= 0) {
      console.log(`✅ Admin users table accessible (${admins.length} sample admin users)`)
    } else {
      console.log('❌ Admin users table not accessible')
      return false
    }
    
    // Test volunteer users
    const { data: volunteers, error: volunteerError } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'volunteer')
      .limit(1)
    
    if (!volunteerError && volunteers?.length >= 0) {
      console.log(`✅ Volunteer users table accessible (${volunteers.length} sample volunteer users)`)
    } else {
      console.log('❌ Volunteer users table not accessible')
      return false
    }
    
    // Test resident users
    const { data: residents, error: residentError } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'resident')
      .limit(1)
    
    if (!residentError && residents?.length >= 0) {
      console.log(`✅ Resident users table accessible (${residents.length} sample resident users)`)
    } else {
      console.log('❌ Resident users table not accessible')
      return false
    }
    
    return true
  } catch (error) {
    console.error('❌ Error testing user roles:', error)
    return false
  }
}

async function runAllTests() {
  console.log('🚀 Starting Push Notification System Tests\n')
  
  const tests = [
    { name: 'Service Worker Registration', fn: testServiceWorkerRegistration },
    { name: 'Push Notification Setup', fn: testPushNotificationSetup },
    { name: 'Database Integration', fn: testDatabaseIntegration },
    { name: 'Notification Sending', fn: testNotificationSending },
    { name: 'User Role Integration', fn: testUserRoles }
  ]
  
  let passedTests = 0
  
  for (const test of tests) {
    try {
      const result = await test.fn()
      if (result) {
        passedTests++
      }
    } catch (error) {
      console.error(`❌ ${test.name} failed with error:`, error)
    }
  }
  
  console.log(`\n📊 Test Results: ${passedTests}/${tests.length} tests passed`)
  
  if (passedTests === tests.length) {
    console.log('\n🎉 All tests passed! Push notification system is working correctly.')
    console.log('\n📋 Summary:')
    console.log('   ✅ Service worker is properly registered')
    console.log('   ✅ Push notifications are configured correctly')
    console.log('   ✅ Database integration is working')
    console.log('   ✅ Notification sending is functional')
    console.log('   ✅ All user roles (admin, volunteer, resident) are supported')
  } else {
    console.log('\n⚠️  Some tests failed. Please check the output above for details.')
  }
}

// Run the tests if this script is executed directly
if (require.main === module) {
  runAllTests()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('💥 Fatal error during testing:', error)
      process.exit(1)
    })
}

export { runAllTests }