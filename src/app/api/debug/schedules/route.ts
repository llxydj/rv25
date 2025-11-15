import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const volunteerId = searchParams.get('volunteer_id');
  
  try {
    let query = supabase.from('schedules').select('*');
    
    if (volunteerId) {
      query = query.eq('volunteer_id', volunteerId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching schedules:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true, 
      data,
      count: data.length,
      volunteer_id: volunteerId || 'all'
    });
    
  } catch (error: any) {
    console.error('Debug API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Unknown error' }, 
      { status: 500 }
    );
  }
} 