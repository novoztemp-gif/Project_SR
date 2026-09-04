# Triggers a scan on a specific WIA device and saves the result as JPEG.
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
