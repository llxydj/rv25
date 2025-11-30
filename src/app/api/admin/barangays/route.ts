import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { BarangayAccountCreateSchema } from "@/lib/validation"

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
    const body = await request.json()
    const { adminId, ...accountData } = body

    // Validate input
    const parsed = BarangayAccountCreateSchema.safeParse(accountData)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: 'Invalid input', issues: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { email, password, firstName, lastName, phoneNumber, barangay } = parsed.data

    // Verify admin
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("id", adminId)
      .single()

    if (adminError || adminData?.role !== "admin") {
      return NextResponse.json({ success: false, message: "Only admins can create barangay accounts" }, { status: 403 })
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
        role: "barangay",
        created_by: adminId
      }
    })

    if (authError || !authData?.user) {
      return NextResponse.json({ success: false, message: authError?.message || "Failed to create auth user" }, { status: 400 })
    }

    // Ensure JWT has role claim by setting app_metadata.role
    try {
      await supabaseAdmin.auth.admin.updateUserById(authData.user.id, {
        app_metadata: { role: 'barangay' }
      })
    } catch (e) {
      // Non-fatal: profile insert and RLS owner checks will still work; admin JWT is for RLS admin checks
      console.warn('Failed to set app_metadata.role for barangay user:', (e as any)?.message)
    }

    // Insert profile
    // Note: Barangay users are excluded from PIN requirement in pin-security-gate
    const { error: profileError } = await supabaseAdmin.from("users").insert({
      id: authData.user.id,
      email,
      first_name: firstName.toUpperCase(),
      last_name: lastName.toUpperCase(),
      role: "barangay",
      phone_number: phoneNumber,
      barangay: barangay.toUpperCase(),
      city: "TALISAY CITY",
      province: "NEGROS OCCIDENTAL",
      pin_enabled: false, // Barangay users are excluded from PIN
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })

    if (profileError) {
      return NextResponse.json({ success: false, message: profileError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, message: "Barangay account created successfully." })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || "Unexpected error" }, { status: 500 })
  }
}


