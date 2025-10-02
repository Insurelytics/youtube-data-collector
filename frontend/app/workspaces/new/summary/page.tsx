"use client"

import { useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle2 } from "lucide-react"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"

export default function NewWorkspaceSummaryPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [submitting, setSubmitting] = useState(false)

  const name = searchParams.get('name') || ''
  const channels = searchParams.get('channels') || ''

  const channelList = useMemo(() => channels ? channels.split(/\r?\n/).map(s => s.trim()).filter(Boolean) : [], [channels])

  const detectPlatform = (input: string): 'instagram' | 'youtube' => {
    const s = (input || '').trim()
    try {
      const u = new URL(s)
      const host = u.hostname.toLowerCase()
      if (host.includes('instagram.com')) return 'instagram'
      if (host.includes('youtube.com') || host.includes('youtu.be')) return 'youtube'
    } catch {}
    // Default to instagram for non-URLs
    return 'instagram'
  }

  const extractHandle = (input: string): string => {
    const s = (input || '').trim()
    if (!s) return ''
    // Strip leading @ if present
    const stripAt = (v: string) => v.replace(/^@+/, '')
    try {
      const u = new URL(s)
      const host = u.hostname.toLowerCase()
      if (host.includes('instagram.com')) {
        const seg = u.pathname.split('/').filter(Boolean)[0] || ''
        return stripAt(seg)
      }
      if (host.includes('youtube.com')) {
        // Support /@handle or /channel/ID (we accept the last segment or @handle)
        const path = u.pathname
        const atMatch = path.match(/@([^/]+)/)
        if (atMatch) return stripAt(atMatch[1])
        const seg = u.pathname.split('/').filter(Boolean).pop() || ''
        return stripAt(seg)
      }
      if (host.includes('youtu.be')) {
        const seg = u.pathname.split('/').filter(Boolean).pop() || ''
        return stripAt(seg)
      }
    } catch {}
    // Not a URL, assume plain username or @handle
    return stripAt(s)
  }

  const finish = async () => {
    if (!name.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, driveFolderId: null, spreadsheetId: null })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as any))
        alert(data?.error || 'Failed to create workspace')
        setSubmitting(false)
        return
      }
      const created = await res.json().catch(() => ({} as any))
      const newId = created?.id
      if (newId) {
        document.cookie = `workspaceId=${encodeURIComponent(newId)}; Path=/`
      }
      for (const raw of channelList) {
        try {
          const platform = detectPlatform(raw)
          const handle = extractHandle(raw)
          if (!handle) continue
          await fetch('/api/channels', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ handle, platform })
          })
        } catch {}
      }
      router.push('/')
      router.refresh()
    } catch (e) {
      alert('Failed to finish setup')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ProtectedRoute>
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" /> Review and Finish
            </CardTitle>
            <CardDescription>Confirm details before creating your workspace</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="text-sm text-gray-500">Name</div>
              <div className="font-medium">{name}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Initial channels</div>
              {channelList.length ? (
                <ul className="list-disc pl-6 text-sm">
                  {channelList.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              ) : (
                <div className="text-sm text-gray-500">None</div>
              )}
            </div>

            <div className="flex gap-2 pt-4 justify-end">
              <Button variant="outline" onClick={() => router.push('/workspaces/new')}>Back</Button>
              <Button onClick={finish} disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Finish
              </Button>
            </div>
          </CardContent>
            {/* <CardHeader>
              <CardTitle>Basics</CardTitle>
              <CardDescription>Workspace details</CardDescription>
            </CardHeader> */}
        </Card>
      </div>
    </div>
    </ProtectedRoute>
  )
}


