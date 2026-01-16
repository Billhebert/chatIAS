import { type ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
  hover?: boolean
}

export function Card({ children, className = '', padding = 'md', hover = false }: CardProps) {
  const paddings = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6'
  }

  return (
    <div className={`
      bg-surface-raised-base border border-border-weak-base rounded-xl
      ${paddings[padding]}
      ${hover ? 'hover:border-border-weak-hover hover:shadow-md transition-all duration-200 cursor-pointer' : ''}
      ${className}
    `}>
      {children}
    </div>
  )
}

interface CardHeaderProps {
  children: ReactNode
  className?: string
  action?: ReactNode
}

export function CardHeader({ children, className = '', action }: CardHeaderProps) {
  return (
    <div className={`flex items-center justify-between mb-4 ${className}`}>
      <h3 className="font-medium text-text-strong">{children}</h3>
      {action}
    </div>
  )
}

export function CardContent({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>
}
