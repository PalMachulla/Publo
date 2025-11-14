import * as React from 'react'
import { ChevronDownIcon } from '@radix-ui/react-icons'
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
      <div ref={ref} className={cn('border-b border-gray-100 last:border-b-0', className)}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-0 py-4 hover:bg-gray-50/50 transition-all flex items-center justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-inset rounded-lg group"
        >
          <div className="flex items-center gap-3">
            {icon && (
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                {icon}
              </div>
            )}
            <span className="font-semibold text-gray-900 text-base">{title}</span>
          </div>
          <ChevronDownIcon
            className={cn(
              'w-5 h-5 text-gray-400 transition-transform',
              isOpen && 'rotate-180'
            )}
          />
        </button>
        {isOpen && (
          <div className="pb-6 space-y-5">
            {children}
          </div>
        )}
      </div>
    )
  }
)
CollapsibleSection.displayName = 'CollapsibleSection'

export { CollapsibleSection }

