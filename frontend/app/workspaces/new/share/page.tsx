"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Button as UIButton } from "@/components/ui/button"
import { Loader2, Share2, Check } from "lucide-react"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { Navigation } from "@/components/shared/Navigation"

export default function ShareWorkspacePage() {
  const [serviceEmail, setServiceEmail] = useState<string>("")
  const [sheetLink, setSheetLink] = useState<string>("")
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<string | null>(null)
  const [verified, setVerified] = useState(false)
  const [copied, setCopied] = useState(false)
  const router = useRouter()
  const params = useSearchParams()

  useEffect(() => {
    const p = params?.get('sheet') || ''
    setSheetLink(p)
    ;(async () => {
      try {
        const res = await fetch('/api/drive/service-email', { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          setServiceEmail(data.email || '')
        }
      } catch {}
    })()
  }, [params])

  const extractSheetId = (url: string) => {
    const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
    return m ? m[1] : null
  }

  const checkShare = async () => {
    setChecking(true)
    setCheckResult(null)
    try {
      const id = extractSheetId(sheetLink || '')
      if (!id) {
        setCheckResult('Invalid spreadsheet link')
        return
      }
      const res = await fetch(`/api/drive/check-sheet?id=${encodeURIComponent(id)}`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        const ok = !!data.ok
        setVerified(ok)
        setCheckResult(ok ? 'Access confirmed!' : 'Not shared yet')
        if (ok) {
          await fetch('/api/workspaces/current/spreadsheet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ spreadsheetId: id })
          })
        }
      } else {
        setCheckResult('Failed to check share')
      }
    } catch (e) {
      setCheckResult('Failed to check share')
    } finally {
      setChecking(false)
    }
  }

  return (
    <ProtectedRoute>
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-6 py-10">
        <div className="w-full max-w-xl mx-auto">
          <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" /> Share Google Drive Folder
            </CardTitle>
            <CardDescription>Share your Drive folder with the service email so we can access your files</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="text-sm text-gray-500">Service email</div>
              <div className="flex gap-2">
                <Input value={serviceEmail} readOnly />
                <UIButton
                  type="button"
                  onClick={() => {
                    if (serviceEmail) {
                      navigator.clipboard.writeText(serviceEmail)
                      setCopied(true)
                      setTimeout(() => setCopied(false), 1600)
                    }
                  }}
                  variant={copied ? 'secondary' : 'outline'}
                >
                  {copied ? <><Check className="h-4 w-4" /> Copied</> : 'Copy'}
                </UIButton>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm text-gray-500">Spreadsheet link (optional)</div>
              <Input
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={sheetLink}
                onChange={(e) => setSheetLink(e.target.value)}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button onClick={checkShare} disabled={checking}>
                {checking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Check for share
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  const qs = new URLSearchParams()
                  const name = params?.get('name') || ''
                  if (name) qs.set('name', name)
                  const channels = params?.get('channels') || ''
                  if (channels) qs.set('channels', channels)
                  if (verified) qs.set('sheetId', extractSheetId(sheetLink || '') || '')
                  router.push(`/workspaces/new/summary${qs.toString() ? `?${qs.toString()}` : ''}`)
                }}
              >{verified ? 'Next' : 'Skip'}</Button>
            </div>

            {checkResult && (
              <div className={"text-sm " + (checkResult === 'Access confirmed!' ? 'text-green-600' : 'text-red-600')}>
                {checkResult}
              </div>
            )}
          </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </ProtectedRoute>
  )
}


