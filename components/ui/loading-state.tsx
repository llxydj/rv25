import * as React from "react"
import { cn } from "@/lib/utils"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

interface LoadingStateProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "overlay" | "inline" | "full-page"
  message?: string
  spinnerSize?: "sm" | "md" | "lg"
  spinnerColor?: string
  progress?: number
}

const LoadingState = React.forwardRef<HTMLDivElement, LoadingStateProps>(
  ({ 
    className, 
    variant = "inline", 
    message, 
    spinnerSize = "md", 
    spinnerColor,
    progress,
    ...props 
  }, ref) => {
    const variantStyles = {
      "overlay": "absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50",
      "inline": "flex items-center justify-center gap-2",
      "full-page": "fixed inset-0 bg-background/90 backdrop-blur-sm flex flex-col items-center justify-center z-[1000]"
    }
    
    if (variant === "full-page" || variant === "overlay") {
      return (
        <div
          ref={ref}
          className={cn(variantStyles[variant], className)}
          role="status"
          aria-live="polite"
          aria-label="Loading"
          {...props}
        >
          <div className="flex flex-col items-center gap-4 p-8 rounded-lg bg-card shadow-lg">
            <LoadingSpinner size={spinnerSize} color={spinnerColor} />
            {message && (
              <p className="text-sm font-medium text-foreground">{message}</p>
            )}
            {progress !== undefined && (
              <div className="w-48 h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300 ease-out"
                  style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )
    }
    
    return (
      <div
        ref={ref}
        className={cn(variantStyles[variant], className)}
        role="status"
        aria-live="polite"
        aria-label="Loading"
        {...props}
      >
        <LoadingSpinner size={spinnerSize} color={spinnerColor} />
        {message && (
          <span className="text-sm text-foreground">{message}</span>
        )}
      </div>
    )
  }
)

LoadingState.displayName = "LoadingState"

export { LoadingState, type LoadingStateProps }