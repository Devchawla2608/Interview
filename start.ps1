# Interview Arena PowerShell Launcher
$env:PATH = "C:\Users\devch\.gemini\antigravity\tools\node20;$env:PATH"
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  Interview Arena - Production-Grade SaaS Platform" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "[1/2] Node.js Version: $(node -v)" -ForegroundColor Yellow
Write-Host "[2/2] Starting server on http://localhost:3000 ..." -ForegroundColor Green
npx tsx server.ts
