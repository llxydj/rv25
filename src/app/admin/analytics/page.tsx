"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { AdminLayout } from "@/components/layout/admin-layout"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

export default function AnalyticsPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to comprehensive analytics (which now includes all analytics features)
    router.replace('/admin/analytics/comprehensive')
  }, [router])

  return (
    <AdminLayout>
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner size="lg" text="Redirecting to Analytics Dashboard..." />
      </div>
    </AdminLayout>
  )
}
