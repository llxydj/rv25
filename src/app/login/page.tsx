"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, User } from "lucide-react"
import { signIn } from "@/lib/auth"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { supabase } from "@/lib/supabase"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

 const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  setLoading(true)
  setError(null)

  try {
    const result = await signIn(email, password)
    console.log("Auth result:", result)

    if (!result.success) {
      setError(result.message || "Failed to sign in")
      setLoading(false)
      return
    }

    // The useAuth hook will handle redirection based on role
    // via the onAuthStateChange listener, so we don't need to
    // make additional database calls or handle redirection here
    
  } catch (err: any) {
    console.error("Login error:", err)
    setError(err.message || "An unexpected error occurred")
    setLoading(false)
  }
}

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-md">
        <div className="text-center">
          <div className="flex justify-center">
            <AlertTriangle className="h-12 w-12 text-red-600" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">RVOIS</h2>
          <p className="mt-2 text-sm text-gray-600">Rescue Volunteers Operations Information System</p>
        </div>

        {/* Residents: Google sign-in */}
        <div className="mt-6 space-y-3">
          <div className="text-sm text-gray-700 font-medium">Residents</div>
          <button
            type="button"
            onClick={async () => {
              setLoading(true)
              setError(null)
              try {
                // Ensure we start with a clean state - sign out any existing session first
                const { data: { session } } = await supabase.auth.getSession()
                if (session) {
                  await supabase.auth.signOut()
                  // Wait a moment for sign out to complete
                  await new Promise(resolve => setTimeout(resolve, 100))
                }
                
                // Now start fresh OAuth flow
                await supabase.auth.signInWithOAuth({
                  provider: 'google' as any,
                  options: { 
                    redirectTo: `${window.location.origin}/auth/callback`,
                    queryParams: {
                      access_type: 'offline',
                      prompt: 'consent', // Force Google to show account selection
                    }
                  }
                })
              } catch (e: any) {
                setError(e?.message || 'Failed to start Google sign-in')
                setLoading(false)
              }
            }}
            className="w-full flex justify-center items-center gap-2 py-2 px-4 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            disabled={loading}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="h-5 w-5">
              <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12 s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C33.18,6.053,28.791,4,24,4C12.955,4,4,12.955,4,24 s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
              <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,16.108,18.961,13,24,13c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657 C33.18,6.053,28.791,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
              <path fill="#4CAF50" d="M24,44c4.717,0,9.045-1.802,12.305-4.735l-5.683-4.807C28.566,36.994,26.379,38,24,38 c-5.202,0-9.619-3.317-11.283-7.946l-6.5,5.017C9.488,39.556,16.227,44,24,44z"/>
              <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.793,2.237-2.231,4.166-4.083,5.458 c0.001-0.001,0.002-0.001,0.003-0.002l5.683,4.807C35.614,39.202,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
            </svg>
            Continue with Google
          </button>
        </div>

        {/* Admins / Volunteers / Barangay: Email sign-in */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email-address" className="sr-only">
                Email address
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-red-500 focus:border-red-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-red-500 focus:border-red-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm">
              <Link href="/forgot-password" className="font-medium text-red-600 hover:text-red-500">
                Forgot your password?
              </Link>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
            >
              {loading ? (
                <LoadingSpinner size="sm" color="text-white" />
              ) : (
                <>
                  <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                    <User className="h-5 w-5 text-red-500 group-hover:text-red-400" />
                  </span>
                  Sign in
                </>
              )}
            </button>
          </div>
        </form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Don't have an account?</span>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  )
}
