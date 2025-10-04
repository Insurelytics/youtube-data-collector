"use client"

import { useState, useEffect } from "react"
import { MessageCircle, Heart, Settings, Clock, Plus, Edit2, Trash2, Save } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
 
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CriteriaEditor } from "./CriteriaEditor"

type CriteriaPreset = {
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

function getDefaultPresets(): CriteriaPreset[] {
  return [
    {
      id: 'default',
      name: 'Default',
      viralMultiplier: 5,
      commentWeight: 25,
      likeWeight: 10,
      timeRange: '120',
      viralMethod: 'subscribers',
      hideCta: true,
      includeDurationInEngagement: false,
      includeLikesCommentsInEngagement: false
    },
    {
      id: 'avg-view-based',
      name: 'Average View Based',
      viralMultiplier: 5,
      commentWeight: 25,
      likeWeight: 10,
      timeRange: '120',
      viralMethod: 'avgViews',
      hideCta: true,
      includeDurationInEngagement: false,
      includeLikesCommentsInEngagement: false
    },
    {
      id: 'advanced-engagement',
      name: 'Advanced Engagement',
      viralMultiplier: 5,
      commentWeight: 25,
      likeWeight: 10,
      timeRange: '120',
      viralMethod: 'subscribers',
      hideCta: true,
      includeDurationInEngagement: true,
      includeLikesCommentsInEngagement: true
    }
  ]
}

function getGlobalCriteria() {
  return {
    viralMultiplier: 5,
    commentWeight: 25,
    likeWeight: 10,
    timeRange: '',
    viralMethod: 'subscribers',
    hideCta: true,
    includeDurationInEngagement: false,
    includeLikesCommentsInEngagement: false
  }
}

function formatNumber(num: number) {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toFixed(0).toString()
}

export function CriteriaPage() {
  const initialCriteria = getGlobalCriteria();
  const [presets, setPresets] = useState<CriteriaPreset[]>(getDefaultPresets());
  const [selectedPresetId, setSelectedPresetId] = useState<string>('default');
  const [criteria, setCriteria] = useState(initialCriteria);
  const [commentWeightStr, setCommentWeightStr] = useState(initialCriteria.commentWeight.toString());
  const [likeWeightStr, setLikeWeightStr] = useState(initialCriteria.likeWeight.toString());
  const [newPresetName, setNewPresetName] = useState('');
  const [showNewPresetInput, setShowNewPresetInput] = useState(false);
  const [saveToPresetId, setSaveToPresetId] = useState<string>('');
  const [showEditor, setShowEditor] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit" | null>(null);
  const [editorInitialName, setEditorInitialName] = useState<string>("");

  useEffect(() => {
    // Load presets and selected preset
    try {
      const storedPresets = typeof window !== 'undefined' ? localStorage.getItem('youtube-criteria-presets') : null
      if (storedPresets) {
        setPresets(JSON.parse(storedPresets))
      } else {
        // Save default presets
        const defaults = getDefaultPresets()
        if (typeof window !== 'undefined') {
          localStorage.setItem('youtube-criteria-presets', JSON.stringify(defaults))
        }
      }

      const storedSelectedId = typeof window !== 'undefined' ? localStorage.getItem('youtube-selected-preset-id') : null
      const storedCriteria = typeof window !== 'undefined' ? localStorage.getItem('youtube-global-criteria') : null
      
      if (storedCriteria) {
        const parsed = JSON.parse(storedCriteria)
        setCriteria(parsed)
        if (storedSelectedId) {
          setSelectedPresetId(storedSelectedId)
        }
      } else {
        // Default to 120 days on first load
        const defaults = getDefaultPresets()
        const defaultPreset = defaults[0]
        setCriteria(defaultPreset)
        if (typeof window !== 'undefined') {
          localStorage.setItem('youtube-global-criteria', JSON.stringify(defaultPreset))
          localStorage.setItem('youtube-selected-preset-id', 'default')
        }
        fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settings: { globalCriteria: defaultPreset } })
        }).catch(() => {})
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setCommentWeightStr(criteria.commentWeight.toString());
    setLikeWeightStr(criteria.likeWeight.toString());
  }, [criteria.commentWeight, criteria.likeWeight]);

  const handlePresetChange = (presetId: string) => {
    const preset = presets.find(p => p.id === presetId)
    if (!preset) return

    const newCriteria = {
      viralMultiplier: preset.viralMultiplier,
      commentWeight: preset.commentWeight,
      likeWeight: preset.likeWeight,
      timeRange: preset.timeRange,
      viralMethod: preset.viralMethod,
      hideCta: preset.hideCta,
      includeDurationInEngagement: preset.includeDurationInEngagement,
      includeLikesCommentsInEngagement: preset.includeLikesCommentsInEngagement
    }

    setCriteria(newCriteria)
    setSelectedPresetId(presetId)

    if (typeof window !== 'undefined') {
      localStorage.setItem('youtube-global-criteria', JSON.stringify(newCriteria))
      localStorage.setItem('youtube-selected-preset-id', presetId)
    }

    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: { globalCriteria: newCriteria } })
    }).catch(err => console.warn('Failed to save criteria to database:', err))
  }

  const handleCriteriaChange = (field: string, value: any) => {
    const newCriteria = { ...criteria, [field]: value }
    setCriteria(newCriteria)
    
    // Update the current preset with new values
    const updatedPresets = presets.map(p => 
      p.id === selectedPresetId 
        ? { ...p, [field]: value }
        : p
    )
    setPresets(updatedPresets)

    // Store in both localStorage (for immediate frontend use) and database (for backend use)
    if (typeof window !== 'undefined') {
      localStorage.setItem('youtube-global-criteria', JSON.stringify(newCriteria))
      localStorage.setItem('youtube-criteria-presets', JSON.stringify(updatedPresets))
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

  const savePreset = (targetPresetId?: string) => {
    if (!targetPresetId && !newPresetName.trim()) return

    let updatedPresets: CriteriaPreset[]
    let finalSelectedId: string

    if (targetPresetId) {
      // Overwrite existing preset
      updatedPresets = presets.map(p => 
        p.id === targetPresetId 
          ? { ...p, ...criteria }
          : p
      )
      finalSelectedId = targetPresetId
    } else {
      // Create new preset
      const trimmedName = newPresetName.trim()
      
      // Check for duplicate names
      const existingPreset = presets.find(p => p.name.toLowerCase() === trimmedName.toLowerCase())
      if (existingPreset) {
        alert(`A preset named "${existingPreset.name}" already exists. Please choose a different name.`)
        return
      }

      const newPreset: CriteriaPreset = {
        id: `preset-${Date.now()}`,
        name: trimmedName,
        ...criteria
      }

      updatedPresets = [...presets, newPreset]
      finalSelectedId = newPreset.id
      setSelectedPresetId(newPreset.id)
    }

    setPresets(updatedPresets)
    setNewPresetName('')
    setShowNewPresetInput(false)
    setSaveToPresetId('')

    if (typeof window !== 'undefined') {
      localStorage.setItem('youtube-criteria-presets', JSON.stringify(updatedPresets))
      localStorage.setItem('youtube-selected-preset-id', finalSelectedId)
    }
  }

  return (
    <div className="space-y-6">
      {/* Preset Selector Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Criteria Presets
          </CardTitle>
          <CardDescription>
            Select a preset or create your own custom criteria configuration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="preset-select">Active Preset</Label>
              <Select value={selectedPresetId} onValueChange={handlePresetChange}>
                <SelectTrigger id="preset-select">
                  <SelectValue placeholder="Select a preset" />
                </SelectTrigger>
                <SelectContent>
                  {presets.map(preset => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {preset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
                        <Button 
              variant="outline"
              onClick={() => {
                const name = typeof window !== 'undefined' ? prompt('New preset name') : ''
                const trimmed = (name || '').trim()
                if (!trimmed) return
                const duplicate = presets.find(p => p.name.toLowerCase() === trimmed.toLowerCase())
                if (duplicate) {
                  alert(`A preset named "${duplicate.name}" already exists. Please choose a different name.`)
                  return
                }
                const defaults = getDefaultPresets()
                const base = defaults.find(p => p.id === 'default') || defaults[0]
                const newPreset = {
                  id: `preset-${Date.now()}`,
                  name: trimmed,
                  viralMultiplier: base.viralMultiplier,
                  commentWeight: base.commentWeight,
                  likeWeight: base.likeWeight,
                  timeRange: base.timeRange,
                  viralMethod: base.viralMethod,
                  hideCta: base.hideCta,
                  includeDurationInEngagement: base.includeDurationInEngagement,
                  includeLikesCommentsInEngagement: base.includeLikesCommentsInEngagement
                }
                const updated = [...presets, newPreset]
                setPresets(updated)
                setSelectedPresetId(newPreset.id)
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
                  localStorage.setItem('youtube-criteria-presets', JSON.stringify(updated))
                  localStorage.setItem('youtube-selected-preset-id', newPreset.id)
                  localStorage.setItem('youtube-global-criteria', JSON.stringify(newCriteria))
                }
                fetch('/api/settings', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ settings: { globalCriteria: newCriteria } })
                }).catch(() => {})
                setEditorMode('edit')
                setEditorInitialName('')
                setShowEditor(true)
              }}
              title="Create new preset"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create new
            </Button>
            {presets.find(p => p.id === selectedPresetId)?.name.toLowerCase() !== 'default' && (
              <Button 
                variant="outline"
                onClick={() => {
                  setEditorMode('edit')
                  setEditorInitialName('')
                  setShowEditor(true)
                }}
                title="Edit selected preset"
              >
                <Edit2 className="h-4 w-4 mr-2" />
                Edit preset
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {showEditor && editorMode && (
        <CriteriaEditor
          presets={presets}
          setPresets={setPresets}
          selectedPresetId={selectedPresetId}
          setSelectedPresetId={setSelectedPresetId}
          criteria={criteria}
          setCriteria={setCriteria}
          handleCriteriaChange={handleCriteriaChange}
          savePreset={savePreset}
          getDefaultPresets={getDefaultPresets}
          onClose={() => setShowEditor(false)}
          mode={editorMode}
          initialNewName={editorInitialName}
        />
      )}

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
                    {(() => {
                      const sampleViews = 1000;
                      const sampleComments = 100;
                      const sampleLikes = 50;
                      const sampleSeconds = 30; // 30s reel
                      const minutes = sampleSeconds / 60;
                      let score = 0;
                      if (criteria.includeDurationInEngagement) {
                        score += sampleViews * minutes;
                      } else {
                        score += sampleViews;
                      }
                      if (criteria.includeLikesCommentsInEngagement) {
                        score += (sampleComments * criteria.commentWeight) + (sampleLikes * criteria.likeWeight);
                      }
                      return `1K views${criteria.includeDurationInEngagement ? ` on a ${minutes} min reel` : ''}${criteria.includeLikesCommentsInEngagement ? ` + ${sampleComments} comments + ${sampleLikes} likes` : ''} = `;
                    })()} 
                    <strong>{(() => {
                      const sampleViews = 1000;
                      const sampleComments = 100;
                      const sampleLikes = 50;
                      const sampleSeconds = 30;
                      const minutes = sampleSeconds / 60;
                      let score = criteria.includeDurationInEngagement ? sampleViews * minutes : sampleViews;
                      if (criteria.includeLikesCommentsInEngagement) score += (sampleComments * criteria.commentWeight) + (sampleLikes * criteria.likeWeight);
                      // formatNumber expects integers; keep simple for display
                      return formatNumber(score);
                    })()}</strong> points
                  </p>
                </div>
                  <div className="space-y-2">
              <h4 className="font-medium text-sm">Time Range</h4>
              <p className="text-sm text-muted-foreground">
                Analysis period: <strong>{criteria.timeRange ? `${criteria.timeRange} days` : 'not set'}</strong>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
