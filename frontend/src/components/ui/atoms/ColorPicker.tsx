import * as React from 'react'
import { HexColorPicker } from 'react-colorful'
import { cn } from '@/lib/utils'
import { Input } from './Input'
import { Label } from './Label'

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  label?: string
  presets?: string[]
}

const DEFAULT_PRESETS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#64748b', '#6b7280', '#9ca3af'
]

const ColorPicker = React.forwardRef<HTMLDivElement, ColorPickerProps>(
  ({ value, onChange, label, presets = DEFAULT_PRESETS }, ref) => {
    const [isOpen, setIsOpen] = React.useState(false)
    const [localValue, setLocalValue] = React.useState(value)
    const popoverRef = React.useRef<HTMLDivElement>(null)

    // Sync local value with prop value
    React.useEffect(() => {
      setLocalValue(value)
    }, [value])

    // Close popover when clicking outside
    React.useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
          setIsOpen(false)
        }
      }

      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside)
      }

      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }, [isOpen])

    const handleColorChange = (newColor: string) => {
      setLocalValue(newColor)
      onChange(newColor)
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value
      setLocalValue(newValue)
      
      // Only update if it's a valid hex color
      if (/^#[0-9A-Fa-f]{6}$/.test(newValue)) {
        onChange(newValue)
      }
    }

    return (
      <div ref={ref} className="relative">
        {label && <Label className="mb-2">{label}</Label>}
        
        <div className="flex items-center gap-3">
          {/* Color Swatch Button */}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="w-14 h-10 rounded-lg border-2 border-gray-300 hover:border-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 shadow-sm overflow-hidden"
            style={{ backgroundColor: localValue }}
          >
            <span className="sr-only">Pick color</span>
          </button>

          {/* Hex Input */}
          <Input
            type="text"
            value={localValue}
            onChange={handleInputChange}
            placeholder="#000000"
            pattern="^#[0-9A-Fa-f]{6}$"
            maxLength={7}
            className="flex-1 font-mono uppercase"
          />
        </div>

        {/* Color Picker Popover */}
        {isOpen && (
          <div
            ref={popoverRef}
            className="absolute z-50 mt-2 p-4 bg-white border border-gray-200 rounded-xl shadow-xl"
          >
            {/* Color Wheel */}
            <div className="mb-4">
              <HexColorPicker color={localValue} onChange={handleColorChange} />
            </div>

            {/* Preset Colors */}
            <div className="space-y-2">
              <Label className="text-xs">Quick Colors</Label>
              <div className="grid grid-cols-10 gap-2">
                {presets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleColorChange(preset)}
                    className={cn(
                      'w-6 h-6 rounded-md border-2 transition-all hover:scale-110',
                      preset === localValue
                        ? 'border-gray-900 ring-2 ring-yellow-400 ring-offset-1'
                        : 'border-gray-300 hover:border-gray-400'
                    )}
                    style={{ backgroundColor: preset }}
                  >
                    <span className="sr-only">{preset}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Custom Styles for react-colorful */}
        <style jsx global>{`
          .react-colorful {
            width: 240px !important;
            height: 180px !important;
          }
          
          .react-colorful__saturation {
            border-radius: 8px 8px 0 0;
            border-bottom: none;
          }
          
          .react-colorful__hue {
            height: 16px;
            border-radius: 8px;
            margin-top: 12px;
          }
          
          .react-colorful__pointer {
            width: 20px;
            height: 20px;
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          }
          
          .react-colorful__hue-pointer {
            width: 20px;
            height: 20px;
          }
        `}</style>
      </div>
    )
  }
)

ColorPicker.displayName = 'ColorPicker'

export { ColorPicker }

