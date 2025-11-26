"use client"

import { useState, useEffect } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabase"

interface DataQualityStats {
  totalIncidents: number
  legacyIncidents: number
  currentIncidents: number
  migrationProgress: number
}

export function DataQualityDashboard() {
  const [stats, setStats] = useState<DataQualityStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchDataQualityStats = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Get total incidents
        const { count: totalIncidents, error: totalCountError } = await supabase
          .from('incidents')
          .select('*', { count: 'exact', head: true })
          
        if (totalCountError) throw totalCountError
        
        // Get legacy incidents (those without photo_urls array)
        const { count: legacyIncidents, error: legacyCountError } = await supabase
          .from('incidents')
          .select('*', { count: 'exact', head: true })
          .or('photo_urls.is.null,photo_urls.eq.{}')
          
        if (legacyCountError) throw legacyCountError
        
        // Calculate current format incidents
        const currentIncidents = (totalIncidents || 0) - (legacyIncidents || 0)
        
        // Calculate migration progress percentage
        const migrationProgress = totalIncidents && totalIncidents > 0 ? 
          Math.round(((totalIncidents - (legacyIncidents || 0)) / totalIncidents) * 100) : 100
          
        setStats({
          totalIncidents: totalIncidents || 0,
          legacyIncidents: legacyIncidents || 0,
          currentIncidents: currentIncidents,
          migrationProgress
        })
      } catch (error: any) {
        console.error("Error fetching data quality stats:", error)
        setError(error.message || "Failed to load data quality statistics")
      } finally {
        setLoading(false)
      }
    }
    
    fetchDataQualityStats()
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Data Quality Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Loading data quality statistics...</p>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Data Quality Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-500">Error: {error}</p>
        </CardContent>
      </Card>
    )
  }

  if (!stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Data Quality Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Unable to load data quality statistics.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Data Quality Dashboard</span>
          {stats.migrationProgress < 100 && (
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
              Migration in Progress
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Incidents</p>
            <p className="text-2xl font-bold">{stats.totalIncidents}</p>
          </div>
          
          <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
            <p className="text-sm text-blue-700 dark:text-blue-300">Current Format</p>
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{stats.currentIncidents}</p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              {stats.migrationProgress}% migrated
            </p>
          </div>
          
          <div className="bg-yellow-50 dark:bg-yellow-950 p-4 rounded-lg">
            <p className="text-sm text-yellow-700 dark:text-yellow-300">Legacy Format</p>
            <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{stats.legacyIncidents}</p>
            <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
              {stats.legacyIncidents > 0 ? "Requires migration" : "Fully migrated"}
            </p>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
            <p className="text-sm text-gray-500 dark:text-gray-400">Migration Progress</p>
            <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2.5 mt-2">
              <div 
                className="bg-blue-600 h-2.5 rounded-full" 
                style={{ width: `${stats.migrationProgress}%` }}
              ></div>
            </div>
            <p className="text-sm font-medium mt-1">{stats.migrationProgress}% Complete</p>
          </div>
        </div>
        
        {stats.legacyIncidents > 0 && (
          <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-md border border-yellow-200 dark:border-yellow-800">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>Action Required:</strong> {stats.legacyIncidents} incidents are using the legacy data format. 
              Run the migration script to convert them to the current format for better consistency and reliability.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}