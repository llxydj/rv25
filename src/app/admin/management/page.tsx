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
    <div className="container mx-auto p-4 md:p-6">
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold">System Management</h1>
        <p className="text-sm md:text-base text-gray-600 mt-2">
          Manage emergency contacts, call logs, location tracking, and reports
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="overflow-x-auto -mx-6 px-6 md:mx-0 md:px-0">
          <TabsList className="inline-flex w-auto min-w-full md:grid md:w-full md:grid-cols-4">
            <TabsTrigger value="emergency-contacts" className="flex items-center gap-2 whitespace-nowrap px-3 md:px-4">
              <Phone className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline">Emergency Contacts</span>
              <span className="sm:hidden">Contacts</span>
            </TabsTrigger>
            <TabsTrigger value="call-logs" className="flex items-center gap-2 whitespace-nowrap px-3 md:px-4">
              <Phone className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline">Call Logs</span>
              <span className="sm:hidden">Calls</span>
            </TabsTrigger>
            <TabsTrigger value="location-tracking" className="flex items-center gap-2 whitespace-nowrap px-3 md:px-4">
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline">Location Tracking</span>
              <span className="sm:hidden">Location</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2 whitespace-nowrap px-3 md:px-4">
              <FileText className="w-4 h-4 flex-shrink-0" />
              Reports
            </TabsTrigger>
          </TabsList>
        </div>

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

