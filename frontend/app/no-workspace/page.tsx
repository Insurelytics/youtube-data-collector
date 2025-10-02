"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Plus, Database } from "lucide-react"
import { Navigation } from "@/components/shared/Navigation"

interface Workspace {
  id: string
  name: string
  dbFile: string
  userId?: string
  created_at: string
}

export default function NoWorkspace() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [newWorkspaceName, setNewWorkspaceName] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [confirmName, setConfirmName] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
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
    if (!newWorkspaceName.trim()) return
    setIsCreating(true)
    try {
      const params = new URLSearchParams()
      params.set('name', newWorkspaceName.trim())
      router.push(`/workspaces/new?${params.toString()}`)
    } finally {
      setIsCreating(false)
    }
  }

  const requestDelete = (id: string) => {
    setDeleteId(id)
    setConfirmName("")
  }

  const cancelDelete = () => {
    setDeleteId(null)
    setConfirmName("")
  }

  const confirmDelete = async (ws: Workspace) => {
    if (confirmName !== ws.name) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/workspaces/${encodeURIComponent(ws.id)}`, { method: 'DELETE', credentials: 'include' })
      if (res.ok) {
        await fetchWorkspaces()
        cancelDelete()
      }
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </>
    )
  }

  return (
    <>
      <Navigation />
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
                <div key={workspace.id} className="p-3 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{workspace.name}</div>
                      <div className="text-sm text-gray-500">ID: {workspace.id}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => selectWorkspace(workspace.id)}>
                        Select
                      </Button>
                      <Button variant="outline" onClick={() => requestDelete(workspace.id)}>
                        Delete
                      </Button>
                    </div>
                  </div>

                  {deleteId === workspace.id && (
                    <div className="space-y-2">
                      <div className="text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded p-3">
                        WARNING: Deleting a workspace is permanent and cannot be undone. This will remove the
                        workspace from your account and may make its associated data inaccessible. If you are not
                        absolutely sure, click Cancel now.
                      </div>
                      <Label htmlFor={`confirm-${workspace.id}`}>Type "{workspace.name}" to confirm deletion</Label>
                      <Input
                        id={`confirm-${workspace.id}`}
                        placeholder={workspace.name}
                        value={confirmName}
                        onChange={(e) => setConfirmName(e.target.value)}
                      />
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={cancelDelete}>Cancel</Button>
                        <Button
                          variant="destructive"
                          onClick={() => confirmDelete(workspace)}
                          disabled={confirmName !== workspace.name || isDeleting}
                        >
                          {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Confirm Delete
                        </Button>
                      </div>
                    </div>
                  )}
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
              disabled={!newWorkspaceName.trim() || isCreating}
              className="w-full"
            >
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Workspace
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
    </>
  )
}


