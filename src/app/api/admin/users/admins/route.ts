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

    // Validate required fields
    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json({ 
        success: false, 
        message: "Email, password, first name, and last name are required" 
      }, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ 
        success: false, 
        message: "Invalid email format" 
      }, { status: 400 })
    }

    // Validate password length
    if (password.length < 8) {
      return NextResponse.json({ 
        success: false, 
        message: "Password must be at least 8 characters long" 
      }, { status: 400 })
    }

    // Verify requester is admin
    const { data: me } = await supabase.auth.getUser()
    const uid = me?.user?.id
    if (!uid) {
      return NextResponse.json({ 
        success: false, 
        code: 'NOT_AUTHENTICATED',
        message: 'You must be logged in to create an admin account'
      }, { status: 401 })
    }
    
    const { data: roleRow, error: roleError }: any = await supabase
      .from('users')
      .select('role')
      .eq('id', uid)
      .maybeSingle()
    
    if (roleError) {
      console.error("Error checking user role:", roleError)
      return NextResponse.json({ 
        success: false, 
        message: "Error verifying admin status" 
      }, { status: 500 })
    }
    
    if (!roleRow || roleRow.role !== 'admin') {
      return NextResponse.json({ 
        success: false, 
        code: 'FORBIDDEN',
        message: 'Only administrators can create admin accounts'
      }, { status: 403 })
    }

    // Check if email already exists (case-insensitive)
    const { data: existingUser, error: existingError } = await supabaseAdmin
      .from("users")
      .select("id, email")
      .ilike("email", email)
      .maybeSingle()

    if (existingError) {
      console.error("Error checking existing user:", existingError)
      return NextResponse.json({ 
        success: false, 
        message: "Error checking if email exists. Please try again." 
      }, { status: 500 })
    }
    if (existingUser) {
      return NextResponse.json({ 
        success: false, 
        message: `An account with email ${email} already exists` 
      }, { status: 400 })
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
      return NextResponse.json({ 
        success: false, 
        message: authError?.message || "Failed to create auth user" 
      }, { status: 400 })
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
      email: email.toLowerCase().trim(),
      first_name: firstName.trim().toUpperCase(),
      last_name: lastName.trim().toUpperCase(),
      role: "admin",
      phone_number: phoneNumber?.trim() || null,
      city: "TALISAY CITY",
      province: "NEGROS OCCIDENTAL",
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })

    if (profileError) {
      console.error("Error creating user profile:", profileError)
      // Try to clean up auth user if profile creation fails
      try {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      } catch (cleanupError) {
        console.error("Error cleaning up auth user:", cleanupError)
      }
      return NextResponse.json({ 
        success: false, 
        message: `Failed to create user profile: ${profileError.message}` 
      }, { status: 400 })
    }

    // Log the action in system_logs
    try {
      await supabaseAdmin.from('system_logs').insert({
        action: 'ADMIN_CREATED',
        details: `Admin account created: ${email} (${authData.user.id}) by admin ${uid}`,
        user_id: uid
      })
    } catch (logError) {
      // Non-fatal: log error but don't fail the request
      console.warn("Failed to log admin creation:", logError)
    }

    return NextResponse.json({ 
      success: true, 
      message: "Admin account created successfully.",
      data: {
        id: authData.user.id,
        email: email.toLowerCase().trim()
      }
    })
  } catch (e: any) {
    console.error("Unexpected error creating admin account:", e)
    return NextResponse.json({ 
      success: false, 
      message: e?.message || "An unexpected error occurred while creating the admin account" 
    }, { status: 500 })
  }
}