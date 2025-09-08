"use client"

import { useState, useEffect } from "react"
import { Clock, Zap, Mail, Save } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"

function getDefaultScheduleSettings() {
  return {
    scrapeFrequency: "daily",
    emailNotifications: true,
    emailAddresses: "user@example.com",
    maxVideosPerEmail: "10",
    sendTime: "09:00",
  }
}

function getGlobalCriteria() {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('youtube-global-criteria')
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch {}
    }
  }
  return {
    viralMultiplier: 5,
    commentWeight: 500,
    likeWeight: 150,
    timeRange: '90'
  }
}

export function SchedulePage() {
  const [scheduleSettings, setScheduleSettings] = useState(getDefaultScheduleSettings())
  const [criteria] = useState(getGlobalCriteria())
  const { toast } = useToast()

  async function loadSettings() {
    try {
      const res = await fetch('/api/settings')
      if (!res.ok) {
        console.warn('Failed to load settings:', res.status, res.statusText)
        return
      }
      
      const settings = await res.json()
      
      // Parse schedule settings if they exist
      if (settings.scheduleSettings) {
        try {
          const parsedScheduleSettings = JSON.parse(settings.scheduleSettings)
          setScheduleSettings(parsedScheduleSettings)
        } catch (e) {
          console.warn('Failed to parse schedule settings:', e)
        }
      }
    } catch (error) {
      console.warn('Error loading settings:', error)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  const handleScheduleChange = (field: string, value: string | boolean) => {
    const newSettings = { ...scheduleSettings, [field]: value }
    setScheduleSettings(newSettings)
  }

  const handleSaveSchedule = async () => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            scheduleSettings: scheduleSettings
          }
        })
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || 'Failed to save settings')
      }

      toast({
        title: "Settings saved",
        description: "Your schedule settings have been saved successfully."
      })
    } catch (error: any) {
      console.error('Error saving settings:', error)
      toast({
        title: "Failed to save settings",
        description: error?.message || "An unexpected error occurred.",
        variant: "destructive"
      })
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Scrape Schedule Settings
          </CardTitle>
          <CardDescription>
            Configure how often to check for new content and when to send email notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-6">
            {/* Scraping Frequency */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Data Scraping Frequency
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="scrape-frequency">Check Frequency</Label>
                  <Select
                    value={scheduleSettings.scrapeFrequency}
                    onValueChange={(value) => handleScheduleChange("scrapeFrequency", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="2days">Every 2 Days</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Email Notifications */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Viral Video Notifications
                </CardTitle>
                <CardDescription>Get notified when videos go viral (exceed {criteria.viralMultiplier}x average views)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Enable Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive emails when viral videos are detected</p>
                  </div>
                  <Switch
                    checked={scheduleSettings.emailNotifications}
                    onCheckedChange={(checked) => handleScheduleChange("emailNotifications", checked)}
                  />
                </div>

                {scheduleSettings.emailNotifications && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Addresses</Label>
                      <Input
                        id="email"
                        type="text"
                        value={scheduleSettings.emailAddresses}
                        onChange={(e) => handleScheduleChange("emailAddresses", e.target.value)}
                        placeholder="email1@example.com, email2@example.com"
                      />
                      <p className="text-xs text-muted-foreground">Separate multiple email addresses with commas</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="max-videos">Max Videos Per Email</Label>
                      <Select
                        value={scheduleSettings.maxVideosPerEmail}
                        onValueChange={(value) => handleScheduleChange("maxVideosPerEmail", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select max videos" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5 videos</SelectItem>
                          <SelectItem value="10">10 videos</SelectItem>
                          <SelectItem value="15">15 videos</SelectItem>
                          <SelectItem value="20">20 videos</SelectItem>
                          <SelectItem value="unlimited">Unlimited</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Email Send Time */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Email Send Time
                </CardTitle>
                <CardDescription>What time of day should we send your email notifications?</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="send-time">Preferred Send Time</Label>
                  <Input
                    id="send-time"
                    type="time"
                    value={scheduleSettings.sendTime}
                    onChange={(e) => handleScheduleChange("sendTime", e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end">
              <Button onClick={handleSaveSchedule} className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                Save Settings
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
