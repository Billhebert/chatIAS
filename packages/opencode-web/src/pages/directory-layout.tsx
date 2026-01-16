import React, { useMemo } from 'react'
import { useParams, Navigate } from 'react-router-dom'

interface DirectoryLayoutProps {
  children: React.ReactNode
}

export default function DirectoryLayout({ children }: DirectoryLayoutProps) {
  const params = useParams()

  const directory = useMemo(() => {
    if (!params.dir) return null
    try {
      return atob(params.dir)
    } catch {
      return null
    }
  }, [params.dir])

  if (!params.dir || !directory) {
    return <Navigate to="/session" replace />
  }

  return <div className="size-full flex">{children}</div>
}
