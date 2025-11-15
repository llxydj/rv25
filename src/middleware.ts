import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs"

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  const { data } = await supabase.auth.getSession()

  // Public paths don't need authentication
  const publicPaths = ["/", "/login", "/register", "/forgot-password", "/reset-password"]
  const isPublicPath = publicPaths.some(path => req.nextUrl.pathname.startsWith(path))
  
  // Handle authenticated users trying to access login page
  if (data.session && req.nextUrl.pathname === "/login") {
    try {
      // Get user role to determine where to redirect
      const { data: userData, error } = await supabase
        .from("users")
        .select("role")
        .eq("id", data.session.user.id)
        .maybeSingle()
      
      if (!error && userData) {
        // Redirect based on role
        if (userData.role === "admin") {
          return NextResponse.redirect(new URL("/admin/dashboard", req.url))
        } else if (userData.role === "volunteer") {
          return NextResponse.redirect(new URL("/volunteer/dashboard", req.url))
        } else if (userData.role === "barangay") {
          return NextResponse.redirect(new URL("/barangay/dashboard", req.url))
        } else if (userData.role === "resident") {
          return NextResponse.redirect(new URL("/resident/dashboard", req.url))
        } else {
          // Authenticated but no role yet -> first-time resident flow
          return NextResponse.redirect(new URL("/resident/register-google", req.url))
        }
      } else {
        // No users row yet (first-time) or error occurred -> redirect to resident registration
        return NextResponse.redirect(new URL("/resident/register-google", req.url))
      }
    } catch (error) {
      console.error("Error in middleware role check:", error)
      // On error, be safe: send to registration page
      return NextResponse.redirect(new URL("/resident/register-google", req.url))
    }
  }
  
  // Let the routes handle their own auth guards
  return res
}

export const config = {
  matcher: [
    "/login",
  ],
}