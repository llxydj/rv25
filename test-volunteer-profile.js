/**
 * Manual API Testing Script for Volunteer Profile Feature
 * Run with: node test-volunteer-profile.js
 * 
 * Prerequisites:
 * - Server running on localhost:3000
 * - Valid volunteer user token
 */

const API_BASE = 'http://localhost:3000'
let AUTH_TOKEN = '' // Replace with actual token after login

// Helper function to make API calls
async function apiCall(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`
  const headers = {
    'Content-Type': 'application/json',
    ...(AUTH_TOKEN ? { 'Authorization': `Bearer ${AUTH_TOKEN}` } : {}),
    ...options.headers
  }

  console.log(`\n📡 ${options.method || 'GET'} ${endpoint}`)
  
  try {
    const response = await fetch(url, { ...options, headers })
    const contentType = response.headers.get('content-type')
    const data = contentType?.includes('application/json') 
      ? await response.json() 
      : await response.text()

    console.log(`✅ Status: ${response.status}`)
    console.log(`📦 Response:`, JSON.stringify(data, null, 2).substring(0, 500))
    
    return { ok: response.ok, status: response.status, data }
  } catch (error) {
    console.error(`❌ Error:`, error.message)
    return { ok: false, error: error.message }
  }
}

// Test Suite
async function runTests() {
  console.log('🚀 Starting Volunteer Profile API Tests\n')
  console.log('=' .repeat(60))

  // Test 1: Get Activity Logs (without auth - should fail)
  console.log('\n\n📝 Test 1: Get Activity Logs (No Auth)')
  console.log('-'.repeat(60))
  const test1 = await apiCall('/api/volunteer-activity-logs')
  console.log(test1.ok ? '❌ FAIL: Should require auth' : '✅ PASS: Auth required')

  // Test 2: Profile Photo Upload (without auth - should fail)
  console.log('\n\n📝 Test 2: Upload Photo (No Auth)')
  console.log('-'.repeat(60))
  const test2 = await apiCall('/api/volunteer-profile-photo', { method: 'POST' })
  console.log(test2.ok ? '❌ FAIL: Should require auth' : '✅ PASS: Auth required')

  // Instructions for authenticated tests
  console.log('\n\n' + '='.repeat(60))
  console.log('🔐 AUTHENTICATED TESTS')
  console.log('='.repeat(60))
  console.log(`
To test authenticated endpoints:

1. Login to your app at http://localhost:3000
2. Open browser DevTools → Application → Local Storage
3. Find the Supabase auth token
4. Update AUTH_TOKEN variable in this script
5. Run: node test-volunteer-profile.js --auth

Or test manually in browser console:

// Get Activity Logs
fetch('/api/volunteer-activity-logs')
  .then(r => r.json())
  .then(console.log)

// Upload Photo (you'll need a file input)
const formData = new FormData()
formData.append('file', fileInput.files[0])
fetch('/api/volunteer-profile-photo', {
  method: 'POST',
  body: formData
}).then(r => r.json()).then(console.log)

// Create Activity Log
fetch('/api/volunteer-activity-logs', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    activity_type: 'other',
    title: 'Test Activity',
    description: 'Manual test from console'
  })
}).then(r => r.json()).then(console.log)
`)

  console.log('\n' + '='.repeat(60))
  console.log('✅ Basic API tests complete!')
  console.log('='.repeat(60))
}

// Run tests
runTests().catch(console.error)
