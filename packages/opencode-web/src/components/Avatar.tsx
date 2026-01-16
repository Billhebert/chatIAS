import { type ReactNode } from 'react'

interface BadgeProps {
  children: ReactNode
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info'
  size?: 'sm' | 'md'
}

export function Badge({ children, variant = 'default', size = 'sm' }: BadgeProps) {
  const variants = {
    default: 'bg-gray-500/30 text-gray-300',
    success: 'bg-green-500/30 text-green-300',
    warning: 'bg-yellow-500/30 text-yellow-300',
    error: 'bg-red-500/30 text-red-300',
    info: 'bg-blue-500/30 text-blue-300',
    purple: 'bg-purple-500/30 text-purple-300'
  }

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm'
  }

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${variants[variant]} ${sizes[size]}`}>
      {children}
    </span>
  )
}

interface AvatarProps {
  src?: string
  name: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  status?: 'online' | 'offline' | 'busy' | 'away'
}

export function Avatar({ src, name, size = 'md', status }: AvatarProps) {
  const sizes = {
    sm: 'size-8 text-xs',
    md: 'size-10 text-sm',
    lg: 'size-12 text-base',
    xl: 'size-16 text-xl'
  }

  const statusColors = {
    online: 'bg-green-500',
    offline: 'bg-gray-400',
    busy: 'bg-red-500',
    away: 'bg-yellow-500'
  }

  const initials = (name || '').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="relative inline-flex">
      <div className={`
        ${sizes[size]} rounded-full bg-text-interactive-base/20 flex items-center justify-center text-text-interactive-base font-medium
        overflow-hidden
      `}>
        {src ? (
          <img src={src} alt={name} className="w-full h-full object-cover" />
        ) : (
          initials
        )}
      </div>
      {status && (
        <span className={`absolute bottom-0 right-0 size-3 rounded-full border-2 border-surface-raised-base ${statusColors[status]}`} />
      )}
    </div>
  )
}
