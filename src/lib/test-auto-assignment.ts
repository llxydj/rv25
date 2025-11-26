/**
 * Test script for auto-assignment system
 * This script can be used to verify that the auto-assignment system is working correctly
 */

import { autoAssignmentService } from './auto-assignment'
import { supabase } from './supabase'

export interface TestResult {
  success: boolean
  message: string
  details?: any
}

export class AutoAssignmentTester {
  /**
   * Test if auto-assignment service is properly initialized
   */
  static async testServiceInitialization(): Promise<TestResult> {
    try {
      const service = autoAssignmentService
      if (!service) {
        return {
          success: false,
          message: 'Auto-assignment service not initialized'
        }
      }

      return {
        success: true,
        message: 'Auto-assignment service is properly initialized'
      }
    } catch (error: any) {
      return {
        success: false,
        message: `Service initialization failed: ${error.message}`
      }
    }
  }

  /**
   * Test if volunteers are available for assignment
   */
  static async testVolunteerAvailability(): Promise<TestResult> {
    try {
      const { data: volunteers, error } = await supabase
        .from('volunteer_profiles')
        .select(`
          volunteer_user_id,
          is_available,
          skills,
          users!inner (
            id,
            first_name,
            last_name,
            phone_number
          )
        `)
        .eq('is_available', true)

      if (error) {
        return {
          success: false,
          message: `Failed to fetch volunteers: ${error.message}`
        }
      }

      const availableCount = volunteers?.length || 0

      return {
        success: true,
        message: `Found ${availableCount} available volunteers`,
        details: {
          count: availableCount,
          volunteers: volunteers?.map(v => ({
            id: v.volunteer_user_id,
            name: `${v.users.first_name} ${v.users.last_name}`,
            skills: v.skills
          }))
        }
      }
    } catch (error: any) {
      return {
        success: false,
        message: `Volunteer availability test failed: ${error.message}`
      }
    }
  }

  /**
   * Test if incidents can be auto-assigned
   */
  static async testAutoAssignment(): Promise<TestResult> {
    try {
      // Get a pending incident
      const { data: pendingIncidents, error } = await supabase
        .from('incidents')
        .select(`
          id,
          incident_type,
          location_lat,
          location_lng,
          barangay,
          severity,
          status
        `)
        .eq('status', 'PENDING')
        .limit(1)

      if (error) {
        return {
          success: false,
          message: `Failed to fetch pending incidents: ${error.message}`
        }
      }

      if (!pendingIncidents || pendingIncidents.length === 0) {
        return {
          success: true,
          message: 'No pending incidents to test auto-assignment'
        }
      }

      const incident = pendingIncidents[0]

      // Test auto-assignment
      const assignmentCriteria = {
        incidentId: incident.id,
        incidentType: incident.incident_type,
        location: {
          lat: incident.location_lat,
          lng: incident.location_lng
        },
        barangay: incident.barangay,
        severity: incident.severity || 3,
        requiredSkills: ['EMERGENCY RESPONSE'] // Default skills
      }

      const result = await autoAssignmentService.assignIncident(assignmentCriteria)

      return {
        success: result.success,
        message: result.message,
        details: {
          incidentId: incident.id,
          incidentType: incident.incident_type,
          assignmentResult: result
        }
      }
    } catch (error: any) {
      return {
        success: false,
        message: `Auto-assignment test failed: ${error.message}`
      }
    }
  }

  /**
   * Test notification system
   */
  static async testNotificationSystem(): Promise<TestResult> {
    try {
      // Check if push subscriptions exist
      const { data: subscriptions, error } = await supabase
        .from('push_subscriptions')
        .select('user_id, subscription')
        .limit(5)

      if (error) {
        return {
          success: false,
          message: `Failed to fetch push subscriptions: ${error.message}`
        }
      }

      const subscriptionCount = subscriptions?.length || 0

      return {
        success: true,
        message: `Found ${subscriptionCount} push subscriptions`,
        details: {
          count: subscriptionCount,
          subscriptions: subscriptions?.map(s => ({
            userId: s.user_id,
            hasSubscription: !!s.subscription
          }))
        }
      }
    } catch (error: any) {
      return {
        success: false,
        message: `Notification system test failed: ${error.message}`
      }
    }
  }

  /**
   * Run all tests
   */
  static async runAllTests(): Promise<{
    overall: boolean
    results: TestResult[]
  }> {
    const tests = [
      { name: 'Service Initialization', test: this.testServiceInitialization },
      { name: 'Volunteer Availability', test: this.testVolunteerAvailability },
      { name: 'Auto Assignment', test: this.testAutoAssignment },
      { name: 'Notification System', test: this.testNotificationSystem }
    ]

    const results: TestResult[] = []

    for (const { name, test } of tests) {
      console.log(`Running test: ${name}`)
      const result = await test.call(this)
      results.push({ ...result, message: `[${name}] ${result.message}` })
    }

    const overall = results.every(r => r.success)

    return {
      overall,
      results
    }
  }
}

// Export for use in other parts of the application
export const autoAssignmentTester = AutoAssignmentTester
