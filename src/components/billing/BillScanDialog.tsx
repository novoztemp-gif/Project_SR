import * as React from 'react'
import { Camera, ImageUp, ScanLine } from 'lucide-react'
import { toast } from 'sonner'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { extractBillFromImage, type ParsedBill } from '@/lib/billScan'

interface BillScanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onExtract: (bill: ParsedBill) => void
  initialImageDataUrl?: string
  extractingLabel?: string
}

export function BillScanDialog({
  open,
  onOpenChange,
  onExtract,
  initialImageDataUrl,
  extractingLabel = 'Extracting...',
}: BillScanDialogProps) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null)
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const streamRef = React.useRef<MediaStream | null>(null)

  const [mode, setMode] = React.useState<'camera' | 'upload'>('camera')
  const [imageDataUrl, setImageDataUrl] = React.useState<string>()
  const isPdf = !!imageDataUrl && imageDataUrl.startsWith('data:application/pdf')
  const [cameraMessage, setCameraMessage] = React.useState<string>()
  const [isExtracting, setIsExtracting] = React.useState(false)

  React.useEffect(() => {
    if (open && initialImageDataUrl) {
      setMode('upload')
      setImageDataUrl(initialImageDataUrl)
    }
  }, [initialImageDataUrl, open])

  const stopCamera = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  React.useEffect(() => {
    if (!open) {
      stopCamera()
      return
    }

    if (mode !== 'camera' || imageDataUrl) {
      stopCamera()
      return
    }

    let cancelled = false

    async function startCamera() {
      setCameraMessage(undefined)

      if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
        setCameraMessage('Camera preview needs localhost or HTTPS. You can upload a bill image instead.')
        setMode('upload')
        return
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      } catch {
        setCameraMessage('Camera access was not available. Upload a bill image to continue.')
        setMode('upload')
      }
    }

    startCamera()

    return () => {
      cancelled = true
      stopCamera()
    }
  }, [imageDataUrl, mode, open, stopCamera])

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      stopCamera()
      setImageDataUrl(undefined)
      setCameraMessage(undefined)
      setIsExtracting(false)
    }
    onOpenChange(nextOpen)
  }

  function captureFrame() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    setImageDataUrl(canvas.toDataURL('image/jpeg', 0.92))
    stopCamera()
  }

  function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') setImageDataUrl(reader.result)
    }
    reader.readAsDataURL(file)
  }

  async function handleExtract() {
    if (!imageDataUrl) return

    try {
      setIsExtracting(true)
      const parsed = await extractBillFromImage(imageDataUrl)
      onExtract(parsed)
      handleOpenChange(false)
      toast.success('Bill scanned — review and save')
    } catch {
      toast.error('Could not extract bill details')
    } finally {
      setIsExtracting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5" />
            Scan the bill
          </DialogTitle>
          <DialogDescription>
            AI reads the bill (image or PDF) and fills the form — needs the backend key configured.
          </DialogDescription>
        </DialogHeader>

        {!imageDataUrl ? (
          <Tabs value={mode} onValueChange={(value) => setMode(value as 'camera' | 'upload')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="camera">
                <Camera className="mr-2 h-4 w-4" />
                Camera
              </TabsTrigger>
              <TabsTrigger value="upload">
                <ImageUp className="mr-2 h-4 w-4" />
                Upload
              </TabsTrigger>
            </TabsList>

            <TabsContent value="camera" className="space-y-4">
              {cameraMessage ? (
                <p className="rounded-md border bg-muted p-4 text-sm text-muted-foreground">
                  {cameraMessage}
                </p>
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="aspect-[4/3] w-full rounded-md bg-muted object-cover"
                />
              )}
              <Button type="button" className="w-full" onClick={captureFrame} disabled={!!cameraMessage}>
                Capture
              </Button>
            </TabsContent>

            <TabsContent value="upload" className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleUpload}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageUp className="mr-2 h-4 w-4" />
                Choose bill image or PDF
              </Button>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-4">
            {isPdf ? (
              <embed
                src={imageDataUrl}
                type="application/pdf"
                className="h-[50vh] w-full rounded-md border"
              />
            ) : (
              <img
                src={imageDataUrl}
                alt="Bill preview"
                className="max-h-[50vh] w-full rounded-md border object-contain"
              />
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setImageDataUrl(undefined)}>
                Retake
              </Button>
              <Button type="button" onClick={handleExtract} disabled={isExtracting}>
                {isExtracting ? extractingLabel : 'Extract details'}
              </Button>
            </div>
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </DialogContent>
    </Dialog>
  )
}
