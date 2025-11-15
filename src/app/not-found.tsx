import Link from "next/link"
import { AlertTriangle, Home } from "lucide-react"

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-md">
        <div className="text-center">
          <div className="flex justify-center">
            <AlertTriangle className="h-12 w-12 text-red-600" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Page Not Found</h2>
          <p className="mt-2 text-sm text-gray-600">
            We couldn't find the page you're looking for. The page may have been moved, deleted, or never existed.
          </p>
        </div>

        <div className="mt-8 space-y-6">
          <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">Please check the URL or navigate back to the home page.</p>
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <Link
              href="/"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <Home className="h-4 w-4 mr-2" />
              Return to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
