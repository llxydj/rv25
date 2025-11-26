"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Trash2, Edit, Plus, Phone, AlertCircle, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface EmergencyContact {
  id: string
  name: string
  number: string
  type: 'emergency' | 'fire' | 'police' | 'medical' | 'disaster' | 'admin' | 'utility'
  priority: number
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export function EmergencyContactsManager() {
  const [contacts, setContacts] = useState<EmergencyContact[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [editing, setEditing] = useState<EmergencyContact | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  
  const [formData, setFormData] = useState({
    name: '',
    number: '',
    type: 'emergency' as EmergencyContact['type'],
    priority: 1,
    description: '',
    is_active: true
  })

  useEffect(() => {
    fetchContacts()
  }, [])

  const fetchContacts = async () => {
    try {
      setError(null)
      const response = await fetch('/api/emergency-contacts')
      const result = await response.json()
      
      if (result.success) {
        setContacts(result.data)
      } else {
        setError(result.error || 'Failed to fetch contacts')
      }
    } catch (error) {
      console.error('Error fetching contacts:', error)
      setError('Failed to load emergency contacts. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const method = editing ? 'PUT' : 'POST'
      
      const response = await fetch('/api/emergency-contacts', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing ? { id: editing.id, ...formData } : formData)
      })

      const result = await response.json()
      
      if (result.success) {
        await fetchContacts()
        setShowForm(false)
        setEditing(null)
        resetForm()
        toast({
          title: editing ? 'Contact updated' : 'Contact created',
          description: `${formData.name} has been ${editing ? 'updated' : 'added'} successfully.`,
        })
      } else {
        setError(result.error || 'Failed to save contact')
      }
    } catch (error) {
      console.error('Error saving contact:', error)
      setError('Failed to save contact. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      number: '',
      type: 'emergency',
      priority: 1,
      description: '',
      is_active: true
    })
  }

  const handleEdit = (contact: EmergencyContact) => {
    setEditing(contact)
    setFormData({
      name: contact.name,
      number: contact.number,
      type: contact.type,
      priority: contact.priority,
      description: contact.description || '',
      is_active: contact.is_active
    })
    setShowForm(true)
    setError(null)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return

    try {
      const response = await fetch(`/api/emergency-contacts?id=${id}`, {
        method: 'DELETE'
      })

      const result = await response.json()
      
      if (result.success) {
        await fetchContacts()
        toast({
          title: 'Contact deleted',
          description: 'Emergency contact has been removed.',
        })
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to delete contact',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error deleting contact:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete contact. Please try again.',
        variant: 'destructive'
      })
    }
  }

  const getTypeColor = (type: string) => {
    const colors = {
      emergency: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      fire: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      police: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      medical: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      disaster: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      admin: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
      utility: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
    }
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading emergency contacts...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Emergency Contacts</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage emergency contact information for residents
          </p>
        </div>
        <Button onClick={() => { setShowForm(true); setError(null); }}>
          <Plus className="w-4 h-4 mr-2" />
          Add Contact
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editing ? 'Edit Contact' : 'Add New Contact'}</CardTitle>
            <CardDescription>
              {editing ? 'Update the emergency contact details below' : 'Fill in the details to create a new emergency contact'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    placeholder="Enter contact name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="number">Phone Number *</Label>
                  <Input
                    id="number"
                    type="tel"
                    placeholder="+1 234 567 8900"
                    value={formData.number}
                    onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                    required
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Type *</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value as EmergencyContact['type'] })}
                    disabled={submitting}
                  >
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="emergency">Emergency</SelectItem>
                      <SelectItem value="fire">Fire</SelectItem>
                      <SelectItem value="police">Police</SelectItem>
                      <SelectItem value="medical">Medical</SelectItem>
                      <SelectItem value="disaster">Disaster</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="utility">Utility</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority (1-10) *</Label>
                  <Input
                    id="priority"
                    type="number"
                    min="1"
                    max="10"
                    placeholder="1"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 1 })}
                    required
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Add any additional information..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  disabled={submitting}
                  rows={3}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  disabled={submitting}
                />
                <Label htmlFor="is_active" className="cursor-pointer">
                  Active (visible to residents)
                </Label>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editing ? 'Update' : 'Create'} Contact
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false)
                    setEditing(null)
                    resetForm()
                    setError(null)
                  }}
                  disabled={submitting}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {contacts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Phone className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">No emergency contacts yet</p>
            <p className="text-sm text-muted-foreground text-center mt-1">
              Click "Add Contact" to create your first emergency contact
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {contacts.map((contact) => (
            <Card key={contact.id}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-lg">{contact.name}</h3>
                      <Badge className={getTypeColor(contact.type)}>
                        {contact.type.toUpperCase()}
                      </Badge>
                      <Badge variant="outline">Priority: {contact.priority}</Badge>
                      {contact.is_active ? (
                        <Badge variant="default">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="w-4 h-4" />
                      <a 
                        href={`tel:${contact.number}`} 
                        className="hover:underline hover:text-foreground transition-colors"
                      >
                        {contact.number}
                      </a>
                    </div>
                    {contact.description && (
                      <p className="text-sm text-muted-foreground">{contact.description}</p>
                    )}
                  </div>
                  <div className="flex sm:flex-col gap-2 self-start">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(contact)}
                      className="flex-1 sm:flex-none"
                    >
                      <Edit className="w-4 h-4 sm:mr-0 mr-2" />
                      <span className="sm:hidden">Edit</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(contact.id)}
                      className="flex-1 sm:flex-none"
                    >
                      <Trash2 className="w-4 h-4 sm:mr-0 mr-2" />
                      <span className="sm:hidden">Delete</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}