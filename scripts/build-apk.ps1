# Builds an installable Android .apk in Expo's cloud (EAS Build).
# Usage: powershell -ExecutionPolicy Bypass -File scripts\build-apk.ps1 [-Wait]
param([switch]$Wait)

$mobile = Join-Path $PSScriptRoot "..\mobile"
Set-Location $mobile

Write-Host "=== ExamNexus: Android APK build ===" -ForegroundColor Cyan

eas whoami *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Not logged in to Expo. Logging in..." -ForegroundColor Yellow
    eas login
    if ($LASTEXITCODE -ne 0) { Write-Host "[FAIL] Login failed." -ForegroundColor Red; exit 1 }
}

Write-Host "Server address baked into the APK (eas.json > build.preview.env):" -ForegroundColor Yellow
Select-String -Path eas.json -Pattern 'EXPO_PUBLIC_API_URL' | Select-Object -First 1 | ForEach-Object { Write-Host "  $($_.Line.Trim())" }
Write-Host ""

# --non-interactive avoids the prompt crash on Windows/Node 24; the keystore is kept on Expo's servers.
$buildArgs = @("build", "--platform", "android", "--profile", "preview", "--non-interactive")
if (-not $Wait) { $buildArgs += "--no-wait" }
eas @buildArgs

if ($LASTEXITCODE -ne 0) { Write-Host "[FAIL] Build failed. See the error above." -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "[OK] Build submitted. It takes about 10-15 minutes." -ForegroundColor Green
Write-Host "Download the .apk from: https://expo.dev/accounts/nikhilsah/projects/pdf-mcq-exam/builds" -ForegroundColor Cyan
Write-Host "Or list builds here with: eas build:list --platform android --limit 3" -ForegroundColor Gray
