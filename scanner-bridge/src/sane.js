// USB scanner support for macOS/Linux via SANE (scanimage). Requires
// `sane-backends` installed (e.g. `brew install sane-backends` on macOS).
// If it isn't installed, or no USB scanner is plugged in, this simply
// contributes zero devices to the list — no error surfaced to the user.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const execFileAsync = promisify(execFile)

function isSaneSupported() {
  return process.platform === 'darwin' || process.platform === 'linux'
}

export async function listSaneDevices() {
  if (!isSaneSupported()) return []
  try {
    const { stdout } = await execFileAsync('scanimage', ['-L'], { timeout: 8000 })
    // Lines look like: device `pixma:04A91234_56AB78' is a CANON Canoscan ...
    const devices = []
    const re = /device `([^']+)' is a (.+)/g
    let match
    while ((match = re.exec(stdout))) {
      devices.push({ id: match[1], name: match[2].trim() })
    }
    return devices
  } catch {
    // `scanimage` missing or no devices — either way, nothing to offer.
    return []
  }
}

export async function scanSaneDevice(deviceId) {
  if (!isSaneSupported()) throw new Error('USB scanning via SANE is only available on macOS/Linux')
  const outputPath = path.join(os.tmpdir(), `srbilling-sane-${Date.now()}.png`)
  await execFileAsync('scanimage', ['-d', deviceId, '--format=png', '-o', outputPath], { timeout: 90000 })
  const buffer = fs.readFileSync(outputPath)
  fs.unlinkSync(outputPath)
  return { buffer, mimeType: 'image/png' }
}
