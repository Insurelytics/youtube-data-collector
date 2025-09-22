"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Plus, Database } from "lucide-react"

interface Workspace {
  id: string
  name: string
  dbFile: string
  userId?: string
  created_at: string
}

export default function NoWorkspace() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [newWorkspaceId, setNewWorkspaceId] = useState("")
  const [newWorkspaceName, setNewWorkspaceName] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetchWorkspaces()
  }, [])

  const fetchWorkspaces = async () => {
    try {
      const res = await fetch('/api/workspaces', {
        credentials: 'include'
      })
      if (res.ok) {
        const data = await res.json()
        setWorkspaces(data.workspaces || [])
      }
    } catch (error) {
      console.error('Failed to fetch workspaces:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const selectWorkspace = (id: string) => {
    document.cookie = `workspaceId=${encodeURIComponent(id)}; Path=/`
    router.push('/')
  }

  const createWorkspace = async () => {
    if (!newWorkspaceId.trim() || !newWorkspaceName.trim()) return
    
    setIsCreating(true)
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: newWorkspaceId, name: newWorkspaceName })
      })
      
      if (res.ok) {
        document.cookie = `workspaceId=${encodeURIComponent(newWorkspaceId)}; Path=/`
        router.push('/')
      } else {
        alert('Failed to create workspace')
      }
    } catch (error) {
      console.error('Failed to create workspace:', error)
      alert('Failed to create workspace')
    } finally {
      setIsCreating(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center">
          <Database className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h1 className="text-3xl font-bold mb-2">Choose a Workspace</h1>
          <p className="text-gray-600">Select an existing workspace or create a new one to get started</p>
        </div>

        {workspaces.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Existing Workspaces</CardTitle>
              <CardDescription>Select a workspace to continue</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {workspaces.map((workspace) => (
                <div key={workspace.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{workspace.name}</div>
                    <div className="text-sm text-gray-500">ID: {workspace.id}</div>
                  </div>
                  <Button onClick={() => selectWorkspace(workspace.id)}>
                    Select
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Create New Workspace
            </CardTitle>
            <CardDescription>Create a new workspace to organize your data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="workspace-id">Workspace ID</Label>
              <Input
                id="workspace-id"
                placeholder="e.g., my-project"
                value={newWorkspaceId}
                onChange={(e) => setNewWorkspaceId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              />
              <p className="text-xs text-gray-500">Only lowercase letters, numbers, and hyphens allowed</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="workspace-name">Display Name</Label>
              <Input
                id="workspace-name"
                placeholder="e.g., My Project"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
              />
            </div>
            <Button 
              onClick={createWorkspace} 
              disabled={!newWorkspaceId.trim() || !newWorkspaceName.trim() || isCreating}
              className="w-full"
            >
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Workspace
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


