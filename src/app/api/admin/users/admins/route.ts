import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase-server"

// Initialize admin client in server context
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function POST(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const { adminId, email, password, firstName, lastName, phoneNumber } = await request.json()

    // Verify requester is admin
    const { data: me } = await supabase.auth.getUser()
    const uid = me?.user?.id
    if (!uid) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })
    
    const { data: roleRow }: any = await supabase.from('users').select('role').eq('id', uid).maybeSingle()
    if (!roleRow || roleRow.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })
    }

    // Check if email already exists
    const { data: existingUser, error: existingError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle()

    if (existingError) {
      return NextResponse.json({ success: false, message: existingError.message }, { status: 400 })
    }
    if (existingUser) {
      return NextResponse.json({ success: false, message: "Email already exists" }, { status: 400 })
    }

    // Create auth user (admin API)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`,
        role: "admin",
        created_by: uid
      }
    })

    if (authError || !authData?.user) {
      return NextResponse.json({ success: false, message: authError?.message || "Failed to create auth user" }, { status: 400 })
    }

    // Ensure JWT has role claim by setting app_metadata.role
    try {
      await supabaseAdmin.auth.admin.updateUserById(authData.user.id, {
        app_metadata: { role: 'admin' }
      })
    } catch (e) {
      // Non-fatal: profile insert and RLS owner checks will still work; admin JWT is for RLS admin checks
      console.warn('Failed to set app_metadata.role for admin user:', (e as any)?.message)
    }

    // Insert profile
    const { error: profileError } = await supabaseAdmin.from("users").insert({
      id: authData.user.id,
      email,
      first_name: firstName.toUpperCase(),
      last_name: lastName.toUpperCase(),
      role: "admin",
      phone_number: phoneNumber,
      city: "TALISAY CITY",
      province: "NEGROS OCCIDENTAL",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })

    if (profileError) {
      return NextResponse.json({ success: false, message: profileError.message }, { status: 400 })
    }

    // Log the action in system_logs
    await supabaseAdmin.from('system_logs').insert({
      action: 'ADMIN_CREATED',
      details: `Admin ${authData.user.id} created by admin ${uid}`,
      user_id: uid
    })

    return NextResponse.json({ success: true, message: "Admin account created successfully." })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || "Unexpected error" }, { status: 500 })
  }
}