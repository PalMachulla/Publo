import * as React from 'react'

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
}

const variantStyles = {
  default: 'bg-gray-100 text-gray-800 hover:bg-gray-200',
  primary: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200',
  success: 'bg-green-100 text-green-800 hover:bg-green-200',
  warning: 'bg-orange-100 text-orange-800 hover:bg-orange-200',
  danger: 'bg-red-100 text-red-800 hover:bg-red-200',
  info: 'bg-blue-100 text-blue-800 hover:bg-blue-200',
  purple: 'bg-purple-100 text-purple-800 hover:bg-purple-200',
  outline: 'border border-gray-300 text-gray-700 hover:bg-gray-50',
}

const sizeStyles = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-0.5 text-xs',
  lg: 'px-3 py-1 text-sm',
}

export function Badge({
  className = '',
  variant = 'default',
  size = 'md',
  children,
  ...props
}: BadgeProps) {
  const variantClass = variantStyles[variant]
  const sizeClass = sizeStyles[size]
  
  return (
    <div
      className={`inline-flex items-center rounded-full font-semibold transition-colors ${variantClass} ${sizeClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

