# Starts the backend, the website and the mobile dev server, each in its own window.
#
#   powershell -ExecutionPolicy Bypass -File scripts\start-all.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\start-all.ps1 -NoMobile
#
# Before starting the mobile server it writes this PC's current Wi-Fi IP into
# mobile\.env, so the phone always talks to the right backend address.

param([switch]$NoWebsite, [switch]$NoMobile)

$root = Split-Path -Parent $PSScriptRoot

function Get-WifiIp {
    $ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.InterfaceAlias -match 'Wi-?Fi|Wireless|WLAN' -and $_.IPAddress -notlike '169.254.*' } |
        Select-Object -First 1 -ExpandProperty IPAddress
    if (-not $ip) {
        # No Wi-Fi adapter: fall back to the first private LAN address (e.g. Ethernet)
        $ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
            Where-Object { $_.IPAddress -match '^(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))\.' } |
            Select-Object -First 1 -ExpandProperty IPAddress
    }
    return $ip
}

function Start-Window($title, $dir, $command) {
    Start-Process powershell -WorkingDirectory $dir -ArgumentList @(
        '-NoExit', '-Command', "`$Host.UI.RawUI.WindowTitle = '$title'; $command"
    )
}

# Backend on all network interfaces so a phone on the same Wi-Fi can reach it
Start-Window 'Backend :8000' (Join-Path $root 'backend') `
    '.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000'
Write-Host 'Backend   -> http://localhost:8000  (API docs: /docs)'

if (-not $NoWebsite) {
    Start-Window 'Website :5173' (Join-Path $root 'frontend') 'npm run dev'
    Write-Host 'Website   -> http://localhost:5173'
}

if (-not $NoMobile) {
    $mobile = Join-Path $root 'mobile'
    $envFile = Join-Path $mobile '.env'
    $ip = Get-WifiIp
    if ($ip -and (Test-Path $envFile)) {
        $lines = Get-Content $envFile | ForEach-Object {
            if ($_ -match '^EXPO_PUBLIC_API_URL=') { "EXPO_PUBLIC_API_URL=http://${ip}:8000" } else { $_ }
        }
        Set-Content -Path $envFile -Value $lines -Encoding utf8
        Write-Host "Mobile    -> phone will use backend http://${ip}:8000"
    } else {
        Write-Host 'Mobile    -> could not detect the Wi-Fi IP; check EXPO_PUBLIC_API_URL in mobile\.env' -ForegroundColor Yellow
    }
    Start-Window 'Mobile (Expo)' $mobile 'npx expo start --clear'
    Write-Host '             scan the QR code in the "Mobile (Expo)" window with Expo Go'
}
