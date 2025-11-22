import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // 🔧 FIXED VERSION: Always readable colors
          "flex h-10 w-full rounded-md border border-input px-3 py-2",
          "bg-white text-gray-900 placeholder:text-gray-500",   // ALWAYS visible
          "dark:bg-white dark:text-gray-900 dark:placeholder:text-gray-500", // fix forced dark mode
          
          // Accessibility + focus styles
          "text-base ring-offset-background focus-visible:outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          
          // File input consistency
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-gray-900",
          
          // Disabled state
          "disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",

          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)

Input.displayName = "Input"

export { Input }
