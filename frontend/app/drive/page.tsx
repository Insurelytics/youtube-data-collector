"use client"

import { useEffect, useState } from "react"
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
  const [copied, setCopied] = useState(false)

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
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    if (serviceEmail) {
                      await navigator.clipboard.writeText(serviceEmail)
                      setCopied(true)
                      setTimeout(() => setCopied(false), 1200)
                    }
                  }}
                >
                  {copied ? "Copied!" : "Copy"}
                </Button>
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
              <Button onClick={checkSheet} disabled={checking || !sheetLink}>
                {checking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Check access
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
      </div>
    </div>
    </ProtectedRoute>
  )
}


