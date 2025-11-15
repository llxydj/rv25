import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { AppClient } from "@/components/providers/app-client"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "RVOIS - Rescue Volunteers Operations Information System",
  description: "Emergency response coordination system for Talisay City, Negros Occidental",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "RVOIS",
  },
  icons: {
    apple: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#111827" },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning className={inter.className}>
        <AppClient>
          {children}
        </AppClient>
      </body>
    </html>
  )
}
