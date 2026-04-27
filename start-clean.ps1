<#
  Antigravity Sectors — Clean Development Server Startup
  Fixes @deno/shim-deno/which ESM corruption and starts Next.js dev server.

  Run this script from the project root (or from C:\Users\wang haoheng\AppData\Local\Temp\ag-sectors-smoke).
  Requires: Node.js installed at C:\Program Files\nodejs\node.exe
#>

param(
  [string]$Port = "3002",
  [string]$Host = "127.0.0.1"
)

$ErrorActionPreference = "Continue"

$ProjectRoot = "C:\Users\wang haoheng\AppData\Local\Temp\ag-sectors-smoke"
Set-Location $ProjectRoot

Write-Host "=== Antigravity Sectors — Clean Start ===" -ForegroundColor Cyan
Write-Host "Project: $ProjectRoot"
Write-Host "Port: $Port"
Write-Host ""

# Step 1: Fix corrupted @deno/shim-deno/which (which@4 is ESM-only but yahoo-finance2 uses CJS require)
Write-Host "[1/4] Fixing corrupted @deno/shim-deno/which..." -ForegroundColor Yellow
$WhichPath = "$ProjectRoot\node_modules\@deno\shim-deno\node_modules\which"
if (Test-Path $WhichPath) {
  # Delete the broken nested which (npm hoisting shadow)
  Remove-Item -LiteralPath $WhichPath -Recurse -Force -ErrorAction SilentlyContinue
  Write-Host "      Removed broken nested which package."
}
# Ensure top-level which@3 (CJS) is available
Write-Host "      Using top-level which@3 (CJS-compatible)."

# Step 2: Ensure yahoo-finance2 is intact
Write-Host "[2/4] Checking yahoo-finance2..." -ForegroundColor Yellow
npm install yahoo-finance2 --prefix $ProjectRoot --no-save --silent 2>&1 | Out-Null
Write-Host "      yahoo-finance2 OK."

# Step 3: Kill any existing process on the port
Write-Host "[3/4] Clearing port $Port..." -ForegroundColor Yellow
Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
Write-Host "      Port $Port cleared."

# Step 4: Start Next.js dev server
Write-Host "[4/4] Starting Next.js dev server on http://$Host`:$Port..." -ForegroundColor Yellow
Write-Host ""
& "$ProjectRoot\node_modules\.bin\next.cmd" dev --hostname $Host --port $Port 2>&1
