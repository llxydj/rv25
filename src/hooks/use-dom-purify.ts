"use client"

import { useCallback } from "react"

/**
 * Custom hook for sanitizing HTML using DOMPurify
 * Dynamically imports DOMPurify only on the client side to avoid SSR issues
 * 
 * This follows Next.js best practices for handling browser-only libraries
 * 
 * @returns A sanitize function that can be used to clean HTML content
 */
export function useDOMPurify() {
  const sanitize = useCallback(async (html: string): Promise<string> => {
    // Early return for server-side rendering
    if (typeof window === 'undefined') {
      return html
    }

    try {
      // Dynamic import ensures DOMPurify is only loaded on the client
      // This prevents build-time errors when Next.js tries to prerender pages
      const DOMPurify = (await import('isomorphic-dompurify')).default
      
      return DOMPurify.sanitize(html || '', {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'span', 'div'],
        ALLOWED_ATTR: ['href', 'target', 'rel', 'class']
      })
    } catch (error) {
      console.error('Failed to sanitize HTML with DOMPurify:', error)
      // Return original HTML if sanitization fails (graceful degradation)
      return html
    }
  }, [])

  return { sanitize }
}

