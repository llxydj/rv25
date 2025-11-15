import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'RVOIS',
  description: 'Radiant Rescue',
  generator: 'rvois-project',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
