# Lists connected scanners via Windows Image Acquisition (WIA). Covers both
# USB scanners and network scanners that have a Windows driver installed.
# Always exits 0 with "[]" on any failure — the caller treats that as "no
# USB/WIA devices available" rather than an error.
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
        # ConvertTo-Json collapses a single-item array to a bare object, not
        # an array — wrap explicitly so the caller always gets an array.
        # (Avoids -AsArray, which needs PowerShell 6.2+; this works on the
        # PowerShell 5.1 that ships with Windows 10/11 too.)
        $json = ConvertTo-Json -InputObject $result -Compress
        if ($result.Count -eq 1) { $json = "[$json]" }
        Write-Output $json
    }
} catch {
    Write-Output '[]'
}
