"use client"

import { useEffect, useState } from "react"
import { MessageCircle, Heart, Edit2, Clock, Plus, Save, Trash2, X, RotateCcw } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"

export type CriteriaPreset = {
  id: string
  name: string
  viralMultiplier: number
  commentWeight: number
  likeWeight: number
  timeRange: string
  viralMethod: string
  hideCta: boolean
  includeDurationInEngagement: boolean
  includeLikesCommentsInEngagement: boolean
}

type Criteria = Omit<CriteriaPreset, 'id' | 'name'>

type CriteriaEditorProps = {
  presets: CriteriaPreset[]
  setPresets: (p: CriteriaPreset[]) => void
  selectedPresetId: string
  setSelectedPresetId: (id: string) => void
  criteria: Criteria
  setCriteria: (c: Criteria) => void
  handleCriteriaChange: (field: string, value: any) => void
  savePreset: (targetPresetId?: string) => void
  getDefaultPresets: () => CriteriaPreset[]
  onClose: () => void
  mode: 'create' | 'edit'
  initialNewName?: string
}

export function CriteriaEditor(props: CriteriaEditorProps) {
  const { presets, setPresets, selectedPresetId, setSelectedPresetId, criteria, setCriteria, handleCriteriaChange, getDefaultPresets, onClose, mode, initialNewName } = props

  const [commentWeightStr, setCommentWeightStr] = useState(criteria.commentWeight.toString())
  const [likeWeightStr, setLikeWeightStr] = useState(criteria.likeWeight.toString())

  useEffect(() => {
    setCommentWeightStr(criteria.commentWeight.toString())
    setLikeWeightStr(criteria.likeWeight.toString())
  }, [criteria.commentWeight, criteria.likeWeight])

  const selectedPreset = presets.find(p => p.id === selectedPresetId)
  const isDefaultPreset = selectedPreset?.name.toLowerCase() === 'default'

  const handleSaveCreate = () => {
    const name = (initialNewName || '').trim()
    if (!name) return
    const duplicate = presets.find(p => p.name.toLowerCase() === name.toLowerCase())
    if (duplicate) {
      alert(`A preset named "${duplicate.name}" already exists. Please choose a different name.`)
      return
    }
    const newPreset: CriteriaPreset = {
      id: `preset-${Date.now()}`,
      name,
      viralMultiplier: criteria.viralMultiplier,
      commentWeight: criteria.commentWeight,
      likeWeight: criteria.likeWeight,
      timeRange: criteria.timeRange,
      viralMethod: criteria.viralMethod,
      hideCta: criteria.hideCta,
      includeDurationInEngagement: criteria.includeDurationInEngagement,
      includeLikesCommentsInEngagement: criteria.includeLikesCommentsInEngagement
    }
    const updated = [...presets, newPreset]
    setPresets(updated)
    setSelectedPresetId(newPreset.id)
    if (typeof window !== 'undefined') {
      localStorage.setItem('youtube-criteria-presets', JSON.stringify(updated))
      localStorage.setItem('youtube-selected-preset-id', newPreset.id)
      localStorage.setItem('youtube-global-criteria', JSON.stringify(newPreset))
    }
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: { globalCriteria: newPreset } })
    }).catch(() => {})
    onClose()
  }

  const handleSaveEdit = () => {
    const target = presets.find(p => p.id === selectedPresetId)
    if (!target) return
    const updatedPresets = presets.map(p => p.id === selectedPresetId ? {
      ...p,
      viralMultiplier: criteria.viralMultiplier,
      commentWeight: criteria.commentWeight,
      likeWeight: criteria.likeWeight,
      timeRange: criteria.timeRange,
      viralMethod: criteria.viralMethod,
      hideCta: criteria.hideCta,
      includeDurationInEngagement: criteria.includeDurationInEngagement,
      includeLikesCommentsInEngagement: criteria.includeLikesCommentsInEngagement
    } : p)
    setPresets(updatedPresets)
    if (typeof window !== 'undefined') {
      localStorage.setItem('youtube-criteria-presets', JSON.stringify(updatedPresets))
      localStorage.setItem('youtube-selected-preset-id', selectedPresetId)
      localStorage.setItem('youtube-global-criteria', JSON.stringify(criteria))
    }
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: { globalCriteria: criteria } })
    }).catch(() => {})
    onClose()
  }

  const handleReset = () => {
    const defaultPresets = getDefaultPresets()
    const defaultPreset = defaultPresets.find(p => p.id === selectedPresetId) || defaultPresets[0]
    const defaultCriteria = {
      viralMultiplier: defaultPreset.viralMultiplier,
      commentWeight: defaultPreset.commentWeight,
      likeWeight: defaultPreset.likeWeight,
      timeRange: defaultPreset.timeRange,
      viralMethod: defaultPreset.viralMethod,
      hideCta: defaultPreset.hideCta,
      includeDurationInEngagement: defaultPreset.includeDurationInEngagement,
      includeLikesCommentsInEngagement: defaultPreset.includeLikesCommentsInEngagement
    }
    setCriteria(defaultCriteria)

    const updatedPresets = presets.map(p => 
      p.id === selectedPresetId ? { ...p, ...defaultCriteria } : p
    )
    setPresets(updatedPresets)

    if (typeof window !== 'undefined') {
      localStorage.setItem('youtube-global-criteria', JSON.stringify(defaultCriteria))
      localStorage.setItem('youtube-criteria-presets', JSON.stringify(updatedPresets))
    }
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settings: { globalCriteria: defaultCriteria }
      })
    }).catch(() => {})
  }

  const handleDelete = () => {
    if (isDefaultPreset) return
    if (presets.length <= 1) {
      alert('Cannot delete the last preset')
      return
    }
    const toDelete = presets.find(p => p.id === selectedPresetId)
    if (!toDelete) return
    if (toDelete.name.toLowerCase() === 'default') return
    if (confirm(`Delete preset "${toDelete.name}"?`)) {
      const updatedPresets = presets.filter(p => p.id !== selectedPresetId)
      setPresets(updatedPresets)
      const newSelectedId = updatedPresets[0].id
      setSelectedPresetId(newSelectedId)

      const newPreset = updatedPresets[0]
      const newCriteria = {
        viralMultiplier: newPreset.viralMultiplier,
        commentWeight: newPreset.commentWeight,
        likeWeight: newPreset.likeWeight,
        timeRange: newPreset.timeRange,
        viralMethod: newPreset.viralMethod,
        hideCta: newPreset.hideCta,
        includeDurationInEngagement: newPreset.includeDurationInEngagement,
        includeLikesCommentsInEngagement: newPreset.includeLikesCommentsInEngagement
      }
      setCriteria(newCriteria)

      if (typeof window !== 'undefined') {
        localStorage.setItem('youtube-criteria-presets', JSON.stringify(updatedPresets))
        localStorage.setItem('youtube-selected-preset-id', newSelectedId)
        localStorage.setItem('youtube-global-criteria', JSON.stringify(newCriteria))
      }

      fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { globalCriteria: newCriteria } })
      }).catch(() => {})
      onClose()
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Edit2 className="h-5 w-5" />
            Editor
          </CardTitle>
          <CardDescription>
            {mode === 'edit' ? (
              <>Configure criteria and manage presets. {isDefaultPreset ? 'Default preset is view-only.' : ''}</>
            ) : (
              <>Creating new preset: <strong>{initialNewName}</strong></>
            )}
          </CardDescription>
        </div>
        <Button variant="outline" onClick={onClose}>
          <X className="h-4 w-4 mr-2" />
          Close
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="p-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                <h3 className="font-semibold">Viral Video Threshold</h3>
              </div>
              <div className="space-y-2">
                <Label htmlFor="viral-multiplier">Viral Multiplier</Label>
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
                    disabled={mode === 'edit' && isDefaultPreset}
                  />
                  <span className="text-sm text-muted-foreground">x</span>
                </div>
                <div className="space-y-2" style={{ maxWidth: 300 }}>
                  <Label htmlFor="viral-method">Viral Threshold Based On</Label>
                  <Select
                    value={criteria.viralMethod || 'subscribers'}
                    onValueChange={(value) => handleCriteriaChange('viralMethod', value)}
                    disabled={mode === 'edit' && isDefaultPreset}
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
                    <Label htmlFor="hide-cta">Hide CTA-bait videos</Label>
                    <span className="text-xs text-muted-foreground">Filter videos where many comments are the same</span>
                  </div>
                  <Switch id="hide-cta" checked={!!criteria.hideCta} onCheckedChange={(val) => handleCriteriaChange('hideCta', !!val)} disabled={mode === 'edit' && isDefaultPreset} />
                </div>
              </div>
            </div>
          </Card>

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
                      value={commentWeightStr}
                      onChange={(e) => setCommentWeightStr(e.target.value)}
                      onBlur={() => {
                        const val = parseFloat(commentWeightStr) || 0;
                        if (val !== criteria.commentWeight) {
                          handleCriteriaChange('commentWeight', val);
                        }
                      }}
                      className="w-20"
                      disabled={mode === 'edit' && isDefaultPreset}
                    />
                    <span className="text-sm text-muted-foreground">points per comment</span>
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
                      value={likeWeightStr}
                      onChange={(e) => setLikeWeightStr(e.target.value)}
                      onBlur={() => {
                        const val = parseFloat(likeWeightStr) || 0;
                        if (val !== criteria.likeWeight) {
                          handleCriteriaChange('likeWeight', val);
                        }
                      }}
                      className="w-20"
                      disabled={mode === 'edit' && isDefaultPreset}
                    />
                    <span className="text-sm text-muted-foreground">points per like</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex flex-col gap-0.5">
                    <Label htmlFor="include-duration">Include video length in engagement</Label>
                    <span className="text-xs text-muted-foreground">When off, views are counted plainly (no duration multiplier)</span>
                  </div>
                  <Switch id="include-duration" checked={!!criteria.includeDurationInEngagement} onCheckedChange={(val) => handleCriteriaChange('includeDurationInEngagement', !!val)} disabled={mode === 'edit' && isDefaultPreset} />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <Label htmlFor="include-likes-comments">Include likes and comments</Label>
                    <span className="text-xs text-muted-foreground">When off, engagement uses only views</span>
                  </div>
                  <Switch id="include-likes-comments" checked={!!criteria.includeLikesCommentsInEngagement} onCheckedChange={(val) => handleCriteriaChange('includeLikesCommentsInEngagement', !!val)} disabled={mode === 'edit' && isDefaultPreset} />
                </div>
              </div>
            </div>
          </Card>

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
                    disabled={mode === 'edit' && isDefaultPreset}
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

        <div className="flex justify-end items-end gap-2">
          {mode === 'edit' && (
            <>
              <Button 
                variant="outline" 
                onClick={handleReset}
                disabled={isDefaultPreset}
                title="Reset to preset defaults"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset to Preset Defaults
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDefaultPreset}
                title="Delete preset"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete preset
              </Button>
              <Button onClick={handleSaveEdit} title="Save changes to preset">
                <Save className="h-4 w-4 mr-2" />
                Save to Preset
              </Button>
            </>
          )}
          {mode === 'create' && (
            <Button onClick={handleSaveCreate} title="Create preset">
              <Save className="h-4 w-4 mr-2" />
              Save as New Preset
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
