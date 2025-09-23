"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Loader2, Plus } from "lucide-react"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"

export default function NewWorkspacePage() {
  const [name, setName] = useState("")
  const [initialChannels, setInitialChannels] = useState("")
  const [driveFolderLink, setDriveFolderLink] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [nameTaken, setNameTaken] = useState(false)
  const router = useRouter()
  // useSearchParams must be read inside a client component's render or wrapped in Suspense.
  // For simplicity and to avoid a suspense boundary here, read the URL directly.
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null

  useEffect(() => {
    const prefill = searchParams?.get('name') || ''
    if (prefill) setName(prefill)
    // searchParams is derived from window.location, no dependencies needed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const ctrl = new AbortController()
    const n = name.trim()
    if (!n) { setNameTaken(false); return }
    ;(async () => {
      try {
        const res = await fetch(`/api/workspaces/validate?name=${encodeURIComponent(n)}`, { signal: ctrl.signal, credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          setNameTaken(!!data.nameTaken)
        }
      } catch {}
    })()
    return () => ctrl.abort()
  }, [name])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || nameTaken) return
    setIsSubmitting(true)
    try {
      const params = new URLSearchParams()
      params.set('name', name.trim())
      if (initialChannels.trim()) params.set('channels', initialChannels)
      if (driveFolderLink.trim()) params.set('sheet', driveFolderLink.trim())
      router.push(`/workspaces/new/share?${params.toString()}`)
    } catch (error) {
      alert('Failed to proceed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <ProtectedRoute>
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" /> Create Workspace</CardTitle>
            <CardDescription>Fill out the form to set up your workspace</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="ws-name">Display Name</Label>
                <Input
                  id="ws-name"
                  placeholder="e.g., My Project"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                {nameTaken && (
                  <p className="text-xs text-red-600">A workspace with this name already exists</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="ws-channels">Initial channels (optional)</Label>
                <Textarea
                  id="ws-channels"
                  placeholder={"instagram.com/username or username\nhttps://youtube.com/@channelname\n(one per line)"}
                  value={initialChannels}
                  onChange={(e) => setInitialChannels(e.target.value)}
                  rows={6}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ws-drive">Google Sheet link (optional)</Label>
                <Input
                  id="ws-drive"
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={driveFolderLink}
                  onChange={(e) => setDriveFolderLink(e.target.value)}
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={!name.trim() || nameTaken || isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Next
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
    </ProtectedRoute>
  )
}


