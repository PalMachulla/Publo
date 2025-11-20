import * as React from 'react'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'interactive' | 'selected'
  children: React.ReactNode
}

const variantStyles = {
  default: 'bg-white border border-gray-200',
  interactive: 'bg-white border border-gray-200 hover:border-yellow-400 hover:shadow-md cursor-pointer transition-all duration-200',
  selected: 'bg-yellow-50 border-2 border-yellow-400 shadow-md',
}

export function Card({
  className = '',
  variant = 'default',
  children,
  ...props
}: CardProps) {
  const variantClass = variantStyles[variant]
  
  return (
    <div
      className={`rounded-lg p-4 ${variantClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function CardHeader({ className = '', children, ...props }: CardHeaderProps) {
  return (
    <div className={`mb-3 ${className}`} {...props}>
      {children}
    </div>
  )
}

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode
}

export function CardTitle({ className = '', children, ...props }: CardTitleProps) {
  return (
    <h3 className={`text-base font-semibold text-gray-900 ${className}`} {...props}>
      {children}
    </h3>
  )
}

export interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode
}

export function CardDescription({ className = '', children, ...props }: CardDescriptionProps) {
  return (
    <p className={`text-sm text-gray-600 ${className}`} {...props}>
      {children}
    </p>
  )
}

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function CardContent({ className = '', children, ...props }: CardContentProps) {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  )
}

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function CardFooter({ className = '', children, ...props }: CardFooterProps) {
  return (
    <div className={`mt-3 pt-3 border-t border-gray-200 ${className}`} {...props}>
      {children}
    </div>
  )
}

