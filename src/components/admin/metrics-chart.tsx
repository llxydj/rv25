"use client"

import { Bar, BarChart, Cell, Pie, PieChart, Tooltip, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

interface MetricsChartProps {
  title: string
  data: any[]
  type: "bar" | "pie"
  dataKey: string
  nameKey: string
  className?: string
}

export function MetricsChart({ title, data, type, dataKey, nameKey, className }: MetricsChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">No data available</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Colors for charts
  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#ec4899"]

  if (type === "pie") {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{
              [dataKey]: {
                label: title,
                color: "hsl(var(--chart-1))",
              },
            }}
            className="h-64 w-full"
          >
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={true}
                outerRadius={80}
                fill="#8884d8"
                dataKey={dataKey}
                nameKey={nameKey}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <ChartTooltip content={<ChartTooltipContent />} />
            </PieChart>
          </ChartContainer>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={{
            [dataKey]: {
              label: title,
              color: "hsl(var(--chart-1))",
            },
          }}
          className="h-64 w-full"
        >
          <BarChart data={data}>
            <XAxis dataKey={nameKey} />
            <YAxis />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey={dataKey} fill="#3b82f6">
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}