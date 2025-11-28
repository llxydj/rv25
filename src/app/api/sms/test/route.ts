import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

/**
 * SMS Test Endpoint - Tests SMS API connectivity
 * POST /api/sms/test
 * Body: { phoneNumber: "09XXXXXXXXX" }
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check
    const supabase = await getServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
    }
    
    // Check admin role
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    
    if (!userData || userData.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    // Convert phone to international format (639XXXXXXXXX) for iProgSMS API
    let testPhone = body.phoneNumber || '09123456789'
    if (testPhone.startsWith('09') && testPhone.length === 11) {
      testPhone = '63' + testPhone.substring(1)
    } else if (testPhone.startsWith('+63')) {
      testPhone = testPhone.substring(1)
    }
    
    // Get config (iProgSMS API)
    const config = {
      apiUrl: process.env.SMS_API_URL || 'https://www.iprogsms.com/api/v1/sms_messages',
      apiKey: process.env.SMS_API_KEY || '',
      sender: process.env.SMS_SENDER || 'iprogsms',
    }
    
    console.log('📱 [SMS Test] Config:', {
      apiUrl: config.apiUrl,
      hasApiKey: !!config.apiKey,
      apiKeyLength: config.apiKey.length,
      sender: config.sender
    })
    
    if (!config.apiKey) {
      return NextResponse.json({
        success: false,
        error: 'SMS_API_KEY not configured',
        config: {
          apiUrl: config.apiUrl,
          hasApiKey: false,
          sender: config.sender
        }
      })
    }

    const testMessage = '[RVOIS TEST] This is a test message. Please ignore.'
    
    // Try Method 1: Form-urlencoded (current method)
    console.log('📱 [SMS Test] Trying Method 1: form-urlencoded...')
    
    const formPayload = new URLSearchParams({
      api_token: config.apiKey,
      phone_number: testPhone,
      message: testMessage
    })
    
    let method1Result: any = null
    try {
      const response1 = await fetch(config.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formPayload.toString(),
      })
      
      const text1 = await response1.text()
      method1Result = {
        status: response1.status,
        statusText: response1.statusText,
        headers: Object.fromEntries(response1.headers.entries()),
        body: text1.substring(0, 500),
        isHtml: text1.trim().startsWith('<'),
        isJson: text1.trim().startsWith('{') || text1.trim().startsWith('[')
      }
      console.log('📱 [SMS Test] Method 1 result:', method1Result)
    } catch (e: any) {
      method1Result = { error: e.message }
    }
    
    // Try Method 2: JSON with Bearer token
    console.log('📱 [SMS Test] Trying Method 2: JSON with Bearer...')
    
    let method2Result: any = null
    try {
      const response2 = await fetch(config.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          api_token: config.apiKey,
          phone_number: testPhone,
          message: testMessage
        }),
      })
      
      const text2 = await response2.text()
      method2Result = {
        status: response2.status,
        statusText: response2.statusText,
        headers: Object.fromEntries(response2.headers.entries()),
        body: text2.substring(0, 500),
        isHtml: text2.trim().startsWith('<'),
        isJson: text2.trim().startsWith('{') || text2.trim().startsWith('[')
      }
      console.log('📱 [SMS Test] Method 2 result:', method2Result)
    } catch (e: any) {
      method2Result = { error: e.message }
    }
    
    // Try Method 3: JSON with api_token in body
    console.log('📱 [SMS Test] Trying Method 3: JSON with api_token in body...')
    
    let method3Result: any = null
    try {
      const response3 = await fetch(config.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_token: config.apiKey,
          phone_number: testPhone,
          message: testMessage
        }),
      })
      
      const text3 = await response3.text()
      method3Result = {
        status: response3.status,
        statusText: response3.statusText,
        headers: Object.fromEntries(response3.headers.entries()),
        body: text3.substring(0, 500),
        isHtml: text3.trim().startsWith('<'),
        isJson: text3.trim().startsWith('{') || text3.trim().startsWith('[')
      }
      console.log('📱 [SMS Test] Method 3 result:', method3Result)
    } catch (e: any) {
      method3Result = { error: e.message }
    }
    
    // Determine which method works
    const workingMethod = 
      (method1Result?.isJson && method1Result?.status === 200) ? 'Method 1: form-urlencoded' :
      (method2Result?.isJson && method2Result?.status === 200) ? 'Method 2: JSON + Bearer' :
      (method3Result?.isJson && method3Result?.status === 200) ? 'Method 3: JSON + api_token' :
      'None - check API credentials'

    return NextResponse.json({
      success: true,
      config: {
        apiUrl: config.apiUrl,
        hasApiKey: true,
        apiKeyLength: config.apiKey.length,
        sender: config.sender
      },
      testPhone: testPhone.substring(0, 4) + '****',
      results: {
        method1_formUrlencoded: method1Result,
        method2_jsonBearer: method2Result,
        method3_jsonApiToken: method3Result
      },
      recommendation: workingMethod,
      hint: method1Result?.isHtml ? 'API is returning HTML - likely invalid API key or wrong endpoint' : null
    })
    
  } catch (error: any) {
    console.error('SMS test error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

