"use client"

import React, { useMemo } from "react"

interface SkillsSelectorProps {
  skills: string[]
  onToggleSkill: (skill: string) => void
}

export const SkillsSelector: React.FC<SkillsSelectorProps> = React.memo(({ skills, onToggleSkill }) => {
  const availableSkills = useMemo(() => [
    "FIRST AID",
    "CPR",
    "FIREFIGHTING",
    "WATER RESCUE",
    "SEARCH AND RESCUE",
    "EMERGENCY RESPONSE",
    "DISASTER MANAGEMENT",
    "MEDICAL ASSISTANCE",
    "TRAFFIC MANAGEMENT",
    "COMMUNICATION",
  ], [])

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {availableSkills.map((skill) => (
          <button
            key={skill}
            type="button"
            onClick={() => onToggleSkill(skill)}
            className={`px-4 py-3 text-sm font-medium rounded-lg border-2 transition-all ${
              skills.includes(skill)
                ? "bg-blue-600 text-white border-blue-600 shadow-md"
                : "bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:bg-blue-50"
            }`}
          >
            {skill}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-gray-500">Select all skills and certifications you possess</p>
    </div>
  )
})
SkillsSelector.displayName = 'SkillsSelector'

interface AvailabilitySelectorProps {
  availability: string[]
  onToggleDay: (day: string) => void
}

export const AvailabilitySelector: React.FC<AvailabilitySelectorProps> = React.memo(({ availability, onToggleDay }) => {
  const availableDays = useMemo(() => 
    ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"], 
    []
  )

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
        {availableDays.map((day) => (
          <button
            key={day}
            type="button"
            onClick={() => onToggleDay(day)}
            className={`px-4 py-3 text-sm font-medium rounded-lg border-2 transition-all ${
              availability.includes(day)
                ? "bg-green-600 text-white border-green-600 shadow-md"
                : "bg-white text-gray-700 border-gray-300 hover:border-green-400 hover:bg-green-50"
            }`}
          >
            {day}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-gray-500">Select the days you're available for volunteer work</p>
    </div>
  )
})
AvailabilitySelector.displayName = 'AvailabilitySelector'

interface StatusBadgeProps {
  status: string
}

export const StatusBadge: React.FC<StatusBadgeProps> = React.memo(({ status }) => (
  <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${
    status === "ACTIVE"
      ? "bg-green-100 text-green-800 border border-green-200"
      : status === "INACTIVE"
      ? "bg-gray-100 text-gray-800 border border-gray-200"
      : "bg-red-100 text-red-800 border border-red-200"
  }`}>
    {status}
  </span>
))
StatusBadge.displayName = 'StatusBadge'
