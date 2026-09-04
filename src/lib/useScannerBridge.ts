import * as React from 'react'

export const SCANNER_BRIDGE_URL = 'http://127.0.0.1:8787'
const POLL_INTERVAL_MS = 1500
const HEALTH_TIMEOUT_MS = 2000
const DEVICE_SCAN_TIMEOUT_MS = 60000
// Network scanner discovery (mDNS) is asynchronous and can legitimately take
// several seconds after the bridge starts — a device that announces itself a
// few seconds late would otherwise never appear, since /devices was only
// ever queried once, right when the dialog opened (confirmed: a printer that
// /devices found after ~5-9s showed up fine once queried again, but the
// dialog itself never re-queried and was stuck showing "No scanners found").
const DEVICE_POLL_INTERVAL_MS = 4000

type BridgeStatus = 'checking' | 'connected' | 'scanning-device' | 'scan-ready' | 'not-connected'

interface BridgeScan {
  id: string
  filename: string
  mimeType: string
  dataUrl: string
  scannedAt: string
}

export interface ScannerDevice {
  kind: 'network' | 'usb-sane' | 'usb-wia'
  id: string
  name: string
  host?: string
  port?: number
  secure?: boolean
  resourcePath?: string
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = HEALTH_TIMEOUT_MS) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    window.clearTimeout(timeout)
  }
}

export function useScannerBridge() {
  const [status, setStatus] = React.useState<BridgeStatus>('checking')
  const [folder, setFolder] = React.useState<string>()
  const [scan, setScan] = React.useState<BridgeScan>()
  const [devices, setDevices] = React.useState<ScannerDevice[]>()
  const [devicesLoading, setDevicesLoading] = React.useState(false)
  const [scanError, setScanError] = React.useState<string>()
  const pollTimer = React.useRef<number | undefined>(undefined)
  const devicePollTimer = React.useRef<number | undefined>(undefined)
  // Both pollers reschedule themselves via setTimeout — referencing the
  // useCallback-wrapped function by name from inside its own body works at
  // runtime (the setTimeout callback only fires well after the const is
  // assigned) but isn't provably safe under React's stricter analysis, since
  // it can't tell the self-reference will always see the latest version.
  // Going through a ref updated right after each declaration sidesteps that
  // without changing any calling code.
  const pollOnceRef = React.useRef<() => void>(() => {})
  const pollDevicesOnceRef = React.useRef<() => void>(() => {})

  const stopPolling = React.useCallback(() => {
    if (pollTimer.current) {
      window.clearTimeout(pollTimer.current)
      pollTimer.current = undefined
    }
    if (devicePollTimer.current) {
      window.clearTimeout(devicePollTimer.current)
      devicePollTimer.current = undefined
    }
  }, [])

  // Manual "Refresh" click — single attempt, shows the button's spinner.
  const refreshDevices = React.useCallback(async () => {
    setDevicesLoading(true)
    try {
      const res = await fetchWithTimeout(`${SCANNER_BRIDGE_URL}/devices`, {}, 15000)
      if (res.ok) setDevices((await res.json()) as ScannerDevice[])
    } catch {
      setDevices([])
    } finally {
      setDevicesLoading(false)
    }
  }, [])

  // Background re-check, silent (no spinner) — keeps retrying every few
  // seconds for as long as the dialog stays connected. Network scanner
  // discovery (mDNS) can legitimately take several seconds after the bridge
  // starts, and /devices previously was only ever queried once, right when
  // the dialog opened — a scanner that announced itself a moment later would
  // never appear, leaving "No scanners found" showing even though the
  // bridge did find it seconds afterward (confirmed directly).
  const pollDevicesOnce = React.useCallback(async () => {
    try {
      const res = await fetchWithTimeout(`${SCANNER_BRIDGE_URL}/devices`, {}, DEVICE_POLL_INTERVAL_MS)
      if (res.ok) setDevices((await res.json()) as ScannerDevice[])
    } catch {
      // Bridge might be mid-restart — just try again next tick.
    }
    devicePollTimer.current = window.setTimeout(() => pollDevicesOnceRef.current(), DEVICE_POLL_INTERVAL_MS)
  }, [])

  // Folder-watch channel: cheap, so it's fine to poll frequently.
  const pollOnce = React.useCallback(async () => {
    try {
      const res = await fetchWithTimeout(`${SCANNER_BRIDGE_URL}/latest`, {}, POLL_INTERVAL_MS)
      if (res.ok) {
        const found = (await res.json()) as BridgeScan
        setScan(found)
        setStatus('scan-ready')
        return
      }
    } catch {
      setStatus('not-connected')
      return
    }
    pollTimer.current = window.setTimeout(() => pollOnceRef.current(), POLL_INTERVAL_MS)
  }, [])

  React.useEffect(() => {
    pollOnceRef.current = pollOnce
    pollDevicesOnceRef.current = pollDevicesOnce
  }, [pollDevicesOnce, pollOnce])

  // The bridge's "latest scan" is shared, server-side, persistent state — a
  // scan left unconsumed from an earlier dialog session (closed without
  // using it, browser crash, etc.) would otherwise silently reappear the
  // next time anyone opens this dialog. Discard anything already sitting
  // there before starting to wait for a genuinely new one.
  const drainStaleScan = React.useCallback(async () => {
    try {
      const res = await fetchWithTimeout(`${SCANNER_BRIDGE_URL}/latest`, {}, POLL_INTERVAL_MS)
      if (res.ok) {
        const stale = (await res.json()) as BridgeScan
        await fetchWithTimeout(`${SCANNER_BRIDGE_URL}/consume/${stale.id}`, { method: 'POST' })
      }
    } catch {
      // Nothing to drain, or the bridge isn't reachable — either way,
      // connect()'s own health check handles surfacing that.
    }
  }, [])

  const connect = React.useCallback(async () => {
    stopPolling()
    setStatus('checking')
    setScan(undefined)
    setScanError(undefined)
    setDevices(undefined)

    try {
      const res = await fetchWithTimeout(`${SCANNER_BRIDGE_URL}/health`)
      if (!res.ok) throw new Error('unhealthy')
      const body = (await res.json()) as { ok: boolean; folder: string }
      setFolder(body.folder)
      setStatus('connected')
      void refreshDevices()
      devicePollTimer.current = window.setTimeout(pollDevicesOnce, DEVICE_POLL_INTERVAL_MS)
      await drainStaleScan()
      void pollOnce()
    } catch {
      setStatus('not-connected')
    }
  }, [drainStaleScan, pollDevicesOnce, pollOnce, refreshDevices, stopPolling])

  const consumeAndReset = React.useCallback(async (id: string) => {
    try {
      await fetchWithTimeout(`${SCANNER_BRIDGE_URL}/consume/${id}`, { method: 'POST' })
    } catch {
      // Non-fatal — the scan was already handed to the caller either way.
    }
  }, [])

  const verifyManualScanner = React.useCallback(async (host: string, port: number) => {
    try {
      const res = await fetchWithTimeout(
        `${SCANNER_BRIDGE_URL}/verify-network`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ host, port }),
        },
        4000
      )
      if (!res.ok) {
        const body = (await res.json().catch(() => undefined)) as { error?: string } | undefined
        setScanError(body?.error ?? `Could not reach a scanner at ${host}:${port}`)
        return false
      }
      setScanError(undefined)
      void refreshDevices()
      return true
    } catch {
      setScanError(`Could not reach a scanner at ${host}:${port}`)
      return false
    }
  }, [refreshDevices])

  const scanFromDevice = React.useCallback(async (device: ScannerDevice) => {
    stopPolling()
    setStatus('scanning-device')
    setScanError(undefined)

    try {
      const res = await fetchWithTimeout(
        `${SCANNER_BRIDGE_URL}/scan-device`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(device),
        },
        DEVICE_SCAN_TIMEOUT_MS
      )
      if (!res.ok) {
        const body = (await res.json().catch(() => undefined)) as { error?: string } | undefined
        setScanError(body?.error ?? 'Scan failed')
        setStatus('connected')
        void pollOnce()
        devicePollTimer.current = window.setTimeout(pollDevicesOnce, DEVICE_POLL_INTERVAL_MS)
        return
      }
      setScan((await res.json()) as BridgeScan)
      setStatus('scan-ready')
    } catch {
      setScanError('Scan timed out or the scanner went offline')
      setStatus('connected')
      void pollOnce()
      devicePollTimer.current = window.setTimeout(pollDevicesOnce, DEVICE_POLL_INTERVAL_MS)
    }
  }, [pollDevicesOnce, pollOnce, stopPolling])

  const reset = React.useCallback(() => {
    stopPolling()
    setStatus('checking')
    setScan(undefined)
    setFolder(undefined)
    setDevices(undefined)
    setScanError(undefined)
  }, [stopPolling])

  React.useEffect(() => stopPolling, [stopPolling])

  return {
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
  }
}
