# TradingAgents + Antigravity Sectors — Startup Script
# ─────────────────────────────────────────────────────────────
# Prerequisites (install once):
#   pip install fastapi "uvicorn[standard]" python-multipart
#   pip install --upgrade git+https://github.com/TauricResearch/TradingAgents.git
#
# Or use the Python venv at: C:\Users\wang haoheng\AppData\Local\Temp\ta-venv
#
# ─── API KEYS ────────────────────────────────────────────────────────────────
# At least ONE of these is required to run LLM analysis:
#
#   OPENAI_API_KEY       → https://platform.openai.com/api-keys
#   ANTHROPIC_API_KEY    → https://console.anthropic.com/
#   GOOGLE_API_KEY       → https://aistudio.google.com/app/apikey
#   XAI_API_KEY         → https://console.x.ai/
#   OPENROUTER_API_KEY   → https://openrouter.ai/keys
#
# Alpha Vantage (optional, for alternative data vendor):
#   ALPHA_VANTAGE_API_KEY → https://www.alphavantage.co/support/#api-key
#
# ─── 1. Set keys in this session ──────────────────────────────────────────
# Replace the value below with your actual key:
$env:OPENAI_API_KEY = "sk-your-key-here"

# ─── 2. Start the TradingAgents FastAPI server ─────────────────────────────
$TA_PYTHON = "C:\Users\wang haoheng\AppData\Local\Temp\ta-venv\Scripts\python.exe"
$TA_SCRIPT = "g:\其他计算机\My Mac\Desktop\ANITIGRAVITY INVESTMENT ANALYSIS\antigravity-sectors\server_trading_agents.py"
$TA_PORT = 3001

Write-Host "`nStarting TradingAgents API on http://127.0.0.1:$TA_PORT ..." -ForegroundColor Cyan
Start-Process $TA_PYTHON -ArgumentList "-X utf8", "$TA_SCRIPT --port $TA_PORT" -WindowStyle Normal

Start-Sleep -Seconds 4

# ─── 3. Health check ───────────────────────────────────────────────────────
try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:$TA_PORT/health" -UseBasicParsing -TimeoutSec 5
    if ($r.StatusCode -eq 200) {
        Write-Host "TradingAgents API: UP" -ForegroundColor Green
        $j = $r.Content | ConvertFrom-Json
        Write-Host "  Version: $($j.version) | Service: $($j.service)"
    }
} catch {
    Write-Host "TradingAgents API: DOWN (is the server running?)" -ForegroundColor Red
}

# ─── 4. Start Next.js dev server ──────────────────────────────────────────
$NX_SCRIPT = "g:\其他计算机\My Mac\Desktop\ANITIGRAVITY INVESTMENT ANALYSIS\antigravity-sectors\node_modules\.bin\next.cmd"
$NX_PORT = 3000
$NX_CWD = "g:\其他计算机\My Mac\Desktop\ANITIGRAVITY INVESTMENT ANALYSIS\antigravity-sectors"

Write-Host "`nStarting Next.js on http://127.0.0.1:$NX_PORT ..." -ForegroundColor Cyan
Start-Process cmd -ArgumentList "/c cd /d `"$NX_CWD`" && npm run dev -- --hostname 127.0.0.1 --port $NX_PORT" -WindowStyle Normal

Write-Host "`nDone. Open: http://127.0.0.1:$NX_PORT" -ForegroundColor Green
Write-Host "LLM tab requires a valid API key set above." -ForegroundColor Yellow
