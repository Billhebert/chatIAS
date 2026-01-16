import { useEffect, useRef, type ReactNode } from 'react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  footer?: ReactNode
}

export function Modal({ isOpen, onClose, title, children, size = 'md', footer }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-full mx-4'
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === overlayRef.current && onClose()}
    >
      <div className={`
        w-full bg-surface-raised-base border border-border-weak-base rounded-xl shadow-xl
        animate-in fade-in zoom-in duration-200
        ${sizes[size]}
        max-h-[90vh] flex flex-col
      `}>
        {title && (
          <div className="flex items-center justify-between p-4 border-b border-border-weak-base">
            <h2 className="text-lg font-semibold text-text-strong">{title}</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-surface-raised-hover rounded-lg text-text-subtle transition-colors"
            >
              <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-4">
          {children}
        </div>
        {footer && (
          <div className="flex items-center justify-end gap-2 p-4 border-t border-border-weak-base">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
