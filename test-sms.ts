import { createClient } from '@supabase/supabase-js'

// Simple test to verify SMS API endpoint
async function testSMSAPI() {
  const apiUrl = 'https://sms.iprogtech.com/api/v1/sms_messages'
  const apiKey = '555786d4af9d70f819b1e03e738c3d5e76e3de0d'
  
  console.log('Testing SMS API endpoint:', apiUrl)
  
  try {
    // Test if endpoint exists and returns JSON
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    })
    
    console.log('Response Status:', response.status)
    console.log('Content-Type:', response.headers.get('content-type'))
    
    const text = await response.text()
    console.log('Response (first 500 chars):', text.substring(0, 500))
    
    // Check if it's HTML
    if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
      console.log('❌ ERROR: API returned HTML instead of JSON')
      console.log('This means the endpoint is incorrect or there was a server error')
      return false
    }
    
    // Try to parse as JSON
    try {
      const json = JSON.parse(text)
      console.log('✅ API returned valid JSON:', JSON.stringify(json, null, 2))
      return true
    } catch (parseError: unknown) {
      console.log('❌ ERROR: API returned non-JSON response:', parseError instanceof Error ? parseError.message : String(parseError))
      return false
    }
  } catch (error: unknown) {
    console.log('❌ ERROR: Failed to reach API:', error instanceof Error ? error.message : String(error))
    return false
  }
}

// Test Supabase connection
async function testSupabase() {
  console.log('\nTesting Supabase connection...')
  
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
      process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key'
    )
    
    // Test a simple query
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .limit(1)
    
    if (error) {
      console.log('❌ Supabase error:', error.message)
      return false
    }
    
    console.log('✅ Supabase connection successful')
    return true
  } catch (error: unknown) {
    console.log('❌ Supabase connection failed:', error instanceof Error ? error.message : String(error))
    return false
  }
}

async function main() {
  console.log('=== SMS API Troubleshooting Test ===\n')
  
  const smsResult = await testSMSAPI()
  const supabaseResult = await testSupabase()
  
  console.log('\n=== Summary ===')
  console.log('SMS API Test:', smsResult ? '✅ PASS' : '❌ FAIL')
  console.log('Supabase Test:', supabaseResult ? '✅ PASS' : '❌ FAIL')
  
  if (!smsResult) {
    console.log('\n🔧 RECOMMENDATIONS:')
    console.log('1. Verify the SMS API URL is correct')
    console.log('2. Check if the API key is valid')
    console.log('3. Ensure your server can reach the SMS provider')
    console.log('4. Check the SMS_TROUBLESHOOTING.md file for detailed steps')
  }
}

main().catch(console.error)