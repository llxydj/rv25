import * as React from "react"
import { AlertCircle, CheckCircle, Info, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

interface ErrorMessageProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "error" | "success" | "warning" | "info"
  title?: string
  message: string
  dismissible?: boolean
  onDismiss?: () => void
}

const ErrorMessage = React.forwardRef<HTMLDivElement, ErrorMessageProps>(
  ({ className, variant = "error", title, message, dismissible = false, onDismiss, ...props }, ref) => {
    const [isVisible, setIsVisible] = React.useState(true)
    
    const handleDismiss = () => {
      setIsVisible(false)
      onDismiss?.()
    }
    
    if (!isVisible) return null
    
    const variantStyles = {
      error: "bg-destructive/10 border-destructive/20 text-destructive",
      success: "bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-300",
      warning: "bg-yellow-500/10 border-yellow-500/20 text-yellow-700 dark:text-yellow-300",
      info: "bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-300",
    }
    
    const variantIcons = {
      error: AlertCircle,
      success: CheckCircle,
      warning: AlertTriangle,
      info: Info,
    }
    
    const IconComponent = variantIcons[variant]
    
    return (
      <div
        ref={ref}
        className={cn(
          "relative rounded-lg border p-4 text-sm",
          variantStyles[variant],
          className
        )}
        role="alert"
        aria-live={variant === "error" ? "assertive" : "polite"}
        {...props}
      >
        <div className="flex items-start gap-3">
          <IconComponent className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <div className="flex-1">
            {title && (
              <h3 className="font-medium leading-none">{title}</h3>
            )}
            <p className="mt-1">{message}</p>
          </div>
          {dismissible && (
            <button
              onClick={handleDismiss}
              className="ml-2 rounded-md p-1 hover:bg-black/10 dark:hover:bg-white/10"
              aria-label="Dismiss message"
            >
              <span className="sr-only">Dismiss</span>
              <div className="h-4 w-4">×</div>
            </button>
          )}
        </div>
      </div>
    )
  }
)

ErrorMessage.displayName = "ErrorMessage"

export { ErrorMessage, type ErrorMessageProps }