# One-time setup (and re-run after pulling updates): installs all dependencies
# and creates the .env files from the examples if they don't exist yet.
#
#   powershell -ExecutionPolicy Bypass -File scripts\setup.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

function Copy-EnvIfMissing($dir) {
    $envFile = Join-Path $dir '.env'
    if (-not (Test-Path $envFile)) {
        Copy-Item (Join-Path $dir '.env.example') $envFile
        Write-Host "  created $envFile  <-- fill in your values" -ForegroundColor Yellow
    } else {
        Write-Host "  $envFile already exists (kept)"
    }
}

Write-Host "`n[1/3] Backend (Python)" -ForegroundColor Cyan
Push-Location (Join-Path $root 'backend')
if (-not (Test-Path '.venv')) { python -m venv .venv }
& .\.venv\Scripts\python.exe -m pip install --upgrade pip --quiet
& .\.venv\Scripts\python.exe -m pip install -r requirements.txt --quiet
Copy-EnvIfMissing (Get-Location)
Pop-Location

Write-Host "`n[2/3] Website (React)" -ForegroundColor Cyan
Push-Location (Join-Path $root 'frontend')
npm install --no-audit --no-fund
Copy-EnvIfMissing (Get-Location)
Pop-Location

Write-Host "`n[3/3] Mobile app (Expo)" -ForegroundColor Cyan
Push-Location (Join-Path $root 'mobile')
npm install --no-audit --no-fund
Copy-EnvIfMissing (Get-Location)
Pop-Location

Write-Host "`nSetup done." -ForegroundColor Green
Write-Host "Next: fill in backend\.env (MONGODB_URI, GROQ_API_KEY, JWT_SECRET), then run:"
Write-Host "  powershell -ExecutionPolicy Bypass -File scripts\start-all.ps1"
