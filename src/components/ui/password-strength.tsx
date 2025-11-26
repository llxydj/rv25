"use client"

import type React from "react"
import { useState, useEffect } from "react"

interface PasswordStrengthProps {
  password: string
}

export const PasswordStrength: React.FC<PasswordStrengthProps> = ({ password }) => {
  const [strength, setStrength] = useState(0)
  const [message, setMessage] = useState("")

  useEffect(() => {
    calculateStrength(password)
  }, [password])

  const calculateStrength = (password: string) => {
    if (!password) {
      setStrength(0)
      setMessage("")
      return
    }

    let score = 0

    // Length check
    if (password.length >= 6) score += 1
    if (password.length >= 10) score += 1

    // Character type checks
    if (/[A-Z]/.test(password)) score += 1 // Uppercase
    if (/[a-z]/.test(password)) score += 1 // Lowercase
    if (/[0-9]/.test(password)) score += 1 // Numbers
    if (/[^A-Za-z0-9]/.test(password)) score += 1 // Special characters

    // Set strength level (0-5)
    setStrength(score)

    // Set message based on strength
    if (score <= 2) {
      setMessage("Weak")
    } else if (score <= 4) {
      setMessage("Moderate")
    } else {
      setMessage("Strong")
    }
  }

  const getBarColor = () => {
    if (strength <= 2) return "bg-red-500"
    if (strength <= 4) return "bg-yellow-500"
    return "bg-green-500"
  }

  return (
    <div className="w-full mt-1">
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${getBarColor()} transition-all duration-300 ease-in-out`}
          style={{ width: `${(strength / 6) * 100}%` }}
        ></div>
      </div>
      {message && (
        <p
          className={`text-xs mt-1 ${
            strength <= 2 ? "text-red-500" : strength <= 4 ? "text-yellow-500" : "text-green-500"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  )
}
