"use client"

import { useState } from "react"
import { FolderOpen, FileSpreadsheet, Eye, CheckCircle, AlertCircle, ArrowLeft, Users, Instagram } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

const mockChannels = [
  {
    id: "1",
    companyName: "TechReview Pro LLC",
    channelName: "TechReview Pro",
    handle: "@techreviewpro",
    igHandle: "@techreviewpro_official",
    followerCount: 2500000,
    avatar: "/placeholder.svg?height=32&width=32&text=TR",
  },
  {
    id: "2",
    companyName: "Gaming Central Media",
    channelName: "Gaming Central",
    handle: "@gamingcentral",
    igHandle: "@gamingcentral_yt",
    followerCount: 1800000,
    avatar: "/placeholder.svg?height=32&width=32&text=GC",
  },
  {
    id: "3",
    companyName: "Cooking Masters Studio",
    channelName: "Cooking Masters",
    handle: "@cookingmasters",
    igHandle: "@cookingmasters_chef",
    followerCount: 950000,
    avatar: "/placeholder.svg?height=32&width=32&text=CM",
  },
  {
    id: "4",
    companyName: "Fitness First Productions",
    channelName: "Fitness First",
    handle: "@fitnessfirst",
    igHandle: "@fitnessfirst_official",
    followerCount: 1200000,
    avatar: "/placeholder.svg?height=32&width=32&text=FF",
  },
  {
    id: "5",
    companyName: "Travel Adventures Inc",
    channelName: "Travel Adventures",
    handle: "@traveladventures",
    igHandle: "@travel_adventures_world",
    followerCount: 850000,
    avatar: "/placeholder.svg?height=32&width=32&text=TA",
  },
  {
    id: "6",
    companyName: "DIY Home Solutions",
    channelName: "DIY Home",
    handle: "@diyhome",
    igHandle: "@diyhome_solutions",
    followerCount: 650000,
    avatar: "/placeholder.svg?height=32&width=32&text=DH",
  },
  {
    id: "7",
    companyName: "Music Makers Collective",
    channelName: "Music Makers",
    handle: "@musicmakers",
    igHandle: "@musicmakers_collective",
    followerCount: 1100000,
    avatar: "/placeholder.svg?height=32&width=32&text=MM",
  },
  {
    id: "8",
    companyName: "Science Explained Ltd",
    channelName: "Science Explained",
    handle: "@scienceexplained",
    igHandle: "@science_explained_yt",
    followerCount: 750000,
    avatar: "/placeholder.svg?height=32&width=32&text=SE",
  },
  {
    id: "9",
    companyName: "Fashion Forward Media",
    channelName: "Fashion Forward",
    handle: "@fashionforward",
    igHandle: "@fashionforward_style",
    followerCount: 920000,
    avatar: "/placeholder.svg?height=32&width=32&text=FF",
  },
  {
    id: "10",
    companyName: "Pet Care Experts",
    channelName: "Pet Care Pro",
    handle: "@petcarepro",
    igHandle: "@petcare_experts",
    followerCount: 580000,
    avatar: "/placeholder.svg?height=32&width=32&text=PC",
  },
]

export default function GoogleDrivePage() {
  const [isConnected, setIsConnected] = useState(false)
  const [selectedFolder, setSelectedFolder] = useState("")
  const [showPreview, setShowPreview] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const handleConnect = () => {
    setIsConnected(true)
    setSelectedFolder("YouTube Analytics Reports")
  }

  const handleCreateSpreadsheet = () => {
    setIsCreating(true)
    setTimeout(() => {
      setIsCreating(false)
      // Mock success
    }, 2000)
  }

  const totalFollowers = mockChannels.reduce((sum, channel) => sum + channel.followerCount, 0)
  const topChannel = mockChannels.reduce((prev, current) =>
    prev.followerCount > current.followerCount ? prev : current,
  )

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold mb-2">Google Drive Integration</h1>
            <p className="text-muted-foreground">Export your channel analytics data to Google Sheets</p>
          </div>
        </div>

        {/* Connection Status */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              Google Drive Connection
            </CardTitle>
            <CardDescription>Connect your Google Drive account to export channel data</CardDescription>
          </CardHeader>
          <CardContent>
            {!isConnected ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <AlertCircle className="h-4 w-4" />
                  <span>Not connected</span>
                </div>
                <Button onClick={handleConnect} className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4" />
                  Connect Google Drive
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span>Connected to Google Drive</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="text-sm font-medium mb-2 block">Selected Folder</label>
                    <Input
                      value={selectedFolder}
                      onChange={(e) => setSelectedFolder(e.target.value)}
                      placeholder="Enter folder name"
                    />
                  </div>
                  <Button variant="outline" className="mt-6 bg-transparent">
                    Browse Folders
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Spreadsheet Creation */}
        {isConnected && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Create Channel Data Spreadsheet
              </CardTitle>
              <CardDescription>
                Generate a spreadsheet with channel information including company names, Instagram handles, and follower
                counts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{mockChannels.length}</Badge>
                    <span>Total channels</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{formatNumber(totalFollowers)}</Badge>
                    <span>Combined followers</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">4</Badge>
                    <span>Data columns</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Dialog open={showPreview} onOpenChange={setShowPreview}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="flex items-center gap-2 bg-transparent">
                        <Eye className="h-4 w-4" />
                        Preview Data
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Spreadsheet Preview</DialogTitle>
                        <DialogDescription>
                          Preview of the channel data that will be exported to Google Sheets
                        </DialogDescription>
                      </DialogHeader>
                      <div className="mt-4">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Channel</TableHead>
                              <TableHead>Company Name</TableHead>
                              <TableHead>Instagram Handle</TableHead>
                              <TableHead>Follower Count</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {mockChannels.map((channel) => (
                              <TableRow key={channel.id}>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-6 w-6">
                                      <AvatarImage src={channel.avatar || "/placeholder.svg"} />
                                      <AvatarFallback className="text-xs">
                                        {channel.channelName.slice(0, 2)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <div className="font-medium">{channel.channelName}</div>
                                      <div className="text-xs text-muted-foreground">{channel.handle}</div>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="font-medium">{channel.companyName}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Instagram className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-sm">{channel.igHandle}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Users className="h-3 w-3 text-muted-foreground" />
                                    <span className="font-medium">{formatNumber(channel.followerCount)}</span>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Button onClick={handleCreateSpreadsheet} disabled={isCreating} className="flex items-center gap-2">
                    {isCreating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Creating...
                      </>
                    ) : (
                      <>
                        <FileSpreadsheet className="h-4 w-4" />
                        Create Spreadsheet
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Stats */}
        {isConnected && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Top Channel</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={topChannel.avatar || "/placeholder.svg"} />
                    <AvatarFallback>{topChannel.channelName.slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm leading-tight mb-1">{topChannel.channelName}</h4>
                    <p className="text-xs text-muted-foreground mb-2">{topChannel.companyName}</p>
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm font-medium">{formatNumber(topChannel.followerCount)} followers</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Total Reach</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold mb-2">{formatNumber(totalFollowers)}</div>
                <p className="text-sm text-muted-foreground">
                  Combined followers across {mockChannels.length} channels
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Export Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">Ready to Export</span>
                </div>
                <p className="text-sm text-muted-foreground">Channel data prepared for Google Sheets</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
