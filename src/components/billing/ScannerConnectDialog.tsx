import * as React from 'react'
import { AlertTriangle, FolderOpen, ImageUp, Loader2, Printer, RefreshCw, Usb, Wifi } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useScannerBridge, type ScannerDevice } from '@/lib/useScannerBridge'

interface ScannerConnectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImageScanned: (imageDataUrl: string) => void
  allowPdf?: boolean
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('File could not be read.'))
    }
    reader.onerror = () => reject(new Error('File could not be read.'))
    reader.readAsDataURL(file)
  })
}

function deviceIcon(kind: ScannerDevice['kind']) {
  return kind === 'network' ? Wifi : Usb
}

export function ScannerConnectDialog({
  open,
  onOpenChange,
  onImageScanned,
  allowPdf = false,
}: ScannerConnectDialogProps) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const [manualIp, setManualIp] = React.useState('')
  const [manualPort, setManualPort] = React.useState('80')
  const [verifying, setVerifying] = React.useState(false)
  const {
    status,
    folder,
    scan,
    devices,
    devicesLoading,
    scanError,
    connect,
    consumeAndReset,
    verifyManualScanner,
    scanFromDevice,
    refreshDevices,
    reset,
  } = useScannerBridge()

  React.useEffect(() => {
    if (!open) {
      reset()
      setManualIp('')
      setManualPort('80')
      return
    }
    void connect()
  }, [open, connect, reset])

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if ((file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) && !allowPdf) {
      toast.error('PDF scanning requires backend — image files only for now')
      return
    }

    const imageDataUrl = await readFileAsDataUrl(file)
    onImageScanned(imageDataUrl)
    onOpenChange(false)
  }

  async function useCompletedScan() {
    if (!scan) return
    if (scan.mimeType === 'application/pdf' && !allowPdf) {
      toast.error("PDF scans aren't supported here — image files only for now")
      void consumeAndReset(scan.id)
      void connect()
      return
    }
    onImageScanned(scan.dataUrl)
    void consumeAndReset(scan.id)
    onOpenChange(false)
  }

  async function scanAnother() {
    if (scan) void consumeAndReset(scan.id)
    void connect()
  }

  async function handleManualConnect() {
    const port = Number(manualPort) || 80
    if (!manualIp.trim()) return
    setVerifying(true)
    const ok = await verifyManualScanner(manualIp.trim(), port)
    setVerifying(false)
    if (ok) toast.success('Scanner found — click Scan now')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Scan from Scanner
          </DialogTitle>
          <DialogDescription>
            Uses the Scanner Bridge — a small helper running on this computer.
          </DialogDescription>
        </DialogHeader>

        {status === 'checking' && (
          <div className="flex items-center gap-3 rounded-md border border-border bg-muted p-4 text-sm">
            <Loader2 className="h-4 w-4 animate-spin text-brand-mid" />
            <span>Connecting to Scanner Bridge…</span>
          </div>
        )}

        {status === 'connected' && (
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                  <Printer className="h-3.5 w-3.5" />
                  LAN/WiFi &amp; USB scanners
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  disabled={devicesLoading}
                  onClick={() => void refreshDevices()}
                >
                  <RefreshCw className={devicesLoading ? 'h-3 w-3 animate-spin' : 'h-3 w-3'} />
                  Refresh
                </Button>
              </div>

              {devicesLoading && !devices ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Searching this network and computer for scanners…
                </div>
              ) : devices && devices.length > 0 ? (
                <div className="space-y-2">
                  {devices.map((device) => {
                    const Icon = deviceIcon(device.kind)
                    const fullLabel = device.kind === 'network' ? `${device.name} (${device.host})` : device.name
                    return (
                      <Button
                        key={`${device.kind}:${device.id}`}
                        type="button"
                        className="w-full justify-start overflow-hidden"
                        title={fullLabel}
                        onClick={() => void scanFromDevice(device)}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{device.name}</span>
                      </Button>
                    )
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No scanners found yet. If yours doesn't appear, enter its
                  network IP address below.
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <Input
                  value={manualIp}
                  onChange={(event) => setManualIp(event.target.value)}
                  placeholder="192.168.1.105"
                  className="flex-1"
                />
                <Input
                  value={manualPort}
                  onChange={(event) => setManualPort(event.target.value)}
                  placeholder="Port"
                  className="w-20"
                />
                <Button type="button" variant="outline" disabled={verifying} onClick={() => void handleManualConnect()}>
                  {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Connect'}
                </Button>
              </div>
              {scanError && <p className="text-xs text-destructive">{scanError}</p>}
            </div>

            <div className="flex items-center gap-3 rounded-md border border-border bg-muted p-4 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-brand-mid" />
              <span>Or scan with your printer's own app — waiting…</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Saves to:
              <br />
              <code className="break-all">{folder}</code>
            </p>
          </div>
        )}

        {status === 'scanning-device' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-md border border-border bg-muted p-4 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-brand-mid" />
              <span>Scanning… this can take up to a minute.</span>
            </div>
          </div>
        )}

        {status === 'scan-ready' && scan && (
          <div className="space-y-4">
            <p className="text-sm font-medium">Scan received</p>
            {scan.mimeType === 'application/pdf' ? (
              <embed src={scan.dataUrl} type="application/pdf" className="h-64 w-full rounded-md border" />
            ) : (
              <img
                src={scan.dataUrl}
                alt="Scanned document"
                className="max-h-64 w-full rounded-md border border-border object-contain"
              />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => void scanAnother()}>
                <RefreshCw className="h-4 w-4" />
                Scan another
              </Button>
              <Button type="button" className="flex-1" onClick={() => void useCompletedScan()}>
                Use this scan
              </Button>
            </div>
          </div>
        )}

        {status === 'not-connected' && (
          <div className="space-y-5">
            <div className="flex items-start gap-3 rounded-md border border-border bg-muted p-4 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="space-y-1">
                <p>Scanner Bridge isn't running on this computer.</p>
                <p className="text-xs text-muted-foreground">
                  Start it once (see setup guide) and leave it running while
                  scanning bills — it's how this computer reaches your
                  scanner.
                </p>
              </div>
            </div>

            <Button type="button" variant="outline" className="w-full justify-start" onClick={() => void connect()}>
              <RefreshCw className="h-4 w-4" />
              Retry connection
            </Button>

            <div className="space-y-2">
              <Button type="button" variant="outline" className="w-full justify-start" onClick={() => fileInputRef.current?.click()}>
                <ImageUp className="h-4 w-4" />
                Use file upload instead
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept={allowPdf ? 'image/*,.pdf' : 'image/*'}
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
