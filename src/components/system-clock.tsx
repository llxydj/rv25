"use client"

import React, { useState, useEffect } from 'react'

interface SystemClockProps {
  className?: string
}

export function SystemClock({ className = '' }: SystemClockProps) {
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
  }

  return (
    <div className={`text-center ${className}`}>
      <div className="text-xl font-bold">{formatTime(currentTime)}</div>
      <div className="text-lg font-semibold">{formatDate(currentTime)}</div>
    </div>
  )
}