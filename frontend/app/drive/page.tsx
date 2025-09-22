"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { FolderOpen, FileSpreadsheet, Eye, CheckCircle, AlertCircle, Loader2, Save } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { Navigation } from "@/components/shared/Navigation"

export default function DrivePage() {
  const router = useRouter()
  const [serviceEmail, setServiceEmail] = useState<string>("")
  const [sheetLink, setSheetLink] = useState<string>("")
  const [sheetId, setSheetId] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [verified, setVerified] = useState<boolean | null>(null)
  const [sheetInfo, setSheetInfo] = useState<{ title: string | null, sheets: string[] } | null>(null)
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null)
  const [existingSheetId, setExistingSheetId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [createResult, setCreateResult] = useState<{ id: string, name: string } | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [channels, setChannels] = useState<Array<{ title: string, handle: string, subscriberCount?: number, platform?: string }>>([])
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState<{ ok: boolean, appended?: number, error?: string } | null>(null)
  const [autoExported, setAutoExported] = useState(false)

  // Load service account email for instructions
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/drive/service-email', { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          setServiceEmail(data.email || '')
        }
      } catch {}
    })()
  }, [])

  // Determine current workspace and whether spreadsheet already linked
  useEffect(() => {
    const match = document.cookie.match(/(?:^|; )workspaceId=([^;]+)/)
    const wsId = match ? decodeURIComponent(match[1]) : null
    setCurrentWorkspaceId(wsId)
    ;(async () => {
      try {
        const res = await fetch('/api/workspaces', { credentials: 'include' })
        if (!res.ok) return
        const data = await res.json()
        const ws = (data?.workspaces || []).find((w: any) => w.id === wsId)
        const sid = ws?.spreadsheetId || null
        if (sid && typeof sid === 'string') {
          setExistingSheetId(sid)
          // Load minimal sheet info
          try {
            const infoRes = await fetch(`/api/drive/sheet-info?id=${encodeURIComponent(sid)}`, { credentials: 'include' })
            if (infoRes.ok) {
              const info = await infoRes.json()
              setSheetInfo({ title: info?.title || null, sheets: info?.sheets || [] })
            }
          } catch {}
        }
      } catch {}
    })()
  }, [])

  // Load channels for preview
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/channels', { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          const rows = Array.isArray(data) ? data : (data?.rows || data)
          if (Array.isArray(rows)) {
            setChannels(rows)
          }
        }
      } catch {}
    })()
  }, [])

  const formatNumber = (num?: number) => {
    if (!num && num !== 0) return ''
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return String(num)
  }

  const extractSheetId = (url: string) => {
    const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
    return m ? m[1] : null
  }

  const checkSheet = async () => {
    setChecking(true)
    setVerified(null)
    setSheetInfo(null)
    try {
      const id = extractSheetId(sheetLink || '')
      setSheetId(id)
      if (!id) { setVerified(false); return }
      const res = await fetch(`/api/drive/check-sheet?id=${encodeURIComponent(id)}`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        const ok = !!data.ok
        setVerified(ok)
        if (ok) {
          const infoRes = await fetch(`/api/drive/sheet-info?id=${encodeURIComponent(id)}`, { credentials: 'include' })
          if (infoRes.ok) {
            const info = await infoRes.json()
            setSheetInfo({ title: info?.title || null, sheets: info?.sheets || [] })
          }
          // Save to workspace
          await fetch('/api/workspaces/current/spreadsheet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ spreadsheetId: id })
          })
          setExistingSheetId(id)
        }
      } else {
        setVerified(false)
      }
    } catch {
      setVerified(false)
    } finally {
      setChecking(false)
    }
  }

  const saveToSpreadsheet = async () => {
    setSaving(true)
    setSaveResult(null)
    try {
      const res = await fetch('/api/drive/export-channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({})
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to export')
      setSaveResult({ ok: true, appended: data?.appended || 0 })
    } catch (e: any) {
      setSaveResult({ ok: false, error: e?.message || 'Failed to export' })
    } finally {
      setSaving(false)
    }
  }

  // If a spreadsheet is already linked (from initial setup), auto-sync once on load
  useEffect(() => {
    if (existingSheetId && channels.length > 0 && !autoExported) {
      (async () => {
        try {
          await saveToSpreadsheet()
        } finally {
          setAutoExported(true)
        }
      })()
    }
  }, [existingSheetId, channels.length, autoExported])

  return (
    <ProtectedRoute>
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Google Sheets Integration</h1>
          <p className="text-muted-foreground">Share a spreadsheet with our service account</p>
        </div>

        {/* Spreadsheet share box */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Connect Google Sheets
            </CardTitle>
            <CardDescription>Share your spreadsheet with the service account so we can write data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm text-gray-500">Service email</div>
              <div className="flex gap-2">
                <Input value={serviceEmail} readOnly />
                <Button type="button" variant="outline" onClick={() => { if (serviceEmail) navigator.clipboard.writeText(serviceEmail) }}>Copy</Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm text-gray-500">Spreadsheet link</div>
              <Input
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={sheetLink}
                onChange={(e) => setSheetLink(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={checkSheet} disabled={checking}>
                {checking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Check access & Save
              </Button>
            </div>

            {verified === true && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-4 w-4" /> Access confirmed
              </div>
            )}
            {verified === false && (
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-4 w-4" /> No access yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* When spreadsheet already connected */}
        {existingSheetId && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Connected to Spreadsheet
              </CardTitle>
              <CardDescription>Workspace is linked to a Google Sheet</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-gray-500 mb-2">Spreadsheet ID</div>
              <div className="font-mono text-sm break-all mb-4">{existingSheetId}</div>
              {sheetInfo && (
                <div className="space-y-2">
                  <div className="text-sm">Title: {sheetInfo.title || 'Unknown'}</div>
                  <div className="text-sm text-gray-500">Sheets:</div>
                  <ul className="list-disc pl-6 text-sm">
                    {(sheetInfo.sheets || []).map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Preview data and optional sheet creation (kept for convenience) */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Preview Export Data
            </CardTitle>
            <CardDescription>See the data that would be written to your spreadsheet</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Dialog open={showPreview} onOpenChange={setShowPreview}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Preview Data
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Spreadsheet Preview</DialogTitle>
                    <DialogDescription>Preview of the channel data that will be exported</DialogDescription>
                  </DialogHeader>
                  <div className="mt-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Channel</TableHead>
                          <TableHead>Handle</TableHead>
                          <TableHead>Subscriber Count</TableHead>
                          <TableHead>Platform</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {channels.slice(0, 50).map((c: any, idx: number) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{c.title || c.channelName || '-'}</TableCell>
                            <TableCell>{c.handle || '-'}</TableCell>
                            <TableCell>{formatNumber(c.subscriberCount)}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{c.platform || 'youtube'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </DialogContent>
              </Dialog>
              {existingSheetId && (
                <Button onClick={saveToSpreadsheet} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {!saving && <Save className="h-4 w-4" />}
                  Save to Spreadsheet
                </Button>
              )}
            </div>
            {saveResult && (
              <div className={`text-sm ${saveResult.ok ? 'text-green-600' : 'text-red-600'}`}>
                {saveResult.ok ? `Appended ${saveResult.appended || 0} rows.` : saveResult.error}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
    </ProtectedRoute>
  )
}


