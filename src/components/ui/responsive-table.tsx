"use client"

import { ReactNode } from "react"

interface ResponsiveTableProps {
  headers: string[]
  children: ReactNode
  className?: string
}

export function ResponsiveTable({ headers, children, className = "" }: ResponsiveTableProps) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            {headers.map((header, index) => (
              <th
                key={index}
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
          {children}
        </tbody>
      </table>
    </div>
  )
}

