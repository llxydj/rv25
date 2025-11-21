// src/app/layout.tsx
import type React from "react";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppClient } from "@/components/providers/app-client";

// ✅ Use display: "swap" to prevent layout shift, prefetch font to self-host
const inter = Inter({
  subsets: ["latin"],
  display: "swap",   // avoids FOIT (flash of invisible text)
  preload: true,     // preloads font at build time
  variable: "--font-inter",
});

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
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#111827" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body suppressHydrationWarning className={inter.className} style={{ fontFamily: 'var(--font-inter), Inter, sans-serif' }}>
        <AppClient>
          {children}
        </AppClient>
      </body>
    </html>
  );
}
