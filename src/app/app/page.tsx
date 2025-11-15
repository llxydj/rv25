"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

export default function Page() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to login page
    router.push("/login")
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <LoadingSpinner size="lg" text="Loading..." />
    </div>
  )
}
