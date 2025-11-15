"use client"

// This file contains the main form content sections for the volunteer profile page
import React from "react"
import { SkillsSelector, AvailabilitySelector } from "./profile-components"

interface ProfileFormContentProps {
  personalInfo: {
    phoneNumber: string
    address: string
    barangay: string
    gender: "male" | "female" | "other" | "prefer_not_to_say" | ""
    emergencyContactName: string
    emergencyContactPhone: string
    emergencyContactRelationship: string
  }
  volunteerData: {
    skills: string[]
    availability: string[]
    notes: string
  }
  onPersonalInfoChange: (field: string, value: string) => void
  onVolunteerDataChange: (field: string, value: any) => void
  onToggleSkill: (skill: string) => void
  onToggleDay: (day: string) => void
}

export const ProfileFormContent: React.FC<ProfileFormContentProps> = ({
  personalInfo,
  volunteerData,
  onPersonalInfoChange,
  onVolunteerDataChange,
  onToggleSkill,
  onToggleDay,
}) => {
  return (
    <>
      {/* Personal Information Section */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              id="phoneNumber"
              value={personalInfo.phoneNumber}
              onChange={(e) => onPersonalInfoChange('phoneNumber', e.target.value)}
              placeholder="+63 XXX XXX XXXX"
              className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-2">
              Gender
            </label>
            <select
              id="gender"
              value={personalInfo.gender}
              onChange={(e) => onPersonalInfoChange('gender', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 transition-colors"
            >
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
              Address
            </label>
            <input
              type="text"
              id="address"
              value={personalInfo.address}
              onChange={(e) => onPersonalInfoChange('address', e.target.value)}
              placeholder="Street, House Number"
              className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="barangay" className="block text-sm font-medium text-gray-700 mb-2">
              Barangay
            </label>
            <input
              type="text"
              id="barangay"
              value={personalInfo.barangay}
              onChange={(e) => onPersonalInfoChange('barangay', e.target.value)}
              placeholder="Barangay name"
              className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Emergency Contact Section */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Emergency Contact</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label htmlFor="emergencyContactName" className="block text-sm font-medium text-gray-700 mb-2">
              Contact Name
            </label>
            <input
              type="text"
              id="emergencyContactName"
              value={personalInfo.emergencyContactName}
              onChange={(e) => onPersonalInfoChange('emergencyContactName', e.target.value)}
              placeholder="Full name"
              className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="emergencyContactPhone" className="block text-sm font-medium text-gray-700 mb-2">
              Contact Phone
            </label>
            <input
              type="tel"
              id="emergencyContactPhone"
              value={personalInfo.emergencyContactPhone}
              onChange={(e) => onPersonalInfoChange('emergencyContactPhone', e.target.value)}
              placeholder="+63 XXX XXX XXXX"
              className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="emergencyContactRelationship" className="block text-sm font-medium text-gray-700 mb-2">
              Relationship
            </label>
            <input
              type="text"
              id="emergencyContactRelationship"
              value={personalInfo.emergencyContactRelationship}
              onChange={(e) => onPersonalInfoChange('emergencyContactRelationship', e.target.value)}
              placeholder="e.g., Spouse, Parent, Sibling"
              className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Skills & Certifications Section */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Skills & Certifications</h2>
        <SkillsSelector skills={volunteerData.skills} onToggleSkill={onToggleSkill} />
      </div>

      {/* Availability Section */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Availability</h2>
        <AvailabilitySelector availability={volunteerData.availability} onToggleDay={onToggleDay} />
      </div>

      {/* Notes Section */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Additional Notes</h2>
        <textarea
          id="notes"
          rows={4}
          value={volunteerData.notes}
          onChange={(e) => onVolunteerDataChange('notes', e.target.value)}
          placeholder="Add any relevant notes about your volunteer work, experience, or preferences..."
          className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 transition-colors resize-none"
        />
      </div>
    </>
  )
}
