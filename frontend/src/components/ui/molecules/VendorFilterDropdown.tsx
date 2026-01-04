import * as React from 'react'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/atoms/Checkbox'
import { Badge } from '@/components/ui/atoms/Badge'

export interface VendorFilterDropdownProps {
  vendors: string[]
  selectedVendors: Set<string>
  onVendorsChange: (vendors: Set<string>) => void
  vendorCounts?: Record<string, number> // Optional: show counts per vendor
}

const vendorLabels: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  groq: 'Groq',
  google: 'Google',
  deepseek: 'DeepSeek'
}

const vendorColors: Record<string, 'primary' | 'success' | 'info' | 'purple' | 'default'> = {
  openai: 'default',
  anthropic: 'purple',
  groq: 'info',
  google: 'success',
  deepseek: 'primary'
}

export function VendorFilterDropdown({
  vendors,
  selectedVendors,
  onVendorsChange,
  vendorCounts = {}
}: VendorFilterDropdownProps) {
  const [open, setOpen] = React.useState(false)
  
  const allSelected = vendors.length > 0 && vendors.every(v => selectedVendors.has(v))
  const someSelected = vendors.some(v => selectedVendors.has(v)) && !allSelected

  const handleToggleAll = (checked: boolean) => {
    if (checked) {
      onVendorsChange(new Set(vendors))
    } else {
      onVendorsChange(new Set())
    }
  }

  const handleToggleVendor = (vendor: string, checked: boolean) => {
    const newSelected = new Set(selectedVendors)
    if (checked) {
      newSelected.add(vendor)
    } else {
      newSelected.delete(vendor)
    }
    onVendorsChange(newSelected)
  }

  const displayText = React.useMemo(() => {
    if (allSelected) return 'All Vendors'
    if (selectedVendors.size === 0) return 'Select Vendors'
    if (selectedVendors.size === 1) {
      const vendor = Array.from(selectedVendors)[0]
      return vendorLabels[vendor] || vendor
    }
    return `${selectedVendors.size} Vendors`
  }, [selectedVendors, allSelected])

  return (
    <DropdownMenuPrimitive.Root open={open} onOpenChange={setOpen}>
      <DropdownMenuPrimitive.Trigger asChild>
        <button
          className={cn(
            'inline-flex items-center justify-between gap-2 px-4 py-2.5 min-w-[160px]',
            'border border-gray-200 rounded-lg bg-white text-sm font-medium',
            'hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400',
            'transition-colors',
            open && 'ring-2 ring-yellow-400 border-yellow-400'
          )}
        >
          <span className="text-gray-700">{displayText}</span>
          <svg
            className={cn(
              'w-4 h-4 text-gray-400 transition-transform',
              open && 'transform rotate-180'
            )}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </DropdownMenuPrimitive.Trigger>

      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          align="start"
          className={cn(
            'min-w-[240px] bg-white rounded-lg shadow-lg border border-gray-200',
            'p-2 z-50 max-h-[320px] overflow-y-auto'
          )}
          sideOffset={4}
        >
          {/* Select All */}
          <div className="px-3 py-2 border-b border-gray-100">
            <label className="flex items-center gap-2 cursor-pointer group">
              <Checkbox
                checked={allSelected}
                onCheckedChange={handleToggleAll}
                className="data-[state=checked]:bg-yellow-400 data-[state=checked]:border-yellow-400"
              />
              <span className="text-sm font-medium text-gray-900 group-hover:text-gray-700">
                Select All {someSelected && <span className="text-gray-500">(some selected)</span>}
              </span>
            </label>
          </div>

          {/* Vendor List */}
          <div className="py-1">
            {vendors.map((vendor) => {
              const isSelected = selectedVendors.has(vendor)
              const count = vendorCounts[vendor] || 0
              const label = vendorLabels[vendor] || vendor
              const color = vendorColors[vendor] || 'default'

              return (
                <DropdownMenuPrimitive.Item
                  key={vendor}
                  onSelect={(e) => e.preventDefault()}
                  className="outline-none"
                >
                  <label className="flex items-center justify-between gap-3 px-3 py-2 rounded-md cursor-pointer hover:bg-gray-50 group">
                    <div className="flex items-center gap-2 flex-1">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => handleToggleVendor(vendor, checked as boolean)}
                        className="data-[state=checked]:bg-yellow-400 data-[state=checked]:border-yellow-400"
                      />
                      <div className="flex items-center gap-2 flex-1">
                        <Badge variant={color} size="sm">
                          {label}
                        </Badge>
                        {count > 0 && (
                          <span className="text-xs text-gray-500">({count})</span>
                        )}
                      </div>
                    </div>
                  </label>
                </DropdownMenuPrimitive.Item>
              )
            })}
          </div>
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  )
}

