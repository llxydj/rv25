import { LoadingSpinner } from "@/components/ui/loading-spinner"

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <LoadingSpinner size="lg" text="Loading RVOIS..." />
      </div>
    </div>
  )
}
