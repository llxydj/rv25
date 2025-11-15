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
import { Trash2, Edit, Plus, Phone } from 'lucide-react'

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
  const [editing, setEditing] = useState<EmergencyContact | null>(null)
  const [showForm, setShowForm] = useState(false)
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
      const response = await fetch('/api/emergency-contacts')
      const result = await response.json()
      if (result.success) {
        setContacts(result.data)
      }
    } catch (error) {
      console.error('Error fetching contacts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const url = editing ? '/api/emergency-contacts' : '/api/emergency-contacts'
      const method = editing ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing ? { id: editing.id, ...formData } : formData)
      })

      const result = await response.json()
      if (result.success) {
        await fetchContacts()
        setShowForm(false)
        setEditing(null)
        setFormData({
          name: '',
          number: '',
          type: 'emergency' as EmergencyContact['type'],
          priority: 1,
          description: '',
          is_active: true
        })
      }
    } catch (error) {
      console.error('Error saving contact:', error)
    }
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
      }
    } catch (error) {
      console.error('Error deleting contact:', error)
    }
  }

  const getTypeColor = (type: string) => {
    const colors = {
      emergency: 'bg-red-100 text-red-800',
      fire: 'bg-orange-100 text-orange-800',
      police: 'bg-blue-100 text-blue-800',
      medical: 'bg-green-100 text-green-800',
      disaster: 'bg-purple-100 text-purple-800',
      admin: 'bg-gray-100 text-gray-800',
      utility: 'bg-yellow-100 text-yellow-800'
    }
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  if (loading) {
    return <div className="p-6">Loading emergency contacts...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Emergency Contacts</h2>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Contact
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editing ? 'Edit Contact' : 'Add New Contact'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="number">Phone Number</Label>
                  <Input
                    id="number"
                    value={formData.number}
                    onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="type">Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value as EmergencyContact['type'] })}
                  >
                    <SelectTrigger>
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
                <div>
                  <Label htmlFor="priority">Priority (1-10)</Label>
                  <Input
                    id="priority"
                    type="number"
                    min="1"
                    max="10"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>

              <div className="flex space-x-2">
                <Button type="submit">
                  {editing ? 'Update' : 'Create'} Contact
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false)
                    setEditing(null)
                    setFormData({
                      name: '',
                      number: '',
                      type: 'emergency',
                      priority: 1,
                      description: '',
                      is_active: true
                    })
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {contacts.map((contact) => (
          <Card key={contact.id}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{contact.name}</h3>
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
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="w-4 h-4" />
                    {contact.number}
                  </div>
                  {contact.description && (
                    <p className="text-sm text-gray-600">{contact.description}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(contact)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(contact.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

