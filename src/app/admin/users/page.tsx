"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, Download, Eye, User, Trash2, ChevronLeft, ChevronRight } from "lucide-react"
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
import Link from "next/link"

// Define user types
type UserRole = "admin" | "volunteer" | "resident" | "barangay"

interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  phone_number: string | null
  address: string | null
  role: UserRole
  barangay: string | null
  created_at: string
  status: "active" | "inactive"
  incident_count?: number
  auth_provider?: string // 'google' | 'email' | etc.
  last_sign_in_at?: string | null
}

interface PaginationMeta {
  total_count: number
  current_page: number
  per_page: number
  total_pages: number
}

export default function UserManagementPage() {
  const { user, loading: authLoading } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all")
  const [barangayFilter, setBarangayFilter] = useState<string | "all">("all")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all")
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

  const userStats = useMemo(() => {
    const total = users.length
    const active = users.filter((u) => u.status === "active").length
    const inactive = total - active
    const byRole = users.reduce(
      (acc, u) => {
        acc[u.role] = (acc[u.role] || 0) + 1
        return acc
      },
      { admin: 0, barangay: 0, resident: 0, volunteer: 0 } as Record<UserRole, number>,
    )
    const byProvider = users.reduce(
      (acc, u) => {
        const provider = u.auth_provider || 'email'
        acc[provider] = (acc[provider] || 0) + 1
        return acc
      },
      { google: 0, email: 0 } as Record<string, number>,
    )
    return { total, active, inactive, byRole, byProvider }
  }, [users])

  // Debounce search term to avoid too many API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500) // Wait 500ms after user stops typing

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch users with filters
  useEffect(() => {
    if (authLoading) return
    if (!user) return
    
    const fetchUsers = async () => {
      try {
        setLoading(true)
        
        // Build query params
        const params = new URLSearchParams({
          page: pagination.current_page.toString(),
          limit: pagination.per_page.toString(),
          ...(roleFilter !== "all" ? { role: roleFilter } : {}),
          ...(statusFilter !== "all" ? { status: statusFilter } : {}),
          ...(barangayFilter !== "all" ? { barangay: barangayFilter } : {}),
          ...(debouncedSearchTerm ? { search: debouncedSearchTerm } : {})
        })
        
        // ✅ FIXED: Added backticks for template literal
        const response = await fetch(`/api/admin/users?${params}`, {
          credentials: 'include'
        })
        const result = await response.json()
        
        console.log("Users API response:", {
          success: result.success,
          dataLength: result.data?.length,
          meta: result.meta,
          error: result.error
        })
        
        if (!result.success) {
          console.error("API returned error:", result)
          throw new Error(result.message || result.code || "Failed to fetch users")
        }
        
        // Check if data exists and is an array
        if (!result.data || !Array.isArray(result.data)) {
          console.warn("Invalid data format received:", result)
          setUsers([])
          setFilteredUsers([])
          setPagination({
            total_count: 0,
            current_page: 1,
            per_page: pagination.per_page,
            total_pages: 1
          })
          return
        }
        
        // Transform data to match our User interface
        const transformedUsers: User[] = result.data.map((user: any) => ({
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          phone_number: user.phone_number,
          address: user.address,
          role: user.role,
          barangay: user.barangay,
          created_at: user.created_at,
          status: user.status || "active",
          incident_count: user.incident_count
        }))
        
        console.log("Transformed users:", transformedUsers.length)
        
        setUsers(transformedUsers)
        setFilteredUsers(transformedUsers)
        setPagination(result.meta || {
          total_count: transformedUsers.length,
          current_page: pagination.current_page,
          per_page: pagination.per_page,
          total_pages: 1
        })
      } catch (error: any) {
        console.error("Error fetching users:", error)
        console.error("Error details:", {
          message: error.message,
          stack: error.stack
        })
        toast({
          title: "Error",
          description: error.message || "Failed to fetch users. Please check the console for details.",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }
    
    fetchUsers()
  }, [user, authLoading, pagination.current_page, pagination.per_page, roleFilter, statusFilter, barangayFilter, debouncedSearchTerm])
  
  // Fetch barangays separately (only once)
  useEffect(() => {
    if (authLoading) return
    if (!user) return
    
    const fetchBarangays = async () => {
      try {
        const response = await fetch("/api/admin/users?all=true", {
          credentials: 'include'
        })
        const result = await response.json()
        
        if (!result.success) throw new Error(result.message)
        
        // Extract unique barangays
        const uniqueBarangays = Array.from(
          new Set(result.data.map((user: User) => user.barangay).filter(Boolean))
        ).filter(Boolean) as string[]
        
        setBarangays(uniqueBarangays.sort())
      } catch (error: any) {
        console.error("Error fetching barangays:", error)
      }
    }
    
    fetchBarangays()
  }, [user, authLoading])
  
  // Filters are now applied server-side, so filteredUsers = users
  useEffect(() => {
    setFilteredUsers(users)
  }, [users])
  
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.total_pages) {
      setPagination(prev => ({
        ...prev,
        current_page: newPage
      }))
    }
  }
  
  // Reset to page 1 when filters change
  useEffect(() => {
    setPagination(prev => ({
      ...prev,
      current_page: 1
    }))
  }, [roleFilter, statusFilter, barangayFilter, debouncedSearchTerm])
  
  const handleViewUser = (userId: string) => {
    // ✅ FIXED: Added backticks for template literal
    window.location.href = `/admin/users/${userId}`
  }
  
  const handleDeactivateUser = (user: User) => {
    // ✅ FIXED: Added backticks for template literal
    if (window.confirm(`Are you sure you want to deactivate user ${user.first_name} ${user.last_name}? They will no longer be able to access the system.`)) {
      setUserToDeactivate(user)
      setDeactivateDialogOpen(true)
    }
  }
  
  const confirmDeactivateUser = async () => {
    if (!userToDeactivate) return
    
    try {
      const response = await fetch("/api/admin/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: 'include',
        body: JSON.stringify({
          userId: userToDeactivate.id,
          action: "deactivate"
        })
      })
      
      const result = await response.json()
      
      if (!result.success) throw new Error(result.message)
      
      // Update local state
      setUsers(users.map(u => 
        u.id === userToDeactivate.id ? { ...u, status: "inactive" as const } : u
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
      const response = await fetch("/api/admin/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: 'include',
        body: JSON.stringify({
          userId,
          action: "activate"
        })
      })
      
      const result = await response.json()
      
      if (!result.success) throw new Error(result.message)
      
      // Update local state
      setUsers(users.map(user => 
        user.id === userId ? { ...user, status: "active" as const } : user
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
    // ✅ FIXED: Added backticks for template literal
    if (window.confirm(`Are you sure you want to deactivate and anonymize user ${user.first_name} ${user.last_name}? This action cannot be undone.`)) {
      setUserToDelete(user)
      setDeleteDialogOpen(true)
    }
  }
  
  const confirmDeleteUser = async () => {
    if (!userToDelete) return
    
    try {
      const response = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: 'include',
        body: JSON.stringify({
          userId: userToDelete.id
        })
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
      const { generateEnhancedCSV } = await import('@/lib/enhanced-csv-export')
      
      const headers = [
        "Name",
        "Email",
        "Role",
        "Barangay",
        "Registration Date",
        "Status",
        "Incident Count"
      ]
      
      const csvData = filteredUsers.map(user => ({
        "Name": `${user.first_name} ${user.last_name}`,
        "Email": user.email,
        "Role": user.role,
        "Barangay": user.barangay || "",
        "Registration Date": new Date(user.created_at).toLocaleDateString(),
        "Status": user.status,
        "Incident Count": user.incident_count || 0
      }))
      
      const csvContent = generateEnhancedCSV(csvData, headers, {
        organizationName: 'RVOIS - Rescue Volunteers Operations Information System',
        reportTitle: 'Resident User Report',
        includeMetadata: true,
        includeSummary: true
      })
      
      // Add BOM for Excel compatibility
      const BOM = '\uFEFF'
      const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.setAttribute("href", url)
      link.setAttribute("download", `resident_users_${new Date().toISOString().split("T")[0]}.csv`)
      link.style.visibility = "hidden"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      toast({
        title: "Success",
        description: "CSV file downloaded successfully"
      })
    } catch (error: any) {
      console.error("Error exporting CSV:", error)
      toast({
        title: "Error",
        description: "Failed to export CSV file",
        variant: "destructive"
      })
    }
  }
  
  // Show loading while auth is loading
  if (authLoading || loading) {
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
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <div className="flex space-x-2 mt-4 md:mt-0">
            <Link href="/admin/users/new">
              <Button>
                <User className="mr-2 h-4 w-4" />
                New User
              </Button>
            </Link>
            <Link href="/admin/users/new-admin">
              <Button variant="secondary">
                <User className="mr-2 h-4 w-4" />
                New Admin
              </Button>
            </Link>
            <Button onClick={handleExportCSV}>
              <Download className="mr-2 h-4 w-4" />
              Export to CSV
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Users</CardDescription>
              <CardTitle className="text-3xl">{userStats.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active</CardDescription>
              <CardTitle className="text-3xl text-green-600">{userStats.active}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Inactive</CardDescription>
              <CardTitle className="text-3xl text-yellow-600">{userStats.inactive}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>By Role</CardDescription>
              <div className="flex flex-wrap gap-2 mt-2">
                {(["admin", "barangay", "volunteer", "resident"] as UserRole[]).map((role) => (
                  <Badge key={role} variant="secondary">
                    {role.charAt(0).toUpperCase() + role.slice(1)} · {userStats.byRole[role] || 0}
                  </Badge>
                ))}
              </div>
            </CardHeader>
          </Card>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>By Provider</CardDescription>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="outline">
                  🔵 Google · {userStats.byProvider.google || 0}
                </Badge>
                <Badge variant="outline">
                  📧 Email · {userStats.byProvider.email || 0}
                </Badge>
              </div>
            </CardHeader>
          </Card>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>User List</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <div className="relative sm:col-span-2 lg:col-span-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search by name or email"
                  className="pl-8 text-sm sm:text-base min-h-[2.5rem]"
                  value={searchTerm}
                  onChange={(e) => {
                    e.preventDefault()
                    setSearchTerm(e.target.value)
                  }}
                  onKeyDown={(e) => {
                    // Prevent form submission if inside a form
                    if (e.key === 'Enter') {
                      e.preventDefault()
                    }
                  }}
                />
              </div>
              
              <Select value={roleFilter} onValueChange={(value: UserRole | "all") => setRoleFilter(value)}>
                <SelectTrigger className="text-sm sm:text-base min-h-[2.5rem] touch-manipulation">
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
                <SelectTrigger className="text-sm sm:text-base min-h-[2.5rem] touch-manipulation">
                  <SelectValue placeholder="Filter by barangay" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Barangays</SelectItem>
                  {barangays.map(barangay => (
                    <SelectItem key={barangay} value={barangay}>{barangay}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={statusFilter} onValueChange={(value: "all" | "active" | "inactive") => setStatusFilter(value)}>
                <SelectTrigger className="text-sm sm:text-base min-h-[2.5rem] touch-manipulation">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              
            </div>
            
            {/* User Table */}
            <div className="rounded-md border overflow-hidden">
              {/* Mobile Card View */}
              <div className="md:hidden divide-y">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <div key={user.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-gray-900 truncate">
                            {user.first_name} {user.last_name}
                          </h3>
                          <p className="text-xs text-gray-500 truncate mt-1">{user.email}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          <Badge variant={
                            user.role === "admin" ? "default" :
                            user.role === "volunteer" ? "secondary" :
                            user.role === "barangay" ? "outline" : "destructive"
                          } className="text-xs">
                            {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                          </Badge>
                          <Badge variant={user.status === "active" ? "default" : "destructive"} className="text-xs">
                            {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                          </Badge>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-500">Barangay:</span>
                          <span className="text-gray-900 ml-1">{user.barangay || "-"}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Registered:</span>
                          <span className="text-gray-900 ml-1">{new Date(user.created_at).toLocaleDateString()}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Provider:</span>
                          <Badge variant="outline" className="ml-1 text-xs">
                            {user.auth_provider === 'google' ? '🔵 Google' : '📧 Email'}
                          </Badge>
                        </div>
                        <div>
                          <span className="text-gray-500">Last Sign-in:</span>
                          <span className="text-gray-900 ml-1">
                            {user.last_sign_in_at 
                              ? new Date(user.last_sign_in_at).toLocaleDateString() 
                              : 'Never'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Phone:</span>
                          <span className="text-gray-900 ml-1">{user.phone_number || "N/A"}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-gray-500">Address:</span>
                          <span className="text-gray-900 ml-1">{user.address || "—"}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-2 border-t">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleViewUser(user.id)}
                          className="flex-1 touch-manipulation min-h-[2.5rem]"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        {user.status === "active" ? (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleDeactivateUser(user)}
                            className="flex-1 touch-manipulation min-h-[2.5rem]"
                          >
                            <User className="h-4 w-4 mr-1" />
                            Deactivate
                          </Button>
                        ) : (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleActivateUser(user.id)}
                            className="flex-1 touch-manipulation min-h-[2.5rem]"
                          >
                            <User className="h-4 w-4 mr-1" />
                            Activate
                          </Button>
                        )}
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDeleteUser(user)}
                          className="flex-1 touch-manipulation min-h-[2.5rem]"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No users found
                  </div>
                )}
              </div>
              
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Last Sign-in</TableHead>
                      <TableHead>Phone</TableHead>
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
                            <Badge variant="outline" className="text-xs">
                              {user.auth_provider === 'google' ? '🔵 Google' : '📧 Email'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {user.last_sign_in_at 
                              ? new Date(user.last_sign_in_at).toLocaleString() 
                              : 'Never'}
                          </TableCell>
                          <TableCell>{user.phone_number || "N/A"}</TableCell>
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
                                className="touch-manipulation"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {user.status === "active" ? (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleDeactivateUser(user)}
                                  className="touch-manipulation"
                                >
                                  <User className="h-4 w-4" />
                                </Button>
                              ) : (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleActivateUser(user.id)}
                                  className="touch-manipulation"
                                >
                                  <User className="h-4 w-4" />
                                </Button>
                              )}
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleDeleteUser(user)}
                                className="touch-manipulation"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8">
                          No users found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
            
            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
              <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
                Showing {(pagination.current_page - 1) * pagination.per_page + 1} to {Math.min(pagination.current_page * pagination.per_page, pagination.total_count)} of {pagination.total_count} entries
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.current_page - 1)}
                  disabled={pagination.current_page === 1}
                  className="touch-manipulation min-h-[2.5rem] min-w-[5rem]"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Previous</span>
                </Button>
                <div className="text-xs sm:text-sm px-2">
                  Page {pagination.current_page} of {pagination.total_pages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.current_page + 1)}
                  disabled={pagination.current_page === pagination.total_pages}
                  className="touch-manipulation min-h-[2.5rem] min-w-[5rem]"
                >
                  <span className="hidden sm:inline">Next</span>
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