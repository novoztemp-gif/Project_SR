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
        # ConvertTo-Json's well-known single-item collapse only happens when
        # a collection is piped in ($result | ConvertTo-Json unwraps it
        # element-by-element first) — passed via -InputObject like this, the
        # whole array is bound as one argument and correctly stays an array
        # even for exactly one item (verified directly). Wrapping it in an
        # extra "[...]" here for the count-1 case double-nested the JSON
        # instead — the single-scanner case is the most common one this
        # would ever hit in practice.
        Write-Output (ConvertTo-Json -InputObject $result -Compress)
    }
} catch {
    Write-Output '[]'
}
