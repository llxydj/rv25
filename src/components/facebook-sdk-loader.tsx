"use client"

import { useEffect } from "react"
import Script from "next/script"

export function FacebookSDKLoader() {
  useEffect(() => {
    // Set up fbAsyncInit before the script loads
    if (typeof window !== 'undefined') {
      (window as any).fbAsyncInit = function() {
        if ((window as any).FB) {
          (window as any).FB.init({
            xfbml: true,
            version: 'v24.0'
          })
        }
      }
    }
  }, [])

  return (
    <>
      <div id="fb-root"></div>
      <Script
        id="facebook-jssdk"
        strategy="afterInteractive"
        src="https://connect.facebook.net/en_US/sdk.js"
      />
    </>
  )
}

