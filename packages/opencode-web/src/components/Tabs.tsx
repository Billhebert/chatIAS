import { type ReactNode } from 'react'

interface TabsProps {
  tabs: { id: string; label: string; icon?: ReactNode }[]
  activeTab: string
  onChange: (tabId: string) => void
  className?: string
}

export function Tabs({ tabs, activeTab, onChange, className = '' }: TabsProps) {
  return (
    <div className={`flex gap-1 border-b border-border-weak-base ${className}`}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`
            flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-200
            border-b-2 -mb-px
            ${activeTab === tab.id
              ? 'text-text-interactive-base border-text-interactive-base'
              : 'text-text-subtle border-transparent hover:text-text-base hover:border-border-weak-hover'
            }
          `}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  )
}

interface TabPanelProps {
  children: ReactNode
  id: string
  activeId: string
}

export function TabPanel({ children, id, activeId }: TabPanelProps) {
  if (id !== activeId) return null
  return <div className="py-4">{children}</div>
}
