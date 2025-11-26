"use client"

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'

interface NotificationPreferences {
  push_enabled: boolean
  sms_enabled: boolean
  email_enabled: boolean
  incident_alerts: boolean
  status_updates: boolean
  escalation_alerts: boolean
  training_reminders: boolean
  sound_enabled: boolean
  vibration_enabled: boolean
  quiet_hours_start?: string
  quiet_hours_end?: string
}

export function NotificationPreferencesComponent() {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    push_enabled: true,
    sms_enabled: false,
    email_enabled: true,
    incident_alerts: true,
    status_updates: true,
    escalation_alerts: true,
    training_reminders: true,
    sound_enabled: true,
    vibration_enabled: true,
    quiet_hours_start: '22:00',
    quiet_hours_end: '07:00'
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    loadPreferences()
  }, [])

  const loadPreferences = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (data && !error) {
        setPreferences(data)
      }
    } catch (err: any) {
      console.error('Error loading preferences:', err)
      setError('Failed to load notification preferences')
    } finally {
      setLoading(false)
    }
  }

  const savePreferences = async () => {
    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('User not authenticated')
        return
      }

      const { error } = await (supabase as any)
        .from('notification_preferences')
        .upsert({
          user_id: user.id,
          ...preferences,
          updated_at: new Date().toISOString()
        } as any, {
          onConflict: 'user_id'
        } as any)

      if (error) throw error

      setSuccess('Notification preferences saved successfully')
      toast({
        title: "Success",
        description: "Notification preferences saved successfully",
      })
    } catch (err: any) {
      console.error('Error saving preferences:', err)
      setError(err.message || 'Failed to save preferences')
      toast({
        title: "Error",
        description: err.message || 'Failed to save preferences',
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleInputChange = (field: keyof NotificationPreferences, value: any) => {
    setPreferences(prev => ({
      ...prev,
      [field]: value
    }))
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading preferences...</span>
      </div>
    )
  }

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Notification Preferences</h2>
      
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      
      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-600">{success}</p>
        </div>
      )}

      <div className="space-y-6">
        {/* Notification Channels */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Notification Channels</h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium text-gray-700">Push Notifications</Label>
                <p className="text-xs text-gray-500">Browser notifications</p>
              </div>
              <Switch
                checked={preferences.push_enabled}
                onCheckedChange={(checked) => handleInputChange('push_enabled', checked)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium text-gray-700">SMS Notifications</Label>
                <p className="text-xs text-gray-500">Text messages to your phone</p>
              </div>
              <Switch
                checked={preferences.sms_enabled}
                onCheckedChange={(checked) => handleInputChange('sms_enabled', checked)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium text-gray-700">Email Notifications</Label>
                <p className="text-xs text-gray-500">Email alerts</p>
              </div>
              <Switch
                checked={preferences.email_enabled}
                onCheckedChange={(checked) => handleInputChange('email_enabled', checked)}
              />
            </div>
          </div>
        </div>

        {/* Notification Types */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Notification Types</h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-gray-700">Incident Alerts</Label>
              <Switch
                checked={preferences.incident_alerts}
                onCheckedChange={(checked) => handleInputChange('incident_alerts', checked)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-gray-700">Status Updates</Label>
              <Switch
                checked={preferences.status_updates}
                onCheckedChange={(checked) => handleInputChange('status_updates', checked)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-gray-700">Escalation Alerts</Label>
              <Switch
                checked={preferences.escalation_alerts}
                onCheckedChange={(checked) => handleInputChange('escalation_alerts', checked)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-gray-700">Training Reminders</Label>
              <Switch
                checked={preferences.training_reminders}
                onCheckedChange={(checked) => handleInputChange('training_reminders', checked)}
              />
            </div>
          </div>
        </div>

        {/* Audio & Vibration */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Audio & Vibration</h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-gray-700">Sound</Label>
              <Switch
                checked={preferences.sound_enabled}
                onCheckedChange={(checked) => handleInputChange('sound_enabled', checked)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-gray-700">Vibration</Label>
              <Switch
                checked={preferences.vibration_enabled}
                onCheckedChange={(checked) => handleInputChange('vibration_enabled', checked)}
              />
            </div>
          </div>
        </div>

        {/* Quiet Hours */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Quiet Hours</h3>
          <p className="text-sm text-gray-600">Notifications will be silenced during these hours</p>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-1">
                Start Time
              </Label>
              <Input
                type="time"
                value={preferences.quiet_hours_start || '22:00'}
                onChange={(e) => handleInputChange('quiet_hours_start', e.target.value)}
              />
            </div>
            
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-1">
                End Time
              </Label>
              <Input
                type="time"
                value={preferences.quiet_hours_end || '07:00'}
                onChange={(e) => handleInputChange('quiet_hours_end', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end">
          <Button
            onClick={savePreferences}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              'Save Preferences'
            )}
          </Button>
        </div>
      </div>
    </Card>
  )
}