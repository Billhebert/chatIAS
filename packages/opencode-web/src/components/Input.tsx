import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  icon?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-text-base mb-1">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-subtle">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={`
              w-full bg-surface-raised-base border border-border-weak-base rounded-lg
              text-text-base placeholder-text-subtle
              focus:outline-none focus:ring-2 focus:ring-text-interactive-base/50 focus:border-text-interactive-base
              disabled:bg-surface-raised-hover disabled:text-text-disabled disabled:cursor-not-allowed
              transition-all duration-200
              ${icon ? 'pl-10 pr-3 py-2' : 'px-3 py-2'}
              ${error ? 'border-error-base focus:ring-error-base/50 focus:border-error-base' : ''}
              ${className}
            `}
            {...props}
          />
        </div>
        {error && <p className="mt-1 text-sm text-text-error-strong">{error}</p>}
        {hint && !error && <p className="mt-1 text-sm text-text-subtle">{hint}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-text-base mb-1">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={`
            w-full bg-surface-raised-base border border-border-weak-base rounded-lg
            text-text-base placeholder-text-subtle resize-none
            focus:outline-none focus:ring-2 focus:ring-text-interactive-base/50 focus:border-text-interactive-base
            disabled:bg-surface-raised-hover disabled:text-text-disabled disabled:cursor-not-allowed
            transition-all duration-200 px-3 py-2
            ${error ? 'border-error-base focus:ring-error-base/50 focus:border-error-base' : ''}
            ${className}
          `}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-text-error-strong">{error}</p>}
        {hint && !error && <p className="mt-1 text-sm text-text-subtle">{hint}</p>}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'
