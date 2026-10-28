# Lets a phone on your home Wi-Fi reach this PC during development.
# Run ONCE in an *administrator* PowerShell:
#
#   powershell -ExecutionPolicy Bypass -File scripts\allow-firewall.ps1
#
# Opens the backend (8000) and Expo (8081) ports on PRIVATE networks only, and
# marks the current Wi-Fi as Private. Public networks (cafés, college) stay closed.

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).
    IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host 'Please run this in an administrator PowerShell (right-click Start > Terminal (Admin)).' -ForegroundColor Red
    exit 1
}

Get-NetConnectionProfile | Where-Object { $_.InterfaceAlias -match 'Wi-?Fi|Wireless|WLAN' } |
    ForEach-Object {
        Set-NetConnectionProfile -InterfaceIndex $_.InterfaceIndex -NetworkCategory Private
        Write-Host "Network '$($_.Name)' set to Private"
    }

foreach ($rule in @(
    @{ Name = 'PDF Exam backend (port 8000)'; Port = 8000 },
    @{ Name = 'PDF Exam Expo dev server (port 8081)'; Port = 8081 }
)) {
    if (-not (Get-NetFirewallRule -DisplayName $rule.Name -ErrorAction SilentlyContinue)) {
        New-NetFirewallRule -DisplayName $rule.Name -Direction Inbound -Action Allow `
            -Protocol TCP -LocalPort $rule.Port -Profile Private | Out-Null
    }
    Write-Host "Allowed TCP $($rule.Port) on private networks"
}
Write-Host 'Done. Restart Expo and rescan the QR code on the phone.' -ForegroundColor Green
