"use client"

import type React from "react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import { AlertTriangle, User, Mail, Lock, ArrowRight } from "lucide-react"
import { signIn } from "@/lib/auth"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { supabase } from "@/lib/supabase"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  // Check for deactivated/deleted account error in URL
  useEffect(() => {
    const errorParam = searchParams.get('error')
    if (errorParam === 'account_deactivated') {
      setError('Your account has been deactivated. Please contact an administrator.')
    } else if (errorParam === 'account_not_found') {
      setError('Account not found. Please contact an administrator or register a new account.')
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Clear any existing session before signing in
      // This ensures the new login gets a fresh session
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        console.log('[Login] Clearing existing session before new login')
        await supabase.auth.signOut()
        // Wait a moment for sign out to complete
        await new Promise(resolve => setTimeout(resolve, 200))
      }

      const result = await signIn(email, password)

      if (!result.success) {
        setError(result.message || "Failed to sign in")
        setLoading(false)
        return
      }

      // After successful login, check PIN status and redirect accordingly
      // The useAuth hook will handle the actual redirect with PIN check
      // via the onAuthStateChange listener
      
    } catch (err: any) {
      console.error("Login error:", err)
      setError(err.message || "An unexpected error occurred")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Logo and Header */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="relative shadow-lg flex items-center justify-center">
                <Image
                  src="/radiant_logo.png"
                  alt="RVOIS Logo"
                  width={120}
                  height={120}
                  className="w-24 h-24 md:w-32 md:h-32 object-contain"
                  priority
                />
              </div>
            </div>
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            RVOIS
          </h2>
          <p className="mt-2 text-sm md:text-base text-gray-600 dark:text-gray-400">
            Rescue Volunteers Operations Information System
          </p>
        </div>

        {/* Main Login Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 md:p-8 space-y-6 transition-all duration-200">
          {/* Residents: Google sign-in */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700"></div>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Residents</span>
              <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700"></div>
            </div>
            <button
              type="button"
              onClick={async () => {
                setLoading(true)
                setError(null)
                try {
                  // CRITICAL: Always sign out existing session first to ensure clean OAuth flow
                  // This prevents issues where Google says "signing back in" but user isn't registered
                  const { data: { session } } = await supabase.auth.getSession()
                  if (session) {
                    console.log('[Login] Clearing existing session before Google OAuth')
                    await supabase.auth.signOut()
                    // Wait longer for sign out to complete fully
                    await new Promise(resolve => setTimeout(resolve, 500))
                  }
                  
                  // Now start fresh OAuth flow
                  // Use 'select_account' prompt to force account selection and prevent auto-login
                  await supabase.auth.signInWithOAuth({
                    provider: 'google' as any,
                    options: { 
                      redirectTo: `${window.location.origin}/auth/callback`,
                      queryParams: {
                        access_type: 'offline',
                        prompt: 'select_account', // Force account selection - prevents "signing back in" issue
                      }
                    }
                  })
                } catch (e: any) {
                  setError(e?.message || 'Failed to start Google sign-in')
                  setLoading(false)
                }
              }}
              className="w-full flex justify-center items-center gap-3 py-3 px-4 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
              disabled={loading}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="h-5 w-5 flex-shrink-0">
                <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12 s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C33.18,6.053,28.791,4,24,4C12.955,4,4,12.955,4,24 s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,16.108,18.961,13,24,13c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657 C33.18,6.053,28.791,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                <path fill="#4CAF50" d="M24,44c4.717,0,9.045-1.802,12.305-4.735l-5.683-4.807C28.566,36.994,26.379,38,24,38 c-5.202,0-9.619-3.317-11.283-7.946l-6.5,5.017C9.488,39.556,16.227,44,24,44z"/>
                <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.793,2.237-2.231,4.166-4.083,5.458 c0.001-0.001,0.002-0.001,0.003-0.002l5.683,4.807C35.614,39.202,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
              </svg>
              <span>Continue with Google</span>
            </button>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-medium">
                OR
              </span>
            </div>
          </div>

          {/* Admins / Volunteers / Barangay: Email sign-in */}
          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 dark:border-red-400 p-4 rounded-r-lg animate-in slide-in-from-top-2">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <AlertTriangle className="h-5 w-5 text-red-500 dark:text-red-400" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-red-800 dark:text-red-300">{error}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {/* Email Field */}
              <div>
                <label htmlFor="email-address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                  </div>
                  <input
                    id="email-address"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:focus:ring-red-400 dark:focus:border-red-400 transition-all duration-200 sm:text-sm"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:focus:ring-red-400 dark:focus:border-red-400 transition-all duration-200 sm:text-sm"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm">
                <Link 
                  href="/forgot-password" 
                  className="font-medium text-red-600 dark:text-red-400 hover:text-red-500 dark:hover:text-red-300 transition-colors duration-200"
                >
                  Forgot your password?
                </Link>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent text-sm font-semibold rounded-lg text-white bg-red-600 dark:bg-red-500 hover:bg-red-700 dark:hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
              >
                {loading ? (
                  <LoadingSpinner size="sm" color="text-white" />
                ) : (
                  <>
                    <User className="h-5 w-5" />
                    <span>Sign in</span>
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-200" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Footer Note */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-center text-gray-500 dark:text-gray-400">
              For Admins, Radiants, and Talisay Residents
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
