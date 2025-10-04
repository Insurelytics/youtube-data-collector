import { useEffect, useState } from 'react'

export function useWorkspace() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)

  useEffect(() => {
    const checkWorkspace = () => {
      const match = document.cookie.match(/(?:^|; )workspaceId=([^;]+)/)
      const id = match ? decodeURIComponent(match[1]) : null
      setWorkspaceId(id)
    }

    checkWorkspace()
    
    // Poll for changes every 500ms
    const interval = setInterval(checkWorkspace, 500)
    
    return () => clearInterval(interval)
  }, [])

  return workspaceId
}
