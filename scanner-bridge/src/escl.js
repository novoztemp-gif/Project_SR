// eSCL client: discovers and drives network scanners (WiFi/LAN) directly.
// This runs as a native Node.js process, not in a browser — so unlike the
// browser, it isn't subject to CORS, and can talk to the scanner's HTTP API
// exactly like the OS's own "Scan to PC" software does.
import { Bonjour } from 'bonjour-service'
import os from 'node:os'
import http from 'node:http'
import https from 'node:https'

// Deliberately minimal: no explicit ScanRegions (omitting it lets the
// device default to its full platen, which is what we want — a bill can be
// any size). Some real devices (confirmed against a physical HP DeskJet)
// reject a ScanRegions block or a Version they don't recognize with a
// plain 400, so keep this to fields every eSCL device is expected to honor.
const SCAN_SETTINGS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<scan:ScanSettings xmlns:scan="http://schemas.hp.com/imaging/escl/2011/05/03" xmlns:pwg="http://www.pwg.org/schemas/2010/12/sm">
  <pwg:Version>2.5</pwg:Version>
  <scan:Intent>Document</scan:Intent>
  <scan:ColorMode>RGB24</scan:ColorMode>
  <scan:XResolution>300</scan:XResolution>
  <scan:YResolution>300</scan:YResolution>
</scan:ScanSettings>`

/** @type {Map<string, { name: string, host: string, port: number, secure: boolean, resourcePath: string }>} */
const discovered = new Map()

function txtValue(txt, key) {
  if (!txt) return undefined
  const found = Object.keys(txt).find((k) => k.toLowerCase() === key.toLowerCase())
  return found ? txt[found] : undefined
}

// Prefer the resolved .local hostname over a raw IP: it works uniformly for
// both IPv4 and IPv6 (an IPv6 link-local address needs bracket + scope-ID
// handling to be usable in a URL at all, which the OS's own resolver
// already does for us when we hand it a hostname instead).
function connectionHost(service) {
  return service.host || service.addresses?.[0] || service.referer?.address
}

function addService(service, secure) {
  const host = connectionHost(service)
  if (!host || !service.port) return
  const resourcePath = txtValue(service.txt, 'rs') || 'eSCL'
  discovered.set(`${host}:${service.port}`, {
    name: service.name || host,
    host,
    port: service.port,
    secure,
    resourcePath,
  })
}

function removeService(service) {
  const host = connectionHost(service)
  if (!host || !service.port) return
  discovered.delete(`${host}:${service.port}`)
}

function attachBrowsers(bonjour) {
  const http = bonjour.find({ type: 'uscan' })
  http.on('up', (service) => addService(service, false))
  http.on('down', removeService)
  const https = bonjour.find({ type: 'uscans' })
  https.on('up', (service) => addService(service, true))
  https.on('down', removeService)
}

// The socket bind happens asynchronously after construction, so a failure
// (stale/duplicate socket on a secondary adapter, permission issue, etc.)
// surfaces later as an 'error' event on the *underlying* multicast-dns
// socket — which bonjour-service does not attach any listener to itself.
// An EventEmitter's unhandled 'error' event throws by default, which with
// no listener here crashes the entire process (confirmed: one flaky
// network interface took the whole bridge down). Reach in and guard it.
function guardMdnsErrors(bonjour, label) {
  bonjour.server?.mdns?.on('error', (err) => {
    console.error(`[scanner-bridge] mDNS error (${label}):`, err.message)
  })
  return bonjour
}

// Interfaces that can never have a LAN scanner behind them — VPN tunnels,
// AirDrop (AWDL/its "low latency WLAN" pair), a personal-hotspot AP, and
// loopback/bridge adapters. Skipping them both avoids pointless sockets and
// reduces how many near-simultaneous port-5353 binds we attempt at once
// (binding ~10 sockets on the same port in a tight loop was observed to
// intermittently EADDRINUSE on macOS — even ones that bind fine in
// isolation — so cutting the candidate set down matters, independent of
// the staggering below).
const IRRELEVANT_INTERFACE_RE = /^(utun|awdl|llw|ap|lo|bridge|stun|anpi)/i

// IPv6 link-local addresses each need their own dedicated socket bound to a
// specific interface (multicast-dns can't listen on "all interfaces" for
// IPv6 the way it does for IPv4). Some networks only advertise scanners over
// IPv6 mDNS — without this, those scanners would never be found at all.
// Binds are staggered rather than fired all at once, for the same
// contention reason noted above.
function startIpv6Discovery(bonjourInstances) {
  const candidates = []
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    if (IRRELEVANT_INTERFACE_RE.test(name)) continue
    for (const addr of addrs ?? []) {
      if (addr.family !== 'IPv6' || addr.internal || !addr.address.startsWith('fe80:')) continue
      candidates.push({ name, addr })
    }
  }

  candidates.forEach(({ name, addr }, index) => {
    setTimeout(() => {
      // macOS/Linux use the interface name as the IPv6 zone suffix
      // (`%en0`); Windows uses the numeric scope id (`%11`).
      const zone = process.platform === 'win32' ? String(addr.scopeid) : name
      try {
        const instance = new Bonjour({ type: 'udp6', ip: 'ff02::fb', interface: `${addr.address}%${zone}` })
        guardMdnsErrors(instance, `IPv6/${name}`)
        attachBrowsers(instance)
        bonjourInstances.push(instance)
      } catch (err) {
        console.error(`[scanner-bridge] IPv6 mDNS unavailable on ${name}:`, err.message)
      }
    }, index * 300)
  })
}

/** Starts continuous background mDNS discovery on both IPv4 and IPv6. Never
 * throws — a network without mDNS support (e.g. some VLANs) just yields
 * zero results, and the manual-IP / folder-watch paths remain available. */
export function startDiscovery() {
  const bonjourInstances = []
  try {
    const ipv4 = guardMdnsErrors(new Bonjour(), 'IPv4')
    attachBrowsers(ipv4)
    bonjourInstances.push(ipv4)
  } catch (err) {
    console.error('[scanner-bridge] IPv4 mDNS discovery unavailable:', err.message)
  }

  startIpv6Discovery(bonjourInstances)

  return {
    destroy: () => bonjourInstances.forEach((b) => b.destroy()),
  }
}

export function listDiscovered() {
  return [...discovered.values()]
}

function esclBaseUrl(scanner) {
  const proto = scanner.secure ? 'https' : 'http'
  const resourcePath = (scanner.resourcePath || 'eSCL').replace(/^\/+|\/+$/g, '')
  return `${proto}://${scanner.host}:${scanner.port}/${resourcePath}`
}

// Deliberately NOT using the global fetch() here: it (via undici) adds
// browser-emulation headers — sec-fetch-mode, accept-language,
// accept-encoding: gzip — that fetch doesn't let you remove. Confirmed
// against a real HP DeskJet: those extra headers make its primitive
// embedded HTTP server intermittently reject or 503 an otherwise-identical
// request that plain curl (and this raw http/https request) succeeds with
// every time. eSCL devices are exactly the kind of minimal embedded server
// most likely to be picky about this.
function rawRequest(url, { method = 'GET', headers = {}, body, timeoutMs = 8000 } = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const transport = parsed.protocol === 'https:' ? https : http
    const requestHeaders = { ...headers }
    if (body !== undefined) requestHeaders['Content-Length'] = Buffer.byteLength(body)

    const req = transport.request(
      { hostname: parsed.hostname, port: parsed.port, path: `${parsed.pathname}${parsed.search}`, method, headers: requestHeaders },
      (res) => {
        const chunks = []
        res.on('data', (chunk) => chunks.push(chunk))
        res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }))
      }
    )
    req.on('error', reject)
    req.setTimeout(timeoutMs, () => req.destroy(new Error('Request timed out')))
    if (body !== undefined) req.write(body)
    req.end()
  })
}

function isOk(statusCode) {
  return statusCode >= 200 && statusCode < 300
}

/** Verifies a scanner is reachable (used for manually-entered IPs) and, on
 * success, adds it to the known/discovered list so it behaves the same as
 * an auto-discovered one. */
export async function verifyScanner(scanner) {
  const base = esclBaseUrl(scanner)
  const res = await rawRequest(`${base}/ScannerCapabilities`, { timeoutMs: 4000 })
  if (!isOk(res.statusCode)) throw new Error(`Scanner responded with status ${res.statusCode}`)
  discovered.set(`${scanner.host}:${scanner.port}`, { name: scanner.host, ...scanner })
  return scanner
}

/** Drives a full eSCL scan: submits the job, waits for the device to finish
 * scanning, then downloads the result. Returns { buffer, mimeType }. */
export async function performScan(scanner) {
  const base = esclBaseUrl(scanner)

  // A device that just finished a scan often 503s a new job for a couple of
  // seconds while it settles (confirmed on real hardware) — that's normal,
  // not a real rejection, so give it a few short retries before giving up.
  let jobRes
  for (let attempt = 0; ; attempt += 1) {
    jobRes = await rawRequest(`${base}/ScanJobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml' },
      body: SCAN_SETTINGS_XML,
      timeoutMs: 8000,
    })
    if (isOk(jobRes.statusCode) || jobRes.statusCode !== 503 || attempt >= 3) break
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
  if (!isOk(jobRes.statusCode)) throw new Error(`Scanner rejected the scan request (status ${jobRes.statusCode})`)

  const location = jobRes.headers.location
  if (!location) throw new Error('Scanner did not return a job location')
  const jobUrl = (location.startsWith('http') ? location : new URL(location, `${base}/`).toString()).replace(/\/+$/, '')

  // Devices vary in how quickly the scanned page becomes available — poll
  // NextDocument with backoff rather than assuming it's ready immediately.
  const deadline = Date.now() + 45000
  let lastError
  while (Date.now() < deadline) {
    try {
      const docRes = await rawRequest(`${jobUrl}/NextDocument`, { timeoutMs: 15000 })
      if (isOk(docRes.statusCode)) {
        if (docRes.body.length > 0) {
          const mimeType = (docRes.headers['content-type'] || 'image/jpeg').split(';')[0].trim()
          return { buffer: docRes.body, mimeType }
        }
      } else if (docRes.statusCode !== 404 && docRes.statusCode !== 503) {
        lastError = new Error(`Scanner returned status ${docRes.statusCode}`)
      }
    } catch (err) {
      lastError = err
    }
    await new Promise((resolve) => setTimeout(resolve, 1200))
  }
  throw lastError || new Error('Timed out waiting for the scanner to finish')
}
