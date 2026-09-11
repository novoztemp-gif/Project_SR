import express from 'express'
import cors from 'cors'
import chokidar from 'chokidar'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import http from 'node:http'
import { Jimp } from 'jimp'
import { startDiscovery, listDiscovered, verifyScanner, performScan } from './escl.js'
import { listSaneDevices, scanSaneDevice } from './sane.js'
import { listWiaDevices, scanWiaDevice } from './wia.js'
import { initLogger, log } from './log.js'

const PORT = Number(process.env.SCAN_BRIDGE_PORT) || 8787
const SCAN_FOLDER = process.env.SCAN_FOLDER || path.join(os.homedir(), 'SRBilling Scans')

const MIME_BY_EXT = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.bmp': 'image/bmp',
}

// Allow the production site (apex + www), Vite dev server, and any localhost/
// 127.0.0.1 origin (dev previews, other local ports) — never anything else,
// since this server only ever binds to localhost anyway.
const ALLOWED_ORIGINS = [
  'https://sraibilling.com',
  'https://www.sraibilling.com',
  'http://localhost:5173',
  'http://localhost:4173',
]

function isAllowedOrigin(origin) {
  if (!origin) return true // same-machine tools (curl, health checks)
  if (ALLOWED_ORIGINS.includes(origin)) return true
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
}

// Self-install on Windows: on first run, copy this exe into the Startup
// folder so Windows launches it automatically on every future login — a
// plain .exe placed there needs no shortcut, registry entry, or admin
// rights. This is what lets the whole thing ship as a single file: someone
// downloads scanner-bridge.exe and double-clicks it once, and there's
// nothing else to install or run again. Only applies to the packaged .exe
// (process.pkg is set only when running inside one) — running from source
// with `node src/server.js` is unaffected.
function selfInstallOnWindows() {
  if (process.platform !== 'win32' || !process.pkg) return
  try {
    const startupDir = path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup')
    const target = path.join(startupDir, 'SRBillingScannerBridge.exe')
    const current = process.execPath
    if (path.resolve(current).toLowerCase() === path.resolve(target).toLowerCase()) return // already the installed copy
    fs.mkdirSync(startupDir, { recursive: true })
    fs.copyFileSync(current, target)
    log('[scanner-bridge] Installed — this will now start automatically every time this computer turns on.')
  } catch (err) {
    log(`[scanner-bridge] Could not install to the Startup folder (will still run this time): ${err.message}`)
  }
}

fs.mkdirSync(SCAN_FOLDER, { recursive: true })
initLogger(SCAN_FOLDER)
selfInstallOnWindows()

/** @type {{ id: string, filename: string, mimeType: string, dataUrl: string, scannedAt: string, consumed: boolean }[]} */
const scans = []
const MAX_TRACKED_SCANS = 20
const MAX_SCAN_DIMENSION = 2500

// Normalizes a scanned image into a clean, correctly-labeled JPEG before
// it's ever shown to the extraction API — regardless of what a scanner
// driver actually produced. Fixes two real bugs, both reproduced directly
// against the live extraction endpoint:
//   - Some WIA drivers ignore the requested transfer format and save their
//     own native format (commonly BMP) anyway; the file was still labeled
//     "image/jpeg" here, and the vision model correctly rejected the
//     mismatch with "does not represent a valid image" (a 400 surfaced to
//     the user as "Extraction model error (400)").
//   - A scanner defaulting to its full physical bed rather than the actual
//     paper size (no scan-area constrained) produced an oversized image
//     whose payload was large enough to fail outright.
// Jimp auto-detects the real format from the bytes rather than trusting
// the claimed mimeType, and re-encodes to JPEG regardless of source
// format (BMP, PNG, TIFF, GIF, or already JPEG). PDFs are passed through
// untouched — Jimp only handles raster images.
async function normalizeScan(buffer, mimeType) {
  if (mimeType === 'application/pdf') return { buffer, mimeType }
  try {
    // Jimp.read() has a bug where it silently drops decode options for
    // Buffer input (only forwards them on the fetch-a-URL path) —
    // Jimp.fromBuffer() is the same operation but actually honors them.
    // The raised limits matter here specifically: jpeg-js's defaults
    // reject decoding a full-platen oversized scan outright (confirmed:
    // an 8400x12000 scan hit both its megapixel and memory caps) — we
    // want to actually decode those, precisely so we can then shrink them.
    const image = await Jimp.fromBuffer(buffer, {
      'image/jpeg': { maxResolutionInMP: 500, maxMemoryUsageInMB: 4096 },
    })
    const { width, height } = image.bitmap
    if (width > MAX_SCAN_DIMENSION || height > MAX_SCAN_DIMENSION) {
      if (width >= height) image.resize({ w: MAX_SCAN_DIMENSION })
      else image.resize({ h: MAX_SCAN_DIMENSION })
    }
    const normalized = await image.getBuffer('image/jpeg')
    return { buffer: normalized, mimeType: 'image/jpeg' }
  } catch (err) {
    log(`[scanner-bridge] Could not normalize scanned image, using it as-is: ${err.message}`)
    return { buffer, mimeType }
  }
}

async function pushScan({ buffer, mimeType, filename }) {
  const normalized = await normalizeScan(buffer, mimeType)
  const scan = {
    id: crypto.randomUUID(),
    filename,
    mimeType: normalized.mimeType,
    dataUrl: `data:${normalized.mimeType};base64,${normalized.buffer.toString('base64')}`,
    scannedAt: new Date().toISOString(),
    consumed: false,
  }
  scans.push(scan)
  while (scans.length > MAX_TRACKED_SCANS) scans.shift()
  return scan
}

async function trackScan(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  const mimeType = MIME_BY_EXT[ext]
  if (!mimeType) return // ignore non-scan files (e.g. .DS_Store, partial downloads)

  let buffer
  try {
    buffer = fs.readFileSync(filePath)
  } catch {
    return // file was already removed/moved, or still being written — skip
  }
  if (buffer.length === 0) return

  const scan = await pushScan({ buffer, mimeType, filename: path.basename(filePath) })
  log(`[scanner-bridge] new scan detected (folder): ${scan.filename} (${(buffer.length / 1024).toFixed(0)} KB)`)
}

// awaitWriteFinish avoids reading a file mid-write while the scan software
// is still saving it (common with large multi-page scans).
const watcher = chokidar.watch(SCAN_FOLDER, {
  ignoreInitial: true,
  depth: 0,
  awaitWriteFinish: { stabilityThreshold: 800, pollInterval: 200 },
})
watcher.on('add', trackScan)
watcher.on('error', (err) => log(`[scanner-bridge] watcher error: ${err.message}`))

const bonjour = startDiscovery()

const app = express()
// Chrome/Edge's Private Network Access check blocks a page loaded from a
// public site (https://sraibilling.com) from reaching a private-network
// address like 127.0.0.1 via fetch(), unless the local server explicitly
// allows it on the preflight response — regular CORS alone doesn't cover
// this. Without it, the browser silently blocks the request before it ever
// reaches the routes below: /health answers fine when visited directly
// (plain navigation, not subject to this check) while the app's own fetch
// calls fail, surfacing as "Scanner Bridge isn't running". This server only
// ever listens on 127.0.0.1 to begin with, so there's no meaningful
// security downside to allowing it unconditionally.
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Private-Network', 'true')
  next()
})
app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) callback(null, true)
      else callback(new Error('Origin not allowed'))
    },
  })
)
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ ok: true, folder: SCAN_FOLDER })
})

app.get('/latest', (_req, res) => {
  const scan = [...scans].reverse().find((s) => !s.consumed)
  if (!scan) return res.status(404).json({ error: 'No unconsumed scan yet' })
  res.json(scan)
})

app.post('/consume/:id', (req, res) => {
  const scan = scans.find((s) => s.id === req.params.id)
  if (!scan) return res.status(404).json({ error: 'Unknown scan id' })
  scan.consumed = true
  res.json({ ok: true })
})

// --- Scanners — network (WiFi/LAN, eSCL) and USB (SANE on Mac/Linux, WIA on
// Windows) — all driven directly by this process, so unlike the browser
// none of this is blocked by CORS. ---

// USB device enumeration (WIA especially) is COM automation against a real
// driver — slow-ish and occasionally flaky right after this process starts,
// most notably right after a fresh Windows boot: confirmed real-world, a
// scanner can take 20-30s to finish registering with Windows after login,
// so a single enumeration attempt made right when someone opens the scan
// screen can come back empty even though the exact same call succeeds
// moments later. Rather than making /devices block on a slow/retried call
// (and risk the frontend's own request timing out), keep a cache
// continuously refreshed in the background from the moment this process
// starts — by the time anyone actually opens the dialog, several attempts
// have typically already happened, and /devices just returns whatever's
// most recently known, instantly.
let cachedUsbDevices = { sane: [], wia: [] }
const USB_REFRESH_INTERVAL_MS = 5000

async function refreshUsbDevices() {
  const [sane, wia] = await Promise.all([listSaneDevices(), listWiaDevices()])
  const before = cachedUsbDevices
  cachedUsbDevices = { sane, wia }
  if (before.sane.length !== sane.length || before.wia.length !== wia.length) {
    log(`[scanner-bridge] device scan: ${sane.length} SANE, ${wia.length} WIA device(s) found`)
  }
}
void refreshUsbDevices()
setInterval(() => { void refreshUsbDevices() }, USB_REFRESH_INTERVAL_MS).unref()

app.get('/devices', (_req, res) => {
  const devices = [
    ...listDiscovered().map((s) => ({ kind: 'network', id: `${s.host}:${s.port}`, name: s.name, ...s })),
    ...cachedUsbDevices.sane.map((d) => ({ kind: 'usb-sane', id: d.id, name: d.name })),
    ...cachedUsbDevices.wia.map((d) => ({ kind: 'usb-wia', id: d.id, name: d.name })),
  ]
  res.json(devices)
})

app.post('/verify-network', async (req, res) => {
  const { host, port = 80, secure = false, resourcePath = 'eSCL' } = req.body || {}
  if (!host) return res.status(400).json({ error: 'host is required' })
  try {
    const scanner = await verifyScanner({ host, port: Number(port), secure: !!secure, resourcePath })
    res.json({ ok: true, scanner })
  } catch (err) {
    res.status(502).json({ error: `Could not reach a scanner at ${host}:${port}` })
  }
})

// A simple in-flight lock: two overlapping WIA scan attempts on the same
// process (e.g. a double-click, or a retry firing while a slow scan is
// still finishing) is itself a real way to make a driver report "device is
// busy" — self-inflicted, not the printer's fault. Reject a second attempt
// outright instead of letting it race the first.
let scanInProgress = false

app.post('/scan-device', async (req, res) => {
  const device = req.body
  if (!device?.kind) return res.status(400).json({ error: 'device is required' })
  if (scanInProgress) return res.status(409).json({ error: 'A scan is already in progress — please wait for it to finish.' })

  scanInProgress = true
  try {
    let result
    if (device.kind === 'network') result = await performScan(device)
    else if (device.kind === 'usb-sane') result = await scanSaneDevice(device.id)
    else if (device.kind === 'usb-wia') result = await scanWiaDevice(device.id)
    else return res.status(400).json({ error: 'Unknown device kind' })

    const ext = result.mimeType.includes('pdf') ? 'pdf' : result.mimeType.includes('png') ? 'png' : 'jpg'
    const scan = await pushScan({ buffer: result.buffer, mimeType: result.mimeType, filename: `scan-${Date.now()}.${ext}` })
    log(`[scanner-bridge] new scan detected (${device.kind}, ${device.name}): ${scan.filename}`)
    res.json(scan)
  } catch (err) {
    log(`[scanner-bridge] scan failed (${device.kind}, ${device.name}): ${err.message}`)
    res.status(502).json({ error: err.message || 'Scan failed' })
  } finally {
    scanInProgress = false
  }
})

function printStartupBanner() {
  log('========================================')
  log(' SR Billing Scanner Bridge — RUNNING')
  log('========================================')
  log(`Watching folder: ${SCAN_FOLDER}`)
  log(`Listening on:    http://127.0.0.1:${PORT}`)
  log('')
  log('Network scanners on this WiFi/LAN are auto-discovered and can')
  log('be triggered directly from SR Billing. For USB-only scanners,')
  log('point their "Scan to PC" / "Scan to Folder" software at the')
  log('folder above. Leave this window open while scanning bills.')
  log('========================================')
  // A non-technical user has no other way to tell "still working" apart
  // from "silently died" — this window doesn't otherwise print anything
  // once startup finishes. unref() so this timer alone never keeps the
  // process alive against a real shutdown signal.
  setInterval(() => {
    log(`[scanner-bridge] still running, watching for scans — ${new Date().toLocaleTimeString()}`)
  }, 5 * 60 * 1000).unref()
}

const server = app.listen(PORT, '127.0.0.1', printStartupBanner)

// app.listen() throwing unhandled here used to kill the whole process
// silently on a port conflict (a stale/zombie previous instance, or
// double-launching after self-install already copied the exe into the
// Startup folder) — no console output a non-technical user would ever see
// past a window that flashes and closes. Handle it explicitly instead.
server.on('error', async (err) => {
  if (err.code !== 'EADDRINUSE') {
    log(`[scanner-bridge] Failed to start: ${err.message}`)
    watcher.close()
    bonjour?.destroy()
    process.exit(1)
    return
  }
  const alreadyHealthy = await new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port: PORT, path: '/health', timeout: 2000 }, (res) => {
      let body = ''
      res.on('data', (chunk) => { body += chunk })
      res.on('end', () => {
        try {
          resolve(JSON.parse(body)?.ok === true)
        } catch {
          resolve(false)
        }
      })
    })
    req.on('error', () => resolve(false))
    req.on('timeout', () => { req.destroy(); resolve(false) })
  })

  // Setting process.exitCode alone isn't enough here — chokidar's watcher
  // and the bonjour mDNS socket are still-open handles keeping the event
  // loop alive, so the process would otherwise just hang forever instead
  // of actually closing (confirmed directly: without this, a second
  // instance sat there indefinitely rather than exiting). This server
  // never finished starting in this branch, so there's no `server` to
  // close — just release the handles this process did open, then exit.
  watcher.close()
  bonjour?.destroy()

  if (alreadyHealthy) {
    log('========================================')
    log(' SR Billing Scanner Bridge is already running')
    log('========================================')
    log('Another copy of this app is already open and working on this')
    log(`computer (port ${PORT}). You can close this window — the other`)
    log('one is already handling scans.')
    log('========================================')
    process.exit(0)
  } else {
    log('========================================')
    log(' SR Billing Scanner Bridge could not start')
    log('========================================')
    log(`Something else on this computer is already using port ${PORT}.`)
    log('Restart your computer and try again, or contact support.')
    log('========================================')
    process.exit(1)
  }
})

function shutdown() {
  log('\n[scanner-bridge] shutting down…')
  watcher.close()
  bonjour?.destroy()
  server.close(() => process.exit(0))
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
