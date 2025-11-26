const { createClient } = require('@supabase/supabase-js');

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testDBAccess() {
  try {
    console.log('Testing database access...');
    
    // Test a simple query
    const { data, error } = await supabase
      .from('users')
      .select('id, role')
      .limit(1);
    
    if (error) {
      console.error('Database access error:', error);
      return;
    }
    
    console.log('Database access successful!');
    console.log('Sample data:', data);
  } catch (error) {
    console.error('Database test failed:', error);
  }
}

testDBAccess();