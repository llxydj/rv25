"use client"

import { useState, useEffect } from "react"
import { AdminLayout } from "@/components/layout/admin-layout"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { Search, Filter, Download, Eye, User, Trash2, ChevronLeft, ChevronRight } from "lucide-react"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { supabase } from "@/lib/supabase"

// Define user types
type UserRole = "admin" | "volunteer" | "resident" | "barangay"

interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  role: UserRole
  barangay: string | null
  created_at: string
  status: "active" | "inactive"
  incident_count?: number
}

interface PaginationMeta {
  total_count: number
  current_page: number
  per_page: number
  total_pages: number
}

export default function UserManagementPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all")
  const [barangayFilter, setBarangayFilter] = useState<string | "all">("all")
  const [barangays, setBarangays] = useState<string[]>([])
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<User | null>(null)
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false)
  const [userToDeactivate, setUserToDeactivate] = useState<User | null>(null)
  const [pagination, setPagination] = useState<PaginationMeta>({
    total_count: 0,
    current_page: 1,
    per_page: 20,
    total_pages: 1
  })

  // Fetch users and barangays
  useEffect(() => {
    if (!user) return
    
    const fetchUsers = async () => {
      try {
        setLoading(true)
        // Get access token for authenticated requests
        const { data: { session } } = await supabase.auth.getSession()
        const accessToken = session?.access_token
        
        const response = await fetch(`/api/admin/users?page=${pagination.current_page}&limit=${pagination.per_page}`, {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
          credentials: 'include',
          cache: 'no-store'
        })
        const result = await response.json()
        
        if (!result.success) throw new Error(result.message)
        
        // Transform data to match our User interface
        const transformedUsers: User[] = result.data.map((user: any) => ({
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role,
          barangay: user.barangay,
          created_at: user.created_at,
          status: user.status || "active",
          incident_count: user.incident_count
        }))
        
        setUsers(transformedUsers)
        setFilteredUsers(transformedUsers)
        setPagination(result.meta)
      } catch (error: any) {
        console.error("Error fetching users:", error)
        toast({
          title: "Error",
          description: "Failed to fetch users",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }
    
    const fetchBarangays = async () => {
      try {
        // Get access token for authenticated requests
        const { data: { session } } = await supabase.auth.getSession()
        const accessToken = session?.access_token
        
        // For simplicity, we'll fetch all users to get barangays
        // In a production app, you might want a separate endpoint for this
        const response = await fetch("/api/admin/users", {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
          credentials: 'include',
          cache: 'no-store'
        })
        const result = await response.json()
        
        if (!result.success) throw new Error(result.message)
        
        // Extract unique barangays
        const uniqueBarangays = Array.from(
          new Set(result.data.map((user: User) => user.barangay).filter(Boolean))
        ).filter(Boolean) as string[]
        
        setBarangays(uniqueBarangays)
      } catch (error: any) {
        console.error("Error fetching barangays:", error)
        toast({
          title: "Error",
          description: "Failed to fetch barangays",
          variant: "destructive"
        })
      }
    }
    
    fetchUsers()
    fetchBarangays()
  }, [user, pagination.current_page, pagination.per_page])
  
  // Apply filters
  useEffect(() => {
    let result = [...users]
    
    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(user => 
        user.first_name.toLowerCase().includes(term) ||
        user.last_name.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term)
      )
    }
    
    // Apply role filter
    if (roleFilter !== "all") {
      result = result.filter(user => user.role === roleFilter)
    }
    
    // Apply barangay filter
    if (barangayFilter !== "all") {
      result = result.filter(user => user.barangay === barangayFilter)
    }
    
    setFilteredUsers(result)
  }, [searchTerm, roleFilter, barangayFilter, users])
  
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.total_pages) {
      setPagination({
        ...pagination,
        current_page: newPage
      })
    }
  }
  
  const handleViewUser = (userId: string) => {
    // Navigate to user details page
    window.location.href = `/admin/users/${userId}`
  }
  
  const handleDeactivateUser = (user: User) => {
    // Add confirmation prompt before deactivation
    if (window.confirm(`Are you sure you want to deactivate user ${user.first_name} ${user.last_name}? They will no longer be able to access the system.`)) {
      setUserToDeactivate(user)
      setDeactivateDialogOpen(true)
    }
  }
  
  const confirmDeactivateUser = async () => {
    if (!userToDeactivate) return
    
    try {
      // Get access token for authenticated requests
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token
      
      const response = await fetch("/api/admin/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({
          userId: userToDeactivate.id,
          action: "deactivate"
        }),
        credentials: 'include',
        cache: 'no-store'
      })
      
      const result = await response.json()
      
      if (!result.success) throw new Error(result.message)
      
      // Update local state
      setUsers(users.map(u => 
        u.id === userToDeactivate.id ? { ...u, status: "inactive" } : u
      ))
      
      toast({
        title: "Success",
        description: "User deactivated successfully"
      })
    } catch (error: any) {
      console.error("Error deactivating user:", error)
      toast({
        title: "Error",
        description: "Failed to deactivate user",
        variant: "destructive"
      })
    } finally {
      setDeactivateDialogOpen(false)
      setUserToDeactivate(null)
    }
  }
  
  const handleActivateUser = async (userId: string) => {
    try {
      // Get access token for authenticated requests
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token
      
      const response = await fetch("/api/admin/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({
          userId,
          action: "activate"
        }),
        credentials: 'include',
        cache: 'no-store'
      })
      
      const result = await response.json()
      
      if (!result.success) throw new Error(result.message)
      
      // Update local state
      setUsers(users.map(user => 
        user.id === userId ? { ...user, status: "active" } : user
      ))
      
      toast({
        title: "Success",
        description: "User activated successfully"
      })
    } catch (error: any) {
      console.error("Error activating user:", error)
      toast({
        title: "Error",
        description: "Failed to activate user",
        variant: "destructive"
      })
    }
  }
  
  const handleDeleteUser = (user: User) => {
    // Add confirmation prompt before deletion
    if (window.confirm(`Are you sure you want to deactivate and anonymize user ${user.first_name} ${user.last_name}? This action cannot be undone.`)) {
      setUserToDelete(user)
      setDeleteDialogOpen(true)
    }
  }
  
  const confirmDeleteUser = async () => {
    if (!userToDelete) return
    
    try {
      // Get access token for authenticated requests
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token
      
      const response = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({
          userId: userToDelete.id
        }),
        credentials: 'include',
        cache: 'no-store'
      })
      
      const result = await response.json()
      
      if (!result.success) throw new Error(result.message)
      
      // Update local state
      setUsers(users.filter(u => u.id !== userToDelete.id))
      
      toast({
        title: "Success",
        description: "User deactivated and data anonymized successfully"
      })
    } catch (error: any) {
      console.error("Error deleting user:", error)
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "destructive"
      })
    } finally {
      setDeleteDialogOpen(false)
      setUserToDelete(null)
    }
  }
  
  const handleExportCSV = async () => {
    try {
      // Create CSV content with proper formatting
      const orgName = "Talisay City Emergency Response System"
      const reportDate = new Date().toLocaleDateString()
      const reportTitle = "Resident User Report"
      
      const headers = [
        "Name",
        "Email",
        "Role",
        "Barangay",
        "Registration Date",
        "Status",
        "Incident Count"
      ];
      
      const csvContent = [
        `"${orgName}"`,
        `"${reportTitle}"`,
        `"Generated: ${reportDate}"`,
        "", // Empty line
        headers.join(","),
        ...filteredUsers.map(user => [
          `"${user.first_name} ${user.last_name}"`,
          `"${user.email}"`,
          `"${user.role}"`,
          `"${user.barangay || ""}"`,
          `"${new Date(user.created_at).toLocaleDateString()}"`,
          `"${user.status}"`,
          `"${user.incident_count || 0}"`
        ].join(","))
      ].join("\n");
      
      // Create blob and download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `resident_users_${new Date().toISOString().split("T")[0]}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Success",
        description: "CSV file downloaded successfully"
      });
    } catch (error: any) {
      console.error("Error exporting CSV:", error);
      toast({
        title: "Error",
        description: "Failed to export CSV file",
        variant: "destructive"
      });
    }
  };
  
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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl font-bold text-black">User Management</h1>
          <Button className="mt-4 md:mt-0" onClick={handleExportCSV}>
            <Download className="mr-2 h-4 w-4" />
            Export to CSV
          </Button>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>User List</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email"
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <Select value={roleFilter} onValueChange={(value: UserRole | "all") => setRoleFilter(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="barangay">Barangay</SelectItem>
                  <SelectItem value="volunteer">Volunteer</SelectItem>
                  <SelectItem value="resident">Resident</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={barangayFilter} onValueChange={(value: string | "all") => setBarangayFilter(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by barangay" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Barangays</SelectItem>
                  {barangays.map(barangay => (
                    <SelectItem key={barangay} value={barangay}>{barangay}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button variant="outline">
                <Filter className="mr-2 h-4 w-4" />
                Apply Filters
              </Button>
            </div>
            
            {/* User Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Barangay</TableHead>
                    <TableHead>Registration Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.first_name} {user.last_name}
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant={
                            user.role === "admin" ? "default" :
                            user.role === "volunteer" ? "secondary" :
                            user.role === "barangay" ? "outline" : "destructive"
                          }>
                            {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>{user.barangay || "-"}</TableCell>
                        <TableCell>
                          {new Date(user.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.status === "active" ? "default" : "destructive"}>
                            {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleViewUser(user.id)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {user.status === "active" ? (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleDeactivateUser(user)}
                              >
                                <User className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleActivateUser(user.id)}
                              >
                                <User className="h-4 w-4" />
                              </Button>
                            )}
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleDeleteUser(user)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        No users found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            
            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {(pagination.current_page - 1) * pagination.per_page + 1} to {Math.min(pagination.current_page * pagination.per_page, pagination.total_count)} of {pagination.total_count} entries
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.current_page - 1)}
                  disabled={pagination.current_page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <div className="text-sm">
                  Page {pagination.current_page} of {pagination.total_pages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.current_page + 1)}
                  disabled={pagination.current_page === pagination.total_pages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Deactivate Confirmation Dialog */}
      <AlertDialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate this user? They will no longer be able to access the system, 
              but their account and data will remain in the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeactivateUser}>Deactivate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate and Anonymize User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate this user? This will:
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Deactivate their account</li>
                <li>Anonymize their personal information</li>
                <li>Remove their association from reported incidents</li>
                <li>Log this action in the audit trail</li>
              </ul>
              <p className="mt-2 font-medium">This action cannot be undone.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteUser} className="bg-destructive hover:bg-destructive/90">
              Deactivate and Anonymize
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  )
}