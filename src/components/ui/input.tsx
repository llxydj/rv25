import * as React from "react"
import { cn } from "@/lib/utils"
import { toSentenceCase } from "@/lib/strings"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  sentenceCase?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", sentenceCase = true, onChange, ...props }, ref) => {
    const handleChange = React.useCallback<React.ChangeEventHandler<HTMLInputElement>>(
      (e) => {
        const t = type || e.currentTarget.type
        const shouldNormalize = sentenceCase && (t === 'text' || t === 'search')
        if (shouldNormalize) {
          const v = toSentenceCase(e.currentTarget.value)
          if (v !== e.currentTarget.value) {
            e.currentTarget.value = v
          }
        }
        if (onChange) onChange(e)
      },
      [onChange, sentenceCase, type]
    )

    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-gray-900",
          "ring-offset-background placeholder:text-gray-400",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        onChange={handleChange}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
