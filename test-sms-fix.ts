// Test the SMS fix
async function testSMSFix() {
  console.log('=== Testing SMS Fix ===\n')
  
  // Test the URL construction
  const baseUrl = 'https://sms.iprogtech.com/api/v1/sms_messages'
  const apiKey = '555786d4af9d70f819b1e03e738c3d5e76e3de0d'
  const message = 'Test message from RVOIS'
  const phoneNumber = '09123456789'
  const sender = 'iprogsms'
  
  // Construct URL like in the fixed code
  const url = new URL(baseUrl)
  url.searchParams.append('api_token', apiKey)
  url.searchParams.append('message', message)
  url.searchParams.append('phone_number', phoneNumber)
  url.searchParams.append('sender', sender)
  
  console.log('Constructed URL:')
  console.log(url.toString().replace(apiKey, '***REDACTED***'))
  console.log()
  
  // This should match the format in the batch file:
  // https://sms.iprogtech.com/api/v1/sms_messages?api_token=API_KEY&message=MESSAGE&phone_number=NUMBER
  const expectedFormat = `${baseUrl}?api_token=${apiKey}&message=${encodeURIComponent(message)}&phone_number=${phoneNumber}&sender=${sender}`
  const actualFormat = url.toString()
  
  console.log('Expected format:')
  console.log(expectedFormat.replace(apiKey, '***REDACTED***'))
  console.log()
  
  console.log('Match:', expectedFormat === actualFormat ? '✅ YES' : '❌ NO')
  console.log('\n=== Test Complete ===')
}

testSMSFix().catch(console.error)