import * as React from 'react'
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group'

export interface RadioGroupProps {
  value: string
  onValueChange: (value: string) => void
  children: React.ReactNode
  className?: string
  orientation?: 'horizontal' | 'vertical'
}

export function RadioGroup({
  value,
  onValueChange,
  children,
  className = '',
  orientation = 'vertical',
}: RadioGroupProps) {
  const orientationClass = orientation === 'horizontal' ? 'flex gap-4' : 'space-y-3'
  
  return (
    <RadioGroupPrimitive.Root
      value={value}
      onValueChange={onValueChange}
      className={`${orientationClass} ${className}`}
    >
      {children}
    </RadioGroupPrimitive.Root>
  )
}

export interface RadioItemProps {
  value: string
  label: string
  description?: string
  disabled?: boolean
  className?: string
}

export function RadioItem({
  value,
  label,
  description,
  disabled = false,
  className = '',
}: RadioItemProps) {
  return (
    <label className={`flex items-start gap-3 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
      <RadioGroupPrimitive.Item
        value={value}
        disabled={disabled}
        className="w-5 h-5 mt-0.5 rounded-full border-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 data-[state=checked]:border-yellow-400 data-[state=checked]:bg-yellow-400 transition-colors"
      >
        <RadioGroupPrimitive.Indicator className="flex items-center justify-center w-full h-full relative after:content-[''] after:block after:w-2 after:h-2 after:rounded-full after:bg-white" />
      </RadioGroupPrimitive.Item>
      <div className="flex-1">
        <div className="text-sm font-medium text-gray-900">{label}</div>
        {description && (
          <div className="text-xs text-gray-600 mt-0.5">{description}</div>
        )}
      </div>
    </label>
  )
}

