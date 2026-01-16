import { type SelectHTMLAttributes, forwardRef } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-text-base mb-1">
            {label}
          </label>
        )}
        <select
          ref={ref}
          className={`
            w-full bg-surface-raised-base border border-border-weak-base rounded-lg
            text-text-base
            focus:outline-none focus:ring-2 focus:ring-text-interactive-base/50 focus:border-text-interactive-base
            disabled:bg-surface-raised-hover disabled:text-text-disabled disabled:cursor-not-allowed
            transition-all duration-200 px-3 py-2 appearance-none cursor-pointer
            bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2378716C%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_0.75rem_center]
            pr-10
            ${error ? 'border-error-base focus:ring-error-base/50 focus:border-error-base' : ''}
            ${className}
          `}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="mt-1 text-sm text-text-error-strong">{error}</p>}
      </div>
    )
  }
)

Select.displayName = 'Select'
