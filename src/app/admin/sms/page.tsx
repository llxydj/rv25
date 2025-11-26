// src/app/admin/sms/page.tsx

"use client"

import React, { useState, useEffect } from 'react'
import { Card, Button, LoadingSpinner, ErrorState, DataTable, FormField } from '@/components/ui/enhanced-components'
import { SMSMonitoringDashboard } from '@/components/admin/sms-monitoring-dashboard'

interface SMSTemplate {
  id: string
  code: string
  name: string
  content: string
  variables: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export default function SMSManagementPage() {
  const [activeTab, setActiveTab] = useState<'monitoring' | 'templates' | 'config'>('monitoring')
  const [templates, setTemplates] = useState<SMSTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingTemplate, setEditingTemplate] = useState<SMSTemplate | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)

  useEffect(() => {
    if (activeTab === 'templates') {
      fetchTemplates()
    }
  }, [activeTab])

  const fetchTemplates = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/sms/templates')
      const result = await response.json()

      if (result.success) {
        setTemplates(result.data)
      } else {
        setError(result.message || 'Failed to fetch templates')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch templates')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTemplate = async (templateData: Partial<SMSTemplate>) => {
    try {
      const response = await fetch('/api/sms/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateData)
      })

      const result = await response.json()

      if (result.success) {
        setTemplates(prev => [result.data, ...prev])
        setShowCreateForm(false)
        alert('Template created successfully')
      } else {
        alert(result.message || 'Failed to create template')
      }
    } catch (err: any) {
      alert(`Error creating template: ${err.message}`)
    }
  }

  const handleUpdateTemplate = async (templateData: Partial<SMSTemplate>) => {
    try {
      const response = await fetch('/api/sms/templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateData)
      })

      const result = await response.json()

      if (result.success) {
        setTemplates(prev => 
          prev.map(t => t.id === templateData.id ? result.data : t)
        )
        setEditingTemplate(null)
        alert('Template updated successfully')
      } else {
        alert(result.message || 'Failed to update template')
      }
    } catch (err: any) {
      alert(`Error updating template: ${err.message}`)
    }
  }

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return

    try {
      const response = await fetch(`/api/sms/templates?id=${templateId}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (result.success) {
        setTemplates(prev => prev.filter(t => t.id !== templateId))
        alert('Template deleted successfully')
      } else {
        alert(result.message || 'Failed to delete template')
      }
    } catch (err: any) {
      alert(`Error deleting template: ${err.message}`)
    }
  }

  const templateColumns = [
    {
      key: 'code',
      label: 'Code',
      render: (value: string) => (
        <span className="font-mono text-sm font-medium text-blue-600">
          {value}
        </span>
      )
    },
    {
      key: 'name',
      label: 'Name',
      render: (value: string) => (
        <span className="text-sm font-medium text-gray-900">
          {value}
        </span>
      )
    },
    {
      key: 'content',
      label: 'Content',
      render: (value: string) => (
        <span className="text-sm text-gray-600 truncate max-w-xs" title={value}>
          {value}
        </span>
      )
    },
    {
      key: 'variables',
      label: 'Variables',
      render: (value: string[]) => (
        <div className="flex flex-wrap gap-1">
          {value.map((variable, index) => (
            <span
              key={index}
              className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded"
            >
              {variable}
            </span>
          ))}
        </div>
      )
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (value: boolean) => (
        <span className={`px-2 py-1 text-xs rounded ${
          value ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
        }`}>
          {value ? 'Active' : 'Inactive'}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (value: any, row: SMSTemplate) => (
        <div className="flex space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditingTemplate(row)}
          >
            Edit
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => handleDeleteTemplate(row.id)}
          >
            Delete
          </Button>
        </div>
      )
    }
  ]

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">SMS Management</h1>
        <div className="flex space-x-2">
          <Button
            variant={activeTab === 'monitoring' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('monitoring')}
          >
            Monitoring
          </Button>
          <Button
            variant={activeTab === 'templates' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('templates')}
          >
            Templates
          </Button>
          <Button
            variant={activeTab === 'config' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('config')}
          >
            Configuration
          </Button>
        </div>
      </div>

      {activeTab === 'monitoring' && <SMSMonitoringDashboard />}

      {activeTab === 'templates' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">SMS Templates</h2>
            <Button
              variant="primary"
              size="md"
              onClick={() => setShowCreateForm(true)}
            >
              Create Template
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner size="lg" text="Loading templates..." />
            </div>
          ) : error ? (
            <ErrorState
              title="Failed to load templates"
              message={error}
              onRetry={fetchTemplates}
            />
          ) : (
            <DataTable
              data={templates}
              columns={templateColumns}
              emptyMessage="No SMS templates found"
            />
          )}

          {/* Create Template Form */}
          {showCreateForm && (
            <TemplateForm
              onSubmit={handleCreateTemplate}
              onCancel={() => setShowCreateForm(false)}
            />
          )}

          {/* Edit Template Form */}
          {editingTemplate && (
            <TemplateForm
              template={editingTemplate}
              onSubmit={handleUpdateTemplate}
              onCancel={() => setEditingTemplate(null)}
            />
          )}
        </div>
      )}

      {activeTab === 'config' && (
        <Card variant="elevated" padding="lg">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">SMS Configuration</h2>
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">
                    Configuration Required
                  </h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p>SMS configuration is managed through environment variables. Please ensure the following are set:</p>
                    <ul className="mt-2 list-disc list-inside space-y-1">
                      <li><code className="bg-yellow-100 px-1 rounded">SMS_ENABLED=true</code></li>
                      <li><code className="bg-yellow-100 px-1 rounded">SMS_API_KEY=your_api_key</code></li>
                      <li><code className="bg-yellow-100 px-1 rounded">SMS_API_URL=https://sms.iprogtech.com/</code></li>
                      <li><code className="bg-yellow-100 px-1 rounded">SMS_SENDER=iprogsms</code></li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

// Template Form Component
interface TemplateFormProps {
  template?: SMSTemplate
  onSubmit: (data: Partial<SMSTemplate>) => void
  onCancel: () => void
}

const TemplateForm: React.FC<TemplateFormProps> = ({ template, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    code: template?.code || '',
    name: template?.name || '',
    content: template?.content || '',
    variables: template?.variables || [],
    is_active: template?.is_active ?? true
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.code || !formData.name || !formData.content) {
      alert('Please fill in all required fields')
      return
    }

    onSubmit({
      ...formData,
      id: template?.id
    })
  }

  const addVariable = () => {
    const variable = prompt('Enter variable name (e.g., "ref", "type", "barangay"):')
    if (variable && !formData.variables.includes(variable)) {
      setFormData(prev => ({
        ...prev,
        variables: [...prev.variables, variable]
      }))
    }
  }

  const removeVariable = (variable: string) => {
    setFormData(prev => ({
      ...prev,
      variables: prev.variables.filter(v => v !== variable)
    }))
  }

  return (
    <Card variant="elevated" padding="lg">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        {template ? 'Edit Template' : 'Create Template'}
      </h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Template Code" required>
          <input
            type="text"
            value={formData.code}
            onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
            placeholder="TEMPLATE_INCIDENT_CONFIRM"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
            disabled={!!template}
          />
        </FormField>

        <FormField label="Template Name" required>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Incident Confirmation"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </FormField>

        <FormField label="Message Content" required>
          <textarea
            value={formData.content}
            onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
            placeholder="[RVOIS CONFIRM] Report #{{ref}} received | {{barangay}} | {{time}} | Thank you for reporting."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </FormField>

        <FormField label="Variables">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {formData.variables.map((variable, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
                >
                  {variable}
                  <button
                    type="button"
                    onClick={() => removeVariable(variable)}
                    className="ml-2 text-blue-600 hover:text-blue-800"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addVariable}
            >
              Add Variable
            </Button>
          </div>
        </FormField>

        <FormField label="Status">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
              className="mr-2"
            />
            Active
          </label>
        </FormField>

        <div className="flex justify-end space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
          >
            {template ? 'Update' : 'Create'} Template
          </Button>
        </div>
      </form>
    </Card>
  )
}
