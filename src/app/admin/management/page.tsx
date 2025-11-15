"use client"

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmergencyContactsManager } from '@/components/admin/emergency-contacts'
import { CallLogsManager } from '@/components/admin/call-logs'
import { LocationTrackingManager } from '@/components/admin/location-tracking'
import { ReportsManager } from '@/components/admin/reports-manager'
import { Phone, MapPin, FileText, Users } from 'lucide-react'

export default function ManagementPage() {
  const [activeTab, setActiveTab] = useState('emergency-contacts')

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">System Management</h1>
        <p className="text-gray-600 mt-2">
          Manage emergency contacts, call logs, location tracking, and reports
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="emergency-contacts" className="flex items-center gap-2">
            <Phone className="w-4 h-4" />
            Emergency Contacts
          </TabsTrigger>
          <TabsTrigger value="call-logs" className="flex items-center gap-2">
            <Phone className="w-4 h-4" />
            Call Logs
          </TabsTrigger>
          <TabsTrigger value="location-tracking" className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Location Tracking
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="emergency-contacts">
          <Card>
            <CardHeader>
              <CardTitle>Emergency Contacts Management</CardTitle>
              <CardDescription>
                Manage emergency contact information for quick access during incidents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EmergencyContactsManager />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="call-logs">
          <Card>
            <CardHeader>
              <CardTitle>Call Logs Management</CardTitle>
              <CardDescription>
                View and manage call logs for communication tracking
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CallLogsManager />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="location-tracking">
          <Card>
            <CardHeader>
              <CardTitle>Location Tracking Management</CardTitle>
              <CardDescription>
                Monitor volunteer and user location data for incident response
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LocationTrackingManager />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <CardTitle>Reports Management</CardTitle>
              <CardDescription>
                Review and manage incident reports, activity reports, and situation reports
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ReportsManager />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

