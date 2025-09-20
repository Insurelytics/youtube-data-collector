"use client"

import { useState, useEffect } from "react"
import { MessageCircle, Heart, Settings, Clock } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
 
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

function getGlobalCriteria() {
  return {
    viralMultiplier: 5,
    commentWeight: 500,
    likeWeight: 150,
    timeRange: '',
    viralMethod: 'subscribers',
    hideCta: false
  }
}

function formatNumber(num: number) {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toFixed(0).toString()
}

export function CriteriaPage() {
  const [criteria, setCriteria] = useState(getGlobalCriteria())

  useEffect(() => {
    // Load client-side to avoid hydration mismatch
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('youtube-global-criteria') : null
      if (stored) {
        const parsed = JSON.parse(stored)
        setCriteria(prev => ({ ...prev, ...parsed }))
      } else {
        // Default to 120 days on first load
        const initial = { ...criteria, timeRange: '120', viralMethod: 'subscribers', hideCta: false }
        setCriteria(initial)
        if (typeof window !== 'undefined') {
          localStorage.setItem('youtube-global-criteria', JSON.stringify(initial))
        }
        fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settings: { globalCriteria: initial } })
        }).catch(() => {})
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCriteriaChange = (field: string, value: any) => {
    const newCriteria = { ...criteria, [field]: value }
    setCriteria(newCriteria)
    
    // Store in both localStorage (for immediate frontend use) and database (for backend use)
    if (typeof window !== 'undefined') {
      localStorage.setItem('youtube-global-criteria', JSON.stringify(newCriteria))
    }
    
    // Save to database for backend access
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settings: {
          globalCriteria: newCriteria
        }
      })
    }).catch(err => console.warn('Failed to save criteria to database:', err))
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Global Analytics Criteria
          </CardTitle>
          <CardDescription>
            Set global criteria for viral video detection and engagement scoring across all channels
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            {/* Viral Video Criteria */}
            <Card className="p-4">
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <h3 className="font-semibold">Viral Video Threshold</h3>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="viral-multiplier">
                    Viral Multiplier
                  </Label>
                  <div className="flex items-center gap-3">
                    <Input
                      id="viral-multiplier"
                      type="number"
                      min="1"
                      max="100"
                      step="0.5"
                      value={criteria.viralMultiplier}
                      onChange={(e) => handleCriteriaChange('viralMultiplier', parseFloat(e.target.value) || 5)}
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">x</span>
                  </div>
                  <div className="space-y-2" style={{ maxWidth: 300 }}>
                    <Label htmlFor="viral-method">Viral Threshold Based On</Label>
                    <Select
                      value={criteria.viralMethod || 'subscribers'}
                      onValueChange={(value) => handleCriteriaChange('viralMethod', value)}
                    >
                      <SelectTrigger id="viral-method" className="w-full">
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="subscribers">Channel subscribers/followers</SelectItem>
                        <SelectItem value="avgViews">Average views</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                <div className="flex items-center justify-between pt-2">
                  <div className="flex flex-col gap-0.5">
                    <Label htmlFor="hide-cta">Hide CTA-bait videos globally</Label>
                    <span className="text-xs text-muted-foreground">Filter videos where comments look like mass call-to-action responses</span>
                  </div>
                  <Switch id="hide-cta" checked={!!criteria.hideCta} onCheckedChange={(val) => handleCriteriaChange('hideCta', !!val)} />
                </div>
                  <p className="text-xs text-muted-foreground">
                    Videos need {criteria.viralMultiplier}x+ more views than {criteria.viralMethod === 'avgViews' ? 'average views' : 'subscriber count'} to be considered viral
                  </p>
                </div>
              </div>
            </Card>

            {/* Engagement Weights */}
            <Card className="p-4">
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <h3 className="font-semibold">Engagement Weights</h3>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="comment-weight" className="flex items-center gap-2">
                      <MessageCircle className="h-3 w-3" />
                      Comment Weight
                    </Label>
                    <div className="flex items-center gap-3">
                      <Input
                        id="comment-weight"
                        type="number"
                        min="0"
                        max="10000"
                        step="10"
                        value={criteria.commentWeight}
                        onChange={(e) => handleCriteriaChange('commentWeight', parseFloat(e.target.value) || 500)}
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">
                        points per comment
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="like-weight" className="flex items-center gap-2">
                      <Heart className="h-3 w-3" />
                      Like Weight
                    </Label>
                    <div className="flex items-center gap-3">
                      <Input
                        id="like-weight"
                        type="number"
                        min="0"
                        max="10000"
                        step="10"
                        value={criteria.likeWeight}
                        onChange={(e) => handleCriteriaChange('likeWeight', parseFloat(e.target.value) || 150)}
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">
                        points per like
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Time Range */}
            <Card className="p-4">
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <h3 className="font-semibold">Time Range</h3>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time-range" className="flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    Analysis Period
                  </Label>
                  <div className="flex items-center gap-3">
                    <Input
                      id="time-range"
                      type="number"
                      min="1"
                      max="36500"
                      step="1"
                      value={criteria.timeRange || ''}
                      onChange={(e) => handleCriteriaChange('timeRange', e.target.value)}
                      className="w-28"
                    />
                    <span className="text-sm text-muted-foreground">days</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Analysis includes videos from the last {criteria.timeRange ? `${criteria.timeRange} days` : 'selected period'}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Preview Section */}
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="text-lg">Preview</CardTitle>
              <CardDescription>
                How your criteria affects analysis across all channels
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Viral Video Detection</h4>
                  <p className="text-sm text-muted-foreground">
                    A channel with 10K {criteria.viralMethod === 'avgViews' ? 'average views' : 'subscribers'} needs <strong>{formatNumber(10000 * criteria.viralMultiplier)}</strong> views 
                    for a video to be considered viral
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Engagement Score Example</h4>
                  <p className="text-sm text-muted-foreground">
                    1K views + 100 comments + 50 likes = 
                    <strong> {formatNumber(1000 + (100 * criteria.commentWeight) + (50 * criteria.likeWeight))}</strong> points
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Reset Button */}
          <div className="flex justify-end">
            <Button 
              variant="outline" 
              onClick={() => {
                const defaultCriteria = { viralMultiplier: 5, commentWeight: 500, likeWeight: 150, timeRange: '120', viralMethod: 'subscribers', hideCta: false }
                setCriteria(defaultCriteria)
                if (typeof window !== 'undefined') {
                  localStorage.setItem('youtube-global-criteria', JSON.stringify(defaultCriteria))
                }
                // Save to database
                fetch('/api/settings', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    settings: {
                      globalCriteria: defaultCriteria
                    }
                  })
                }).catch(err => console.warn('Failed to save default criteria to database:', err))
              }}
            >
              Reset to Defaults
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
