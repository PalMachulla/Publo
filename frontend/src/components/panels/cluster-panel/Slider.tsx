'use client'

interface SliderProps {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  minLabel?: string
  maxLabel?: string
  showValue?: boolean
  valueFormatter?: (value: number) => string
}

export default function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  minLabel,
  maxLabel,
  showValue = true,
  valueFormatter = (v) => v.toString()
}: SliderProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        {showValue && (
          <span className="text-sm text-gray-600 font-medium">
            {valueFormatter(value)}
          </span>
        )}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-yellow-400"
      />
      {(minLabel || maxLabel) && (
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-gray-500">{minLabel}</span>
          <span className="text-xs text-gray-500">{maxLabel}</span>
        </div>
      )}
    </div>
  )
}

