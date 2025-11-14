import * as React from 'react'
import * as SliderPrimitive from '@radix-ui/react-slider'
import { cn } from '@/lib/utils'

export interface SliderProps
  extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  label?: string
  minLabel?: string
  maxLabel?: string
  showValue?: boolean
  valueFormatter?: (value: number) => string
}

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(
  (
    {
      className,
      label,
      minLabel,
      maxLabel,
      showValue = true,
      valueFormatter = (v) => v.toString(),
      value,
      defaultValue,
      ...props
    },
    ref
  ) => {
    const currentValue = value?.[0] ?? defaultValue?.[0] ?? 0

    return (
      <div className="w-full">
        {label && (
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">{label}</label>
            {showValue && (
              <span className="text-sm text-gray-600 font-medium">
                {valueFormatter(currentValue)}
              </span>
            )}
          </div>
        )}
        <SliderPrimitive.Root
          ref={ref}
          className={cn(
            'relative flex w-full touch-none select-none items-center',
            className
          )}
          value={value}
          defaultValue={defaultValue}
          {...props}
        >
          <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-gray-200">
            <SliderPrimitive.Range className="absolute h-full bg-yellow-400" />
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-2 border-yellow-400 bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" />
        </SliderPrimitive.Root>
        {(minLabel || maxLabel) && (
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-gray-500">{minLabel}</span>
            <span className="text-xs text-gray-500">{maxLabel}</span>
          </div>
        )}
      </div>
    )
  }
)
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }

