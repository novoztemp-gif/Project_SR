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

# wiaFormatJPEG — request a consistent output format rather than relying on
# each driver's default (which varies, often BMP).
$wiaFormatJPEG = '{B96B3CAE-0728-11D3-9D7B-0000F81EF32E}'
$imageFile = $item.Transfer($wiaFormatJPEG)

if (Test-Path $OutputPath) { Remove-Item $OutputPath }
$imageFile.SaveFile($OutputPath)
Write-Output 'OK'
