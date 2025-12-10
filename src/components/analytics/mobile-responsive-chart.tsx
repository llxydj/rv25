"use client"

import React from 'react'
import { ResponsiveContainer } from 'recharts'
import { useMediaQuery } from '@/hooks/use-media-query'

interface MobileResponsiveChartProps {
  children: React.ReactNode
  height?: number
  mobileHeight?: number
  className?: string
}

/**
 * Mobile-responsive chart wrapper
 * Automatically adjusts height and layout for mobile devices
 */
export const MobileResponsiveChart: React.FC<MobileResponsiveChartProps> = ({
  children,
  height = 300,
  mobileHeight = 250,
  className = ''
}) => {
  const isMobile = useMediaQuery('(max-width: 768px)')
  const isTablet = useMediaQuery('(max-width: 1024px)')
  
  const chartHeight = isMobile ? mobileHeight : (isTablet ? height * 0.9 : height)

  return (
    <div className={`w-full ${className}`} style={{ height: `${chartHeight}px`, minHeight: '200px' }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  )
}

/**
 * Mobile-optimized pie chart - converts to horizontal bar on mobile
 */
interface MobilePieChartProps {
  data: any[]
  dataKey: string
  nameKey: string
  colors?: string[]
  showLegend?: boolean
  height?: number
}

export const MobilePieChart: React.FC<MobilePieChartProps> = ({
  data,
  dataKey,
  nameKey,
  colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00'],
  showLegend = true,
  height = 300
}) => {
  const isMobile = useMediaQuery('(max-width: 768px)')
  
  if (isMobile && data.length > 5) {
    // Convert to horizontal bar chart on mobile for better readability
    const { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } = require('recharts')
    
    return (
      <MobileResponsiveChart height={height} mobileHeight={Math.min(250, data.length * 40)}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" tick={{ fontSize: 12 }} />
          <YAxis 
            dataKey={nameKey} 
            type="category" 
            width={100}
            tick={{ fontSize: 11 }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#fff', 
              border: '1px solid #e5e7eb', 
              borderRadius: '8px',
              fontSize: '14px',
              padding: '8px'
            }}
            formatter={(value: any) => [value, 'Count']}
          />
          {showLegend && <Legend wrapperStyle={{ fontSize: '12px' }} />}
          <Bar 
            dataKey={dataKey} 
            fill={colors[0]}
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </MobileResponsiveChart>
    )
  }
  
  // Use pie chart on desktop/tablet
  const { PieChart, Pie, Cell, Tooltip, Legend } = require('recharts')
  
  return (
    <MobileResponsiveChart height={height} mobileHeight={250}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => isMobile 
            ? `${name}: ${(percent * 100).toFixed(0)}%`
            : `${(percent * 100).toFixed(0)}%`
          }
          outerRadius={isMobile ? 60 : 80}
          fill="#8884d8"
          dataKey={dataKey}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        <Tooltip 
          contentStyle={{ 
            backgroundColor: '#fff', 
            border: '1px solid #e5e7eb', 
            borderRadius: '8px',
            fontSize: '14px',
            padding: '8px'
          }}
          formatter={(value: any, name: string) => [value, name]}
        />
        {showLegend && <Legend wrapperStyle={{ fontSize: '12px' }} />}
      </PieChart>
    </MobileResponsiveChart>
  )
}

