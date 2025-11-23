import * as React from "react"
import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, style, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        {...props}
        className={cn(
          // Base styles
          "flex h-10 w-full rounded-md border px-3 py-2 text-base",
          // Light mode
          "border-gray-300 bg-white text-gray-900 placeholder-gray-400",
          // Dark mode
          "dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500",
          // Focus states
          "focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 focus:ring-offset-2",
          "dark:focus:ring-offset-gray-800",
          // File input consistency
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-gray-900 dark:file:text-white",
          // Disabled state
          "disabled:cursor-not-allowed disabled:opacity-50",
          // Merge any custom className
          className
        )}
        style={style}
      />
    )
  }
)

Input.displayName = "Input"

export { Input }