"use client"

import { useState, useEffect } from "react"
import { AdminLayout } from "@/components/layout/admin-layout"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabase"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface AuditLog {
  id: string
  action: string
  details: string
  user_id: string
  created_at: string
  user_email?: string
}

export default function UserAuditLogPage() {
  const { user } = useAuth()
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Fetch audit logs
  useEffect(() => {
    if (!user) return
    
    const fetchAuditLogs = async () => {
      try {
        setLoading(true)
        
        // Fetch audit logs related to user management
        const { data, error, count } = await supabase
          .from("system_logs")
          .select("*", { count: "exact" })
          .or("action.eq.USER_DEACTIVATED,action.eq.USER_ACTIVATED,action.eq.USER_SOFT_DELETED")
          .order("created_at", { ascending: false })
          .range((currentPage - 1) * 20, currentPage * 20 - 1)
        
        if (error) throw error
        
        // Get user emails for display
        const userIds = Array.from(new Set(data.map(log => log.user_id)))
        const { data: usersData, error: usersError } = await supabase
          .from("users")
          .select("id, email")
          .in("id", userIds)
        
        if (usersError) throw usersError
        
        // Merge user emails with audit logs
        const logsWithEmails = data.map(log => {
          const user = usersData.find(u => u.id === log.user_id)
          return {
            ...log,
            user_email: user?.email || "Unknown User"
          }
        })
        
        setAuditLogs(logsWithEmails)
        setTotalPages(Math.ceil((count || 0) / 20))
      } catch (error) {
        console.error("Error fetching audit logs:", error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchAuditLogs()
  }, [user, currentPage])
  
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage)
    }
  }
  
  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </AdminLayout>
    )
  }
  
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-black">User Management Audit Log</h1>
          <p className="text-muted-foreground">Track all user deactivation and deletion activities</p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Audit Trail</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Audit Log Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Performed By</TableHead>
                    <TableHead>Date & Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.length > 0 ? (
                    auditLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <Badge variant={
                            log.action === "USER_DEACTIVATED" ? "destructive" :
                            log.action === "USER_ACTIVATED" ? "default" : "outline"
                          }>
                            {log.action.replace("USER_", "").replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-md">
                          <div className="text-sm">{log.details}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{log.user_email}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {new Date(log.created_at).toLocaleString()}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        No audit logs found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            
            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {(currentPage - 1) * 20 + 1} to {Math.min(currentPage * 20, auditLogs.length)} of {auditLogs.length} entries
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <div className="text-sm">
                  Page {currentPage} of {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}