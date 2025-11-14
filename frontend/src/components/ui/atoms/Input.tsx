import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
  success?: boolean
  showCount?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, success, showCount, maxLength, ...props }, ref) => {
    const [currentLength, setCurrentLength] = React.useState(0)

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (showCount) {
        setCurrentLength(e.target.value.length)
      }
      props.onChange?.(e)
    }

    return (
      <div className="relative w-full">
        <input
          type={type}
          className={cn(
            'flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition-colors',
            'file:border-0 file:bg-transparent file:text-sm file:font-medium',
            'placeholder:text-gray-400',
            'focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-red-500 focus:ring-red-400',
            success && 'border-green-500 focus:ring-green-400',
            className
          )}
          ref={ref}
          maxLength={maxLength}
          onChange={handleChange}
          {...props}
        />
        {showCount && maxLength && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
            {currentLength}/{maxLength}
          </span>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'

export { Input }

