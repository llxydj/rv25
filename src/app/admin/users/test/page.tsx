"use client"

import { useState, useEffect } from "react"
import { AdminLayout } from "@/components/layout/admin-layout"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function UserManagementTestPage() {
  const { user } = useAuth()
  const [testResults, setTestResults] = useState<any[]>([])
  const [running, setRunning] = useState(false)

  const runTests = async () => {
    setRunning(true)
    const results = []
    
    try {
      // Test 1: Fetch users API
      results.push({ 
        test: "Fetch Users API", 
        status: "running",
        description: "Testing API endpoint to fetch users"
      })
      
      const response = await fetch("/api/admin/users")
      const result = await response.json()
      
      results[0] = { 
        test: "Fetch Users API", 
        status: result.success ? "passed" : "failed",
        description: result.success ? "Successfully fetched users" : `Failed: ${result.message}`,
        data: result
      }
      
      // Test 2: Deactivate user (simulate)
      results.push({ 
        test: "Deactivate User", 
        status: "skipped",
        description: "Deactivate user functionality (requires user selection)"
      })
      
      // Test 3: Activate user (simulate)
      results.push({ 
        test: "Activate User", 
        status: "skipped",
        description: "Activate user functionality (requires user selection)"
      })
      
      // Test 4: Delete user (simulate)
      results.push({ 
        test: "Delete User", 
        status: "skipped",
        description: "Delete user functionality (requires user selection)"
      })
      
      // Test 5: Export CSV (simulate)
      results.push({ 
        test: "Export CSV", 
        status: "skipped",
        description: "Export to CSV functionality (UI only)"
      })
      
    } catch (error: any) {
      results.push({ 
        test: "API Tests", 
        status: "failed",
        description: `Error: ${error.message}`
      })
    }
    
    setTestResults(results)
    setRunning(false)
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-black">User Management Tests</h1>
          <Button onClick={runTests} disabled={running}>
            {running ? "Running Tests..." : "Run Tests"}
          </Button>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            {testResults.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Click "Run Tests" to execute functionality tests
              </div>
            ) : (
              <div className="space-y-4">
                {testResults.map((result, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex justify-between">
                      <h3 className="font-medium">{result.test}</h3>
                      <span className={`px-2 py-1 rounded text-xs ${
                        result.status === "passed" ? "bg-green-100 text-green-800" :
                        result.status === "failed" ? "bg-red-100 text-red-800" :
                        result.status === "running" ? "bg-yellow-100 text-yellow-800" :
                        "bg-gray-100 text-gray-800"
                      }`}>
                        {result.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {result.description}
                    </p>
                    {result.data && (
                      <div className="mt-2 text-xs bg-gray-50 p-2 rounded">
                        <pre>{JSON.stringify(result.data, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}