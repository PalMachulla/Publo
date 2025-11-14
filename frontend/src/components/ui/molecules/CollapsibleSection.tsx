import * as React from 'react'
import { cn } from '@/lib/utils'

export interface CollapsibleSectionProps {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
  icon?: React.ReactNode
  className?: string
}

const CollapsibleSection = React.forwardRef<HTMLDivElement, CollapsibleSectionProps>(
  ({ title, defaultOpen = false, children, icon, className }, ref) => {
    const [isOpen, setIsOpen] = React.useState(defaultOpen)

    return (
      <div ref={ref} className={cn('border border-gray-100 rounded-xl overflow-hidden shadow-sm bg-white', className)}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-5 py-4 bg-gray-50/50 hover:bg-gray-100/50 transition-all flex items-center justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-inset"
        >
          <div className="flex items-center gap-2">
            {icon}
            <span className="font-medium text-gray-900">{title}</span>
          </div>
          <svg
            className={cn(
              'w-5 h-5 text-gray-500 transition-transform',
              isOpen && 'rotate-180'
            )}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {isOpen && <div className="p-5 space-y-5 bg-white">{children}</div>}
      </div>
    )
  }
)
CollapsibleSection.displayName = 'CollapsibleSection'

export { CollapsibleSection }

