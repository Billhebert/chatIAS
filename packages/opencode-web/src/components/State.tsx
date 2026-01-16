import { type ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon && <div className="text-4xl mb-4">{icon}</div>}
      <h3 className="text-lg font-medium text-text-strong mb-2">{title}</h3>
      {description && <p className="text-sm text-text-subtle mb-4 max-w-sm">{description}</p>}
      {action}
    </div>
  )
}

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
}

export function Loading({ size = 'md', text }: LoadingProps) {
  const sizes = {
    sm: 'size-4 border-2',
    md: 'size-6 border-2',
    lg: 'size-8 border-3'
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8">
      <div className={`
        ${sizes[size]} rounded-full border-text-interactive-base border-t-transparent animate-spin
      `} />
      {text && <p className="text-sm text-text-subtle">{text}</p>}
    </div>
  )
}

interface ProgressProps {
  value: number
  max?: number
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  color?: 'blue' | 'green' | 'yellow' | 'red'
}

export function Progress({ value, max = 100, size = 'md', showLabel, color = 'blue' }: ProgressProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100))
  
  const sizes = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  }

  const colors = {
    blue: 'bg-text-interactive-base',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500'
  }

  return (
    <div className="w-full">
      <div className={`w-full bg-surface-raised-base rounded-full overflow-hidden ${sizes[size]}`}>
        <div
          className={`${colors[color]} rounded-full transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <p className="text-xs text-text-subtle mt-1">{Math.round(percentage)}%</p>
      )}
    </div>
  )
}
