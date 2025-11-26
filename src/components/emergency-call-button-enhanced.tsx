"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { Phone, X, Star, Clock, History, Settings, Search, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { callService, EmergencyContact, CallLog } from "@/lib/call-service"
import { useAuth } from "@/lib/auth"
import { useToast } from "@/components/ui/use-toast"

export default function EmergencyCallButtonEnhanced() {
  const pathname = usePathname()
  const { user } = useAuth()
  const { toast } = useToast()
  const [showModal, setShowModal] = useState(false)
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([])
  const [favoriteContacts, setFavoriteContacts] = useState<EmergencyContact[]>([])
  const [callLogs, setCallLogs] = useState<CallLog[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState<string>("all")
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("emergency")

  useEffect(() => {
    const initializeCallService = async () => {
      if (!user?.id) return

      try {
        setLoading(true)
        await callService.initialize(user.id)
        
        setEmergencyContacts(callService.getEmergencyContacts())
        setFavoriteContacts(callService.getFavoriteContacts())
        setCallLogs(callService.getCallLogs(20))
      } catch (error) {
        console.error('Failed to initialize call service:', error)
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load call service. Using basic functionality."
        })
      } finally {
        setLoading(false)
      }
    }

    initializeCallService()
  }, [user, toast])

  const handleCall = async (contact: EmergencyContact, callType: CallLog['call_type'] = 'emergency') => {
    try {
      const result = await callService.makeCall(contact.id, callType)
      
      if (result.success) {
        toast({
          title: "Call Initiated",
          description: result.message
        })
        
        // Refresh call logs
        setCallLogs(callService.getCallLogs(20))
      } else {
        toast({
          variant: "destructive",
          title: "Call Failed",
          description: result.message
        })
      }
    } catch (error) {
      console.error('Error making call:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to make call"
      })
    }
  }

  const handleCallNumber = async (number: string, name: string, callType: CallLog['call_type'] = 'emergency') => {
    try {
      const result = await callService.makeCallToNumber(number, name, callType)
      
      if (result.success) {
        toast({
          title: "Call Initiated",
          description: result.message
        })
        
        // Refresh call logs
        setCallLogs(callService.getCallLogs(20))
      } else {
        toast({
          variant: "destructive",
          title: "Call Failed",
          description: result.message
        })
      }
    } catch (error) {
      console.error('Error making call:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to make call"
      })
    }
  }

  const toggleFavorite = async (contactId: string) => {
    try {
      const isFavorite = favoriteContacts.some(contact => contact.id === contactId)
      
      if (isFavorite) {
        await callService.removeFromFavorites(contactId)
      } else {
        await callService.addToFavorites(contactId)
      }
      
      setFavoriteContacts(callService.getFavoriteContacts())
      
      toast({
        title: isFavorite ? "Removed from Favorites" : "Added to Favorites",
        description: `Contact ${isFavorite ? 'removed from' : 'added to'} favorites`
      })
    } catch (error) {
      console.error('Error toggling favorite:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update favorites"
      })
    }
  }

  const filteredContacts = emergencyContacts.filter(contact => {
    const matchesSearch = contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         contact.number.includes(searchTerm)
    const matchesFilter = filterType === "all" || contact.type === filterType
    return matchesSearch && matchesFilter
  })

  const getStatusColor = (status: CallLog['status']) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'connected': return 'bg-blue-100 text-blue-800'
      case 'missed': return 'bg-yellow-100 text-yellow-800'
      case 'failed': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDuration = (duration?: number) => {
    if (!duration) return 'N/A'
    const minutes = Math.floor(duration / 60)
    const seconds = duration % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // Do not render the FAB on the resident report page to avoid covering Submit
  if (pathname?.startsWith('/resident/report')) {
    return null
  }

  if (loading) {
    return (
      <div className="fixed right-6 bottom-24 md:bottom-6 z-50">
        <Button
          disabled
          className="bg-red-600 hover:bg-red-700 text-white rounded-full w-14 h-14 shadow-lg"
          size="lg"
        >
          <Phone className="h-6 w-6" />
        </Button>
      </div>
    )
  }

  return (
    <>
      {/* Floating Emergency Call Button */}
      <div className="fixed right-6 bottom-24 md:bottom-6 z-50">
        <Button
          onClick={() => setShowModal(true)}
          className="bg-red-600 hover:bg-red-700 text-white rounded-full w-14 h-14 shadow-lg"
          size="lg"
        >
          <Phone className="h-6 w-6" />
        </Button>
      </div>

      {/* Enhanced Emergency Call Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <Card className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold text-gray-900">Emergency Contacts & Call History</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Close"
                  onClick={() => setShowModal(false)}
                  className="h-8 w-8 p-0 rounded-full border border-gray-300 hover:bg-gray-100 text-gray-600"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="p-6">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="emergency">Emergency</TabsTrigger>
                  <TabsTrigger value="favorites">Favorites</TabsTrigger>
                  <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>

                {/* Emergency Contacts Tab */}
                <TabsContent value="emergency" className="space-y-4">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search contacts..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 z-10 w-44"
                    >
                      <option value="all">All Types</option>
                      <option value="emergency">Emergency</option>
                      <option value="fire">Fire</option>
                      <option value="police">Police</option>
                      <option value="medical">Medical</option>
                      <option value="disaster">Disaster</option>
                      <option value="utility">Utility</option>
                    </select>
                  </div>

                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {filteredContacts.map((contact) => (
                      <div key={contact.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900">{contact.name}</p>
                            <Badge variant="secondary" className="text-xs">
                              {contact.type}
                            </Badge>
                            {contact.priority <= 2 && (
                              <Badge className="bg-red-100 text-red-800 text-xs">
                                Priority
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">{contact.number}</p>
                          {contact.description && (
                            <p className="text-xs text-gray-500 mt-1">{contact.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleFavorite(contact.id)}
                            className="h-8 w-8 p-0"
                          >
                            <Star 
                              className={`h-4 w-4 ${
                                favoriteContacts.some(fav => fav.id === contact.id) 
                                  ? 'text-yellow-500 fill-current' 
                                  : 'text-gray-400'
                              }`} 
                            />
                          </Button>
                          <Button
                            onClick={() => handleCall(contact, 'emergency')}
                            className="bg-green-600 hover:bg-green-700 text-white"
                            size="sm"
                          >
                            <Phone className="h-4 w-4 mr-1" />
                            Call
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                {/* Favorites Tab */}
                <TabsContent value="favorites" className="space-y-4">
                  {favoriteContacts.length > 0 ? (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {favoriteContacts.map((contact) => (
                        <div key={contact.id} className="flex justify-between items-center p-4 bg-yellow-50 rounded-lg">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-gray-900">{contact.name}</p>
                              <Badge variant="secondary" className="text-xs">
                                {contact.type}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600">{contact.number}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleFavorite(contact.id)}
                              className="h-8 w-8 p-0"
                            >
                              <Star className="h-4 w-4 text-yellow-500 fill-current" />
                            </Button>
                            <Button
                              onClick={() => handleCall(contact, 'emergency')}
                              className="bg-green-600 hover:bg-green-700 text-white"
                              size="sm"
                            >
                              <Phone className="h-4 w-4 mr-1" />
                              Call
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Star className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>No favorite contacts yet</p>
                      <p className="text-sm">Add contacts to favorites for quick access</p>
                    </div>
                  )}
                </TabsContent>

                {/* Call History Tab */}
                <TabsContent value="history" className="space-y-4">
                  {callLogs.length > 0 ? (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {callLogs.map((log) => (
                        <div key={log.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-gray-900">{log.contact_name}</p>
                              <Badge className={getStatusColor(log.status)}>
                                {log.status}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {log.call_type}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600">{log.contact_number}</p>
                            <p className="text-xs text-gray-500">
                              {new Date(log.created_at).toLocaleString()} • 
                              Duration: {formatDuration(log.duration)}
                            </p>
                            {log.notes && (
                              <p className="text-xs text-gray-500 mt-1">{log.notes}</p>
                            )}
                          </div>
                          <Button
                            onClick={() => handleCallNumber(log.contact_number, log.contact_name, log.call_type)}
                            className="bg-green-600 hover:bg-green-700 text-white"
                            size="sm"
                          >
                            <Phone className="h-4 w-4 mr-1" />
                            Call Again
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <History className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>No call history yet</p>
                      <p className="text-sm">Your call logs will appear here</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>

            <div className="p-6 border-t bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  <strong>Note:</strong> For life-threatening emergencies, call 911 immediately.
                </div>
                <Button
                  onClick={() => handleCallNumber('911', 'Emergency Hotline', 'emergency')}
                  className="bg-red-600 hover:bg-red-700 text-white"
                  size="sm"
                >
                  <Phone className="h-4 w-4 mr-1" />
                  Call 911
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  )
}
