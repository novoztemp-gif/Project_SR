// USB (and driver-installed network) scanner support on Windows via WIA
// (Windows Image Acquisition), driven through PowerShell scripts — no
// native compilation needed, works with the PowerShell that ships on every
// Windows 10/11 machine.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const execFileAsync = promisify(execFile)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCRIPTS_DIR = path.join(__dirname, 'windows')

function isWindows() {
  return process.platform === 'win32'
}

function runPowerShell(args, timeout) {
  return execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', ...args], {
    timeout,
    maxBuffer: 10 * 1024 * 1024,
  })
}

export async function listWiaDevices() {
  if (!isWindows()) return []
  try {
    const { stdout } = await runPowerShell(['-File', path.join(SCRIPTS_DIR, 'list-wia-devices.ps1')], 15000)
    const trimmed = stdout.trim()
    if (!trimmed) return []
    const parsed = JSON.parse(trimmed)
    return Array.isArray(parsed) ? parsed : [parsed]
  } catch (err) {
    console.error('[scanner-bridge] WIA device list failed:', err.message)
    return []
  }
}

export async function scanWiaDevice(deviceId) {
  if (!isWindows()) throw new Error('WIA scanning is only available on Windows')
  const outputPath = path.join(os.tmpdir(), `srbilling-wia-${Date.now()}.jpg`)
  await runPowerShell(
    ['-File', path.join(SCRIPTS_DIR, 'scan-wia-device.ps1'), '-DeviceId', deviceId, '-OutputPath', outputPath],
    90000
  )
  const buffer = fs.readFileSync(outputPath)
  fs.unlinkSync(outputPath)
  return { buffer, mimeType: 'image/jpeg' }
}
