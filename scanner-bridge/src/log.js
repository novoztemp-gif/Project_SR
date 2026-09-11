// Persistent diagnostics log: every device-list attempt, scan attempt, and
// error gets appended here, in addition to the console. A console window
// closes/scrolls away and a screenshot only ever shows one moment — this
// file lets a real incident (like the cold-boot "no scanner found" report)
// be diagnosed from what actually happened, by asking the client to send
// this one file, instead of reconstructing it from memory afterward.
import fs from 'node:fs'
import path from 'node:path'

const MAX_LOG_BYTES = 2 * 1024 * 1024 // generous for recent history, small enough to send over WhatsApp/email

let logPath

export function initLogger(folder) {
  logPath = path.join(folder, 'scanner-bridge.log')
}

function trimIfNeeded() {
  try {
    const { size } = fs.statSync(logPath)
    if (size <= MAX_LOG_BYTES) return
    // Keep the tail — an incident report is almost always about "what just
    // happened", not the app's entire lifetime history.
    const buffer = fs.readFileSync(logPath)
    fs.writeFileSync(logPath, buffer.subarray(buffer.length - MAX_LOG_BYTES / 2))
  } catch {
    // No file yet, or a transient read/write race — not worth failing over,
    // logging must never be able to break actual scanning functionality.
  }
}

export function log(message) {
  console.log(message)
  if (!logPath) return
  try {
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`)
    trimIfNeeded()
  } catch {
    // Disk full, permissions, etc. — swallow, console output above already happened.
  }
}
