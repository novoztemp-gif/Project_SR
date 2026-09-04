import express from 'express'
import cors from 'cors'
import chokidar from 'chokidar'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import { startDiscovery, listDiscovered, verifyScanner, performScan } from './escl.js'
import { listSaneDevices, scanSaneDevice } from './sane.js'
import { listWiaDevices, scanWiaDevice } from './wia.js'

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

fs.mkdirSync(SCAN_FOLDER, { recursive: true })

/** @type {{ id: string, filename: string, mimeType: string, dataUrl: string, scannedAt: string, consumed: boolean }[]} */
const scans = []
const MAX_TRACKED_SCANS = 20

function pushScan({ buffer, mimeType, filename }) {
  const scan = {
    id: crypto.randomUUID(),
    filename,
    mimeType,
    dataUrl: `data:${mimeType};base64,${buffer.toString('base64')}`,
    scannedAt: new Date().toISOString(),
    consumed: false,
  }
  scans.push(scan)
  while (scans.length > MAX_TRACKED_SCANS) scans.shift()
  return scan
}

function trackScan(filePath) {
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

  const scan = pushScan({ buffer, mimeType, filename: path.basename(filePath) })
  console.log(`[scanner-bridge] new scan detected (folder): ${scan.filename} (${(buffer.length / 1024).toFixed(0)} KB)`)
}

// awaitWriteFinish avoids reading a file mid-write while the scan software
// is still saving it (common with large multi-page scans).
const watcher = chokidar.watch(SCAN_FOLDER, {
  ignoreInitial: true,
  depth: 0,
  awaitWriteFinish: { stabilityThreshold: 800, pollInterval: 200 },
})
watcher.on('add', trackScan)
watcher.on('error', (err) => console.error('[scanner-bridge] watcher error:', err))

const bonjour = startDiscovery()

const app = express()
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

app.get('/devices', async (_req, res) => {
  const [sane, wia] = await Promise.all([listSaneDevices(), listWiaDevices()])
  const devices = [
    ...listDiscovered().map((s) => ({ kind: 'network', id: `${s.host}:${s.port}`, name: s.name, ...s })),
    ...sane.map((d) => ({ kind: 'usb-sane', id: d.id, name: d.name })),
    ...wia.map((d) => ({ kind: 'usb-wia', id: d.id, name: d.name })),
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

app.post('/scan-device', async (req, res) => {
  const device = req.body
  if (!device?.kind) return res.status(400).json({ error: 'device is required' })

  try {
    let result
    if (device.kind === 'network') result = await performScan(device)
    else if (device.kind === 'usb-sane') result = await scanSaneDevice(device.id)
    else if (device.kind === 'usb-wia') result = await scanWiaDevice(device.id)
    else return res.status(400).json({ error: 'Unknown device kind' })

    const ext = result.mimeType.includes('pdf') ? 'pdf' : result.mimeType.includes('png') ? 'png' : 'jpg'
    const scan = pushScan({ buffer: result.buffer, mimeType: result.mimeType, filename: `scan-${Date.now()}.${ext}` })
    console.log(`[scanner-bridge] new scan detected (${device.kind}, ${device.name}): ${scan.filename}`)
    res.json(scan)
  } catch (err) {
    console.error('[scanner-bridge] scan failed:', err)
    res.status(502).json({ error: err.message || 'Scan failed' })
  }
})

const server = app.listen(PORT, '127.0.0.1', () => {
  console.log('========================================')
  console.log(' SR Billing Scanner Bridge')
  console.log('========================================')
  console.log(`Watching folder: ${SCAN_FOLDER}`)
  console.log(`Listening on:    http://127.0.0.1:${PORT}`)
  console.log('')
  console.log('Network scanners on this WiFi/LAN are auto-discovered and can')
  console.log('be triggered directly from SR Billing. For USB-only scanners,')
  console.log('point their "Scan to PC" / "Scan to Folder" software at the')
  console.log('folder above. Leave this window open while scanning bills.')
  console.log('========================================')
})

function shutdown() {
  console.log('\n[scanner-bridge] shutting down…')
  watcher.close()
  bonjour?.destroy()
  server.close(() => process.exit(0))
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
