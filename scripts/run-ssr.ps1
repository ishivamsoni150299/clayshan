# Usage:
#   pwsh .\scripts\run-ssr.ps1 -Token "YOUR_TOKEN" -Port 4000 -Rate 83 -Ttl 300000 -Markup 15
# Or put your token in a file named 'silverbene.token' at the project root and run without -Token.

param(
  [string]$Token,
  [int]$Port = 4000,
  [int]$Rate = 83,
  [int]$Ttl = 300000,
  [int]$Markup = 0,
  [switch]$NoDbCatalog
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Read token from file if not provided
if (-not $Token) {
  $tokenFile = Join-Path (Get-Location) 'silverbene.token'
  if (Test-Path $tokenFile) {
    $Token = (Get-Content -Raw $tokenFile).Trim()
  }
}

if (-not $Token) {
  Write-Error "SILVERBENE token not provided. Pass -Token or create silverbene.token"
  exit 1
}

# Env for current process
$env:SILVERBENE_ACCESS_TOKEN = $Token
$env:EXCHANGE_RATE_USD_INR = "$Rate"
$env:SUPPLIER_CACHE_TTL_MS = "$Ttl"
if ($Markup -gt 0) { $env:PRICE_MARKUP = "$Markup" } else { Remove-Item Env:PRICE_MARKUP -ErrorAction SilentlyContinue }
$env:PORT = "$Port"
if ($NoDbCatalog -or $true) { $env:NO_DB_CATALOG = '1' }

Write-Host "Building app (SSR)..." -ForegroundColor Cyan
npx ng build
if ($LASTEXITCODE -ne 0) { Write-Error "Build failed"; exit 1 }

$server = Join-Path (Get-Location) 'dist\clayshan\server\server.mjs'
if (-not (Test-Path $server)) { Write-Error "Server bundle not found: $server"; exit 1 }

Write-Host "Starting SSR/API on http://localhost:$Port" -ForegroundColor Green
& node $server

