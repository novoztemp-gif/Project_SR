// USB (and driver-installed network) scanner support on Windows via WIA
// (Windows Image Acquisition), driven through PowerShell scripts — no
// native compilation needed, works with the PowerShell that ships on every
// Windows 10/11 machine.
//
// The scripts below are embedded as strings, not loaded from separate .ps1
// files on disk. This whole app gets packaged into a single .exe for
// distribution (see build.sh) — an external process like powershell.exe can
// only read real files, not whatever's inside a packaged executable, so at
// each invocation these are written out to a real temp file first. This is
// the single source of truth for both scripts; there is no separate .ps1
// file elsewhere to fall out of sync with.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const execFileAsync = promisify(execFile)

function isWindows() {
  return process.platform === 'win32'
}

// Lists connected scanners via WIA. Always exits 0 with "[]" on any
// failure — the caller treats that as "no USB/WIA devices available"
// rather than an error.
const LIST_DEVICES_SCRIPT = `
$ErrorActionPreference = 'Stop'
try {
    $dm = New-Object -ComObject WIA.DeviceManager
    $result = @()
    foreach ($info in $dm.DeviceInfos) {
        # WIA DeviceType 1 = Scanner
        if ($info.Type -eq 1) {
            $name = $info.DeviceID
            try { $name = $info.Properties.Item('Name').Value } catch {}
            $result += [PSCustomObject]@{ id = $info.DeviceID; name = $name }
        }
    }
    if ($result.Count -eq 0) {
        Write-Output '[]'
    } else {
        # ConvertTo-Json's well-known single-item collapse only happens when
        # a collection is piped in ($result | ConvertTo-Json unwraps it
        # element-by-element first) — passed via -InputObject like this, the
        # whole array is bound as one argument and correctly stays an array
        # even for exactly one item (verified directly against real
        # PowerShell). Wrapping it in an extra "[...]" for the count-1 case
        # would double-nest the JSON instead — the single-scanner case is
        # the most common one this would ever hit in practice.
        Write-Output (ConvertTo-Json -InputObject $result -Compress)
    }
} catch {
    Write-Output '[]'
}
`

// Triggers a scan on a specific WIA device and saves the result as JPEG.
const SCAN_DEVICE_SCRIPT = `
param(
    [Parameter(Mandatory = $true)][string]$DeviceId,
    [Parameter(Mandatory = $true)][string]$OutputPath
)
$ErrorActionPreference = 'Stop'

$dm = New-Object -ComObject WIA.DeviceManager
$info = $null
foreach ($candidate in $dm.DeviceInfos) {
    if ($candidate.DeviceID -eq $DeviceId) { $info = $candidate; break }
}
if (-not $info) {
    Write-Error "Device not found: $DeviceId"
    exit 1
}

$device = $info.Connect()
$item = $device.Items.Item(1)

# Without setting these, the scan uses whatever the driver's CURRENT
# properties happen to be — often whatever was last used from the printer's
# own control panel (could be low-res, black & white, etc.), giving
# inconsistent results bill to bill. Force a sane, predictable default:
# color, 300 DPI, matching what the network (eSCL) scan path already
# requests. Property IDs are the standard WIA ones (documented, stable
# across Windows versions) — not every driver honors every property, so
# each is best-effort and skipped on failure rather than aborting the scan.
function Set-WiaProperty($item, $propId, $value) {
    try {
        $prop = $item.Properties.Item($propId)
        if ($prop) { $prop.Value = $value }
    } catch {
        # Driver doesn't support this property at this value — fall back to
        # its own default rather than failing the whole scan over it.
    }
}
Set-WiaProperty $item 6146 1     # WIA_IPS_CUR_INTENT: 1 = Color
Set-WiaProperty $item 6147 300   # WIA_IPS_XRES
Set-WiaProperty $item 6148 300   # WIA_IPS_YRES

# wiaFormatJPEG — request a consistent output format rather than relying on
# each driver's default (which varies, often BMP).
$wiaFormatJPEG = '{B96B3CAE-0728-11D3-9D7B-0000F81EF32E}'
$imageFile = $item.Transfer($wiaFormatJPEG)

if (Test-Path $OutputPath) { Remove-Item $OutputPath }
$imageFile.SaveFile($OutputPath)
Write-Output 'OK'
`

function writeTempScript(name, content) {
  const scriptPath = path.join(os.tmpdir(), name)
  fs.writeFileSync(scriptPath, content, 'utf8')
  return scriptPath
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
    const scriptPath = writeTempScript('srbilling-list-wia-devices.ps1', LIST_DEVICES_SCRIPT)
    const { stdout } = await runPowerShell(['-File', scriptPath], 15000)
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
  const scriptPath = writeTempScript('srbilling-scan-wia-device.ps1', SCAN_DEVICE_SCRIPT)
  const outputPath = path.join(os.tmpdir(), `srbilling-wia-${Date.now()}.jpg`)
  await runPowerShell(['-File', scriptPath, '-DeviceId', deviceId, '-OutputPath', outputPath], 90000)
  const buffer = fs.readFileSync(outputPath)
  fs.unlinkSync(outputPath)
  return { buffer, mimeType: 'image/jpeg' }
}
