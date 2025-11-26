"use client"

import { useState } from "react"

interface ImageLightboxProps {
  src: string
  alt?: string
  className?: string
}

export function ImageLightbox({ src, alt = "", className = "" }: ImageLightboxProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <img
        src={src}
        alt={alt}
        className={className + " cursor-zoom-in"}
        onClick={() => setOpen(true)}
      />
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div className="relative max-w-5xl w-full max-h-[90vh]">
            <button
              onClick={() => setOpen(false)}
              className="absolute -top-10 right-0 text-white text-sm underline"
            >
              Close
            </button>
            <img
              src={src}
              alt={alt}
              className="w-full h-auto max-h-[90vh] object-contain rounded-md shadow-lg cursor-zoom-out"
            />
          </div>
        </div>
      )}
    </>
  )
}
