// src/app/api/admin/users/route.ts

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

// ✅ ADMIN CLIENT - Use ONLY for admin operations with SERVICE_ROLE key
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

/**
 * Revoke Google OAuth tokens for a user
 * Note: Supabase doesn't store Google refresh tokens by default, so we invalidate sessions instead
 * If you have stored refresh tokens, you can call Google's revoke endpoint:
 * https://oauth2.googleapis.com/revoke?token={refresh_token}
 */
async function revokeGoogleOAuthTokens(authUserId: string): Promise<void> {
  try {
    // Get the auth user to check if they have Google OAuth
    const { data: authUserData, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(authUserId)
    
    if (getUserError || !authUserData?.user) {
      console.warn('[revoke-google] Could not fetch auth user:', getUserError?.message)
      return
    }
    
    const authUser = authUserData.user
    
    // Check if user has Google OAuth identity
    const hasGoogleAuth = authUser.identities?.some((id: any) => id.provider === 'google')
    
    if (!hasGoogleAuth) {
      console.log('[revoke-google] User does not have Google OAuth, skipping token revocation')
      return
    }
    
    // Supabase doesn't expose Google refresh tokens, so we invalidate all sessions
    // This prevents the user from using existing Google OAuth sessions
    // The user will need to re-authenticate with Google after reactivation
    
    // Update user metadata to mark tokens as revoked
    await supabaseAdmin.auth.admin.updateUserById(authUserId, {
      app_metadata: {
        ...authUser.app_metadata,
        google_tokens_revoked: true,
        tokens_revoked_at: new Date().toISOString()
      }
    })
    
    console.log('[revoke-google] Marked Google tokens as revoked for user:', authUserId)
    
    // Note: If you have stored Google refresh tokens in your database,
    // you would call Google's revoke endpoint here:
    // await fetch(`https://oauth2.googleapis.com/revoke?token=${refreshToken}`, { method: 'POST' })
    
  } catch (error: any) {
    console.error('[revoke-google] Error revoking Google tokens:', error?.message)
    // Don't throw - token revocation failure shouldn't block deactivation
  }
}

/**
 * Invalidate all user sessions
 * For OAuth users: Uses app_metadata.disabled (Supabase respects this)
 * For email users: Updates password to invalidate sessions
 */
async function invalidateAllUserSessions(authUserId: string, isOAuthOnly: boolean = false): Promise<void> {
  try {
    // Get current user
    const { data: authUserData, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(authUserId)
    
    if (getUserError || !authUserData?.user) {
      console.warn('[invalidate-sessions] Could not fetch auth user:', getUserError?.message)
      return
    }
    
    const authUser = authUserData.user
    
    // CRITICAL: Use app_metadata.disabled for OAuth users (Supabase checks this)
    // This works for both OAuth and email users
    await supabaseAdmin.auth.admin.updateUserById(authUserId, {
      app_metadata: {
        ...authUser.app_metadata,
        disabled: true // Supabase respects this flag and blocks login
      }
    })
    
    // For email/password users, also update password to invalidate sessions
    if (!isOAuthOnly) {
      const randomPassword = `revoked_${Date.now()}_${Math.random().toString(36).substring(7)}`
      await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        password: randomPassword
      })
    }
    
    console.log('[invalidate-sessions] Invalidated all sessions for user:', authUserId)
    
  } catch (error: any) {
    console.error('[invalidate-sessions] Error invalidating sessions:', error?.message)
    // Don't throw - session invalidation failure shouldn't block deactivation
  }
}

// ✅ Create auth client with proper cookie handling
async function getAuthClient() {
  const cookieStore = await cookies()
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch {
            // Cookie setting may fail in route handlers, ignore
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch {
            // Cookie removal may fail, ignore
          }
        },
      },
    }
  )
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '1000')
    const offset = (page - 1) * limit
    
    // Get filter parameters
    const roleFilter = url.searchParams.get('role') || null
    const statusFilter = url.searchParams.get('status') || null
    const barangayFilter = url.searchParams.get('barangay') || null
    const searchTerm = url.searchParams.get('search') || null
    const getAll = url.searchParams.get('all') === 'true'

    // ✅ CRITICAL FIX: Always await getAuthClient()
    const supabase = await getAuthClient()

    // ✅ CRITICAL FIX: Use getUser() instead of getSession()
    // getUser() validates the JWT token server-side every time
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    console.log('Auth check:', { 
      hasUser: !!authUser, 
      userId: authUser?.id,
      authError: authError?.message 
    })

    if (authError || !authUser) {
      console.error('Authentication failed:', authError)
      return NextResponse.json({ 
        success: false, 
        code: 'NOT_AUTHENTICATED',
        message: 'User not authenticated. Please log in again.' 
      }, { status: 401 })
    }

    // ✅ Use admin client to check role (avoids RLS issues)
    const { data: roleRow, error: roleError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', authUser.id)
      .maybeSingle()

    console.log('Role check:', { 
      roleRow, 
      roleError: roleError?.message 
    })

    if (roleError) {
      console.error('Role fetch error:', roleError)
      return NextResponse.json({ 
        success: false, 
        code: 'ROLE_FETCH_ERROR',
        message: 'Failed to fetch user role' 
      }, { status: 500 })
    }

    if (!roleRow || roleRow.role !== 'admin') {
      console.error('User is not admin:', { role: roleRow?.role })
      return NextResponse.json({ 
        success: false, 
        code: 'FORBIDDEN',
        message: 'Admin access required' 
      }, { status: 403 })
    }

    // ✅ Build query with filters using admin client
    let query = supabaseAdmin
      .from('users')
      .select('*', { count: 'exact' })

    // Apply filters
    if (roleFilter && roleFilter !== 'all') {
      query = query.eq('role', roleFilter)
    }

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }

    if (barangayFilter && barangayFilter !== 'all') {
      query = query.eq('barangay', barangayFilter)
    }

    if (searchTerm) {
      // Decode and sanitize search term
      const decodedSearch = decodeURIComponent(searchTerm).trim()
      // Escape special characters for PostgREST (%, _, \)
      const escapedSearch = decodedSearch.replace(/[%_\\]/g, '\\$&')
      // Use ilike for case-insensitive search with % wildcards
      // Note: PostgREST uses % for wildcards, not *
      query = query.or(
        `first_name.ilike.%${escapedSearch}%,last_name.ilike.%${escapedSearch}%,email.ilike.%${escapedSearch}%,phone_number.ilike.%${escapedSearch}%`
      )
    }

    // Apply pagination
    if (!getAll) {
      query = query.range(offset, offset + limit - 1)
    }

    query = query.order('created_at', { ascending: false })
    const { data: users, error: usersError, count } = await query

    if (usersError) {
      console.error('Error fetching users from database:', usersError)
      throw usersError
    }

    const usersArray = users || []
    console.log(`Fetched ${usersArray.length} users from database`)

    // Fetch incident counts
    const userIds = usersArray.map((u: any) => u.id)
    const userIncidentCounts: Record<string, number> = {}

    if (userIds.length > 0) {
      const { data: reportedIncidents } = await supabaseAdmin
        .from('incidents')
        .select('reporter_id')
        .in('reporter_id', userIds)

      if (reportedIncidents) {
        reportedIncidents.forEach((item: any) => {
          if (item.reporter_id) {
            userIncidentCounts[item.reporter_id] = (userIncidentCounts[item.reporter_id] || 0) + 1
          }
        })
      }

      const { data: assignedIncidents } = await supabaseAdmin
        .from('incidents')
        .select('assigned_to')
        .in('assigned_to', userIds)

      if (assignedIncidents) {
        assignedIncidents.forEach((item: any) => {
          if (item.assigned_to) {
            userIncidentCounts[item.assigned_to] = (userIncidentCounts[item.assigned_to] || 0) + 1
          }
        })
      }
    }

    // ✅ NEW: Fetch provider info and last sign-in from Supabase Auth
    const authUsersMap: Record<string, { provider: string; last_sign_in_at: string | null }> = {}
    
    try {
      // Fetch auth users - only fetch those that match our user IDs for efficiency
      // Supabase Admin API doesn't support filtering by IDs, so we fetch in batches
      const userIdsSet = new Set(userIds)
      let page = 1 // Supabase uses 1-based pagination
      const pageSize = 1000
      let hasMore = true
      let foundCount = 0
      
      while (hasMore && foundCount < userIds.length) {
        const { data: authUsersData, error: authError } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage: pageSize
        })
        
        if (authError) {
          console.warn('[admin-users] Error fetching auth users:', authError)
          break
        }
        
        if (authUsersData?.users && authUsersData.users.length > 0) {
          authUsersData.users.forEach((authUser: any) => {
            // Only process users that are in our list
            if (userIdsSet.has(authUser.id)) {
              // Determine provider from identities
              let provider = 'email' // default
              if (authUser.identities && authUser.identities.length > 0) {
                // Check for Google OAuth provider
                const googleIdentity = authUser.identities.find((id: any) => id.provider === 'google')
                if (googleIdentity) {
                  provider = 'google'
                } else {
                  // Use first identity provider
                  provider = authUser.identities[0].provider || 'email'
                }
              }
              
              authUsersMap[authUser.id] = {
                provider,
                last_sign_in_at: authUser.last_sign_in_at
              }
              foundCount++
            }
          })
          
          // Check if we should continue paginating
          hasMore = authUsersData.users.length === pageSize && foundCount < userIds.length
          page++
        } else {
          hasMore = false
        }
      }
      
      console.log(`[admin-users] Fetched auth info for ${foundCount} of ${userIds.length} users`)
    } catch (authErr: any) {
      console.warn('[admin-users] Error fetching auth user data:', authErr?.message)
      // Continue without auth data - not critical
    }

    const usersWithIncidentData = usersArray.map((user: any) => {
      const authInfo = authUsersMap[user.id] || { provider: 'email', last_sign_in_at: null }
      
      return {
        ...user,
        incident_count: userIncidentCounts[user.id] || 0,
        status: user.status || 'active',
        auth_provider: authInfo.provider,
        last_sign_in_at: authInfo.last_sign_in_at
      }
    })

    console.log(`Returning ${usersWithIncidentData.length} users with incident data`)

    return NextResponse.json({ 
      success: true, 
      data: usersWithIncidentData,
      meta: {
        total_count: count || usersWithIncidentData.length,
        current_page: getAll ? 1 : page,
        per_page: getAll ? count || usersWithIncidentData.length : limit,
        total_pages: getAll ? 1 : Math.ceil((count || 0) / limit)
      }
    })

  } catch (e: any) {
    console.error('Error fetching users:', e)
    console.error('Error details:', {
      message: e?.message,
      code: e?.code,
      details: e?.details,
      hint: e?.hint
    })
    return NextResponse.json({ 
      success: false, 
      code: 'INTERNAL_ERROR', 
      message: e?.message || 'Failed to fetch users',
      error: process.env.NODE_ENV === 'development' ? {
        message: e?.message,
        code: e?.code,
        details: e?.details
      } : undefined
    }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await getAuthClient()
    const body = await request.json()
    const { userId, action } = body

    // ✅ CRITICAL FIX: Use getUser() instead of getSession()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json({ 
        success: false, 
        code: 'NOT_AUTHENTICATED',
        message: 'User not authenticated' 
      }, { status: 401 })
    }

    const { data: roleRow } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', authUser.id)
      .maybeSingle()

    if (!roleRow || roleRow.role !== 'admin') {
      return NextResponse.json({ 
        success: false, 
        code: 'FORBIDDEN',
        message: 'Admin access required' 
      }, { status: 403 })
    }

    if (action === 'deactivate') {
      // Get user data before deactivation for audit logging
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('email, first_name, last_name, role')
        .eq('id', userId)
        .maybeSingle()

      if (!userData) {
        return NextResponse.json({ 
          success: false, 
          message: 'User not found' 
        }, { status: 404 })
      }

      // Update user status to inactive
      const { error } = await supabaseAdmin
        .from('users')
        .update({ status: 'inactive' })
        .eq('id', userId)

      if (error) throw error

      // CRITICAL: Get auth user and perform comprehensive deactivation
      let authUserId: string | null = null
      let provider: string = 'email'
      
      try {
        // Get the auth user by email or ID
        const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers()
        const authUserToDisable = authUsers.users.find(u => 
          u.email === userData.email || u.id === userId
        )
        
        if (authUserToDisable) {
          authUserId = authUserToDisable.id
          
          // Determine provider
          if (authUserToDisable.identities?.some((id: any) => id.provider === 'google')) {
            provider = 'google'
          }
          
          // Update auth user metadata to mark as deactivated
          await supabaseAdmin.auth.admin.updateUserById(authUserId, {
            user_metadata: { 
              ...authUserToDisable.user_metadata,
              deactivated: true,
              deactivated_at: new Date().toISOString(),
              deactivated_by: authUser.id
            },
            app_metadata: {
              ...authUserToDisable.app_metadata,
              disabled: true
            }
          })
          
          // ✅ NEW: Invalidate all existing sessions
          // Use app_metadata.disabled which Supabase respects for all auth types
          await invalidateAllUserSessions(authUserId, provider === 'google')
          
          // ✅ NEW: Revoke Google OAuth tokens if applicable
          if (provider === 'google') {
            await revokeGoogleOAuthTokens(authUserId)
          }
        }
      } catch (authError) {
        console.error('[deactivate] Error disabling auth account:', authError)
        // Continue even if auth update fails - database status is more important
      }

      // ✅ Enhanced audit logging
      await supabaseAdmin.from('system_logs').insert({
        action: 'USER_DEACTIVATED',
        details: JSON.stringify({
          target_user_id: userId,
          target_email: userData.email,
          target_name: `${userData.first_name} ${userData.last_name}`,
          target_role: userData.role,
          provider: provider,
          deactivated_by: authUser.id,
          deactivated_by_email: authUser.email || 'unknown'
        }),
        user_id: authUser.id
      })

      return NextResponse.json({ 
        success: true, 
        message: 'User deactivated successfully. All sessions invalidated and Google tokens revoked (if applicable).' 
      })
    } 
    else if (action === 'activate') {
      // Get user data before activation for audit logging
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('email, first_name, last_name, role')
        .eq('id', userId)
        .maybeSingle()

      if (!userData) {
        return NextResponse.json({ 
          success: false, 
          message: 'User not found' 
        }, { status: 404 })
      }

      // Update user status to active
      const { error } = await supabaseAdmin
        .from('users')
        .update({ status: 'active' })
        .eq('id', userId)

      if (error) throw error

      // Re-enable auth account if it was disabled
      let provider: string = 'email'
      
      try {
        const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers()
        const authUserToEnable = authUsers.users.find(u => 
          u.email === userData.email || u.id === userId
        )
        
        if (authUserToEnable) {
          // Determine provider
          if (authUserToEnable.identities?.some((id: any) => id.provider === 'google')) {
            provider = 'google'
          }
          
          // Remove deactivated flag from metadata
          await supabaseAdmin.auth.admin.updateUserById(authUserToEnable.id, {
            user_metadata: { 
              ...authUserToEnable.user_metadata,
              deactivated: false,
              reactivated_at: new Date().toISOString(),
              reactivated_by: authUser.id
            },
            app_metadata: {
              ...authUserToEnable.app_metadata,
              disabled: false,
              google_tokens_revoked: false // Clear revocation flag
            }
          })
        }
      } catch (authError) {
        console.error('[activate] Error re-enabling auth account:', authError)
        // Continue even if auth update fails
      }

      // ✅ Enhanced audit logging
      await supabaseAdmin.from('system_logs').insert({
        action: 'USER_ACTIVATED',
        details: JSON.stringify({
          target_user_id: userId,
          target_email: userData.email,
          target_name: `${userData.first_name} ${userData.last_name}`,
          target_role: userData.role,
          provider: provider,
          activated_by: authUser.id,
          activated_by_email: authUser.email || 'unknown'
        }),
        user_id: authUser.id
      })

      return NextResponse.json({ 
        success: true, 
        message: 'User activated successfully. User can now sign in again.' 
      })
    } 
    else {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid action' 
      }, { status: 400 })
    }

  } catch (e: any) {
    console.error('Error updating user status:', e)
    return NextResponse.json({ 
      success: false, 
      code: 'INTERNAL_ERROR', 
      message: e?.message || 'Failed to update user status' 
    }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await getAuthClient()
    const body = await request.json()
    const { userId, hardDelete = false } = body // Add option for hard delete

    // ✅ CRITICAL FIX: Use getUser() instead of getSession()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json({ 
        success: false, 
        code: 'NOT_AUTHENTICATED',
        message: 'User not authenticated' 
      }, { status: 401 })
    }

    const { data: roleRow } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', authUser.id)
      .maybeSingle()

    if (!roleRow || roleRow.role !== 'admin') {
      return NextResponse.json({ 
        success: false, 
        code: 'FORBIDDEN',
        message: 'Admin access required' 
      }, { status: 403 })
    }

    // Get user data before deletion for audit logging
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('email, first_name, last_name, role')
      .eq('id', userId)
      .maybeSingle()

    if (!userData) {
      return NextResponse.json({ 
        success: false, 
        message: 'User not found' 
      }, { status: 404 })
    }

    const originalEmail = userData.email
    const originalName = `${userData.first_name} ${userData.last_name}`

    // ✅ Get auth user info before deletion
    let authUserId: string | null = null
    let provider: string = 'email'
    
    try {
      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers()
      const authUserToDelete = authUsers.users.find(u => 
        u.email === originalEmail || u.id === userId
      )
      
      if (authUserToDelete) {
        authUserId = authUserToDelete.id
        
        // Determine provider
        if (authUserToDelete.identities?.some((id: any) => id.provider === 'google')) {
          provider = 'google'
        }
      }
    } catch (authErr) {
      console.warn('[delete] Could not fetch auth user info:', authErr)
    }

    if (hardDelete) {
      // ✅ HARD DELETE: Permanently remove user
      // First, revoke Google tokens and invalidate sessions
      if (authUserId) {
        await invalidateAllUserSessions(authUserId)
        if (provider === 'google') {
          await revokeGoogleOAuthTokens(authUserId)
        }
      }

      // Delete from Supabase Auth
      if (authUserId) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(authUserId)
        } catch (authError) {
          console.error('[delete] Error deleting auth account:', authError)
          // Continue with database cleanup even if auth deletion fails
        }
      }

      // Anonymize user data in database (soft delete first for recovery)
      const deletedAt = new Date().toISOString()
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({ 
          status: 'inactive',
          email: `deleted_${Date.now()}_${userId}@deleted.local`,
          phone_number: null,
          address: null,
          first_name: '[DELETED]',
          last_name: '[USER]',
          // Store deletion metadata for potential recovery (30-day grace period)
          // Note: Add deleted_at column if it doesn't exist
        })
        .eq('id', userId)

      if (updateError) throw updateError

      // Anonymize incidents
      await supabaseAdmin
        .from('incidents')
        .update({ 
          reporter_id: null,
          description: '[CONTENT REMOVED FOR PRIVACY]'
        })
        .eq('reporter_id', userId)

      // ✅ Enhanced audit logging
      await supabaseAdmin.from('system_logs').insert({
        action: 'USER_HARD_DELETED',
        details: JSON.stringify({
          target_user_id: userId,
          target_email: originalEmail,
          target_name: originalName,
          target_role: userData.role,
          provider: provider,
          deleted_by: authUser.id,
          deleted_by_email: authUser.email || 'unknown',
          deleted_at: deletedAt,
          hard_delete: true
        }),
        user_id: authUser.id
      })

      return NextResponse.json({ 
        success: true, 
        message: 'User permanently deleted. All sessions invalidated and Google tokens revoked (if applicable).' 
      })
    } else {
      // ✅ SOFT DELETE: Mark for deletion with recovery period
      // First, revoke Google tokens and invalidate sessions
      if (authUserId) {
        await invalidateAllUserSessions(authUserId)
        if (provider === 'google') {
          await revokeGoogleOAuthTokens(authUserId)
        }
        
        // Mark auth user as deleted (but don't delete yet)
        try {
          await supabaseAdmin.auth.admin.updateUserById(authUserId, {
            user_metadata: {
              deleted: true,
              deleted_at: new Date().toISOString(),
              deleted_by: authUser.id
            },
            app_metadata: {
              disabled: true,
              soft_deleted: true
            }
          })
        } catch (authError) {
          console.error('[delete] Error marking auth user as deleted:', authError)
        }
      }

      // Soft delete: Anonymize but keep record
      const deletedAt = new Date().toISOString()
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({ 
          status: 'inactive',
          email: `deleted_${Date.now()}_${userId}@deleted.local`,
          phone_number: null,
          address: null,
          first_name: '[DELETED]',
          last_name: '[USER]'
        })
        .eq('id', userId)

      if (updateError) throw updateError

      // Anonymize incidents
      await supabaseAdmin
        .from('incidents')
        .update({ 
          reporter_id: null,
          description: '[CONTENT REMOVED FOR PRIVACY]'
        })
        .eq('reporter_id', userId)

      // ✅ Enhanced audit logging
      await supabaseAdmin.from('system_logs').insert({
        action: 'USER_SOFT_DELETED',
        details: JSON.stringify({
          target_user_id: userId,
          target_email: originalEmail,
          target_name: originalName,
          target_role: userData.role,
          provider: provider,
          deleted_by: authUser.id,
          deleted_by_email: authUser.email || 'unknown',
          deleted_at: deletedAt,
          recovery_period_days: 30,
          note: 'User soft-deleted. Can be recovered within 30 days. After that, hard delete recommended.'
        }),
        user_id: authUser.id
      })

      return NextResponse.json({ 
        success: true, 
        message: 'User soft-deleted and anonymized. All sessions invalidated and Google tokens revoked (if applicable). User can be recovered within 30 days.' 
      })
    }

  } catch (e: any) {
    console.error('Error deleting user:', e)
    return NextResponse.json({ 
      success: false, 
      code: 'INTERNAL_ERROR', 
      message: e?.message || 'Failed to delete user' 
    }, { status: 500 })
  }
}