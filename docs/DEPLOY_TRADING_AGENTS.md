# Deploying the TradingAgents LLM Backend

The QUANTAN frontend (Vercel) talks to a Python FastAPI service
(`server_trading_agents.py`) that runs the multi-agent debate. The two are
loosely coupled: the frontend reads `process.env.TRADING_AGENTS_BASE` and
proxies all `/analyze/*` calls to that origin. **If the env var is unset or
unreachable, the LLM tab on `/stock/[ticker]` shows "Backend not configured"
and analyses cannot run.**

This doc walks through deploying the backend on **Railway** (recommended)
and **Render**, and wiring it into Vercel.

---

## What's already in the repo

| File | Role |
| --- | --- |
| `server_trading_agents.py` | FastAPI app — exposes `/health`, `/smoke`, `/analyze/{ticker}`, `/analyze/{ticker}/latest`. |
| `requirements.txt` | Python deps — `fastapi`, `uvicorn[standard]`, `pydantic`, `tradingagents`. |
| `Procfile` | `web: python server_trading_agents.py --host 0.0.0.0 --port $PORT` — used by Railway/Render. |

The Python entrypoint already binds to `$PORT` — no platform-specific
changes are required.

---

## Option A — Railway (recommended)

1. **Create a new project**

   `https://railway.app` → **New Project** → **Deploy from GitHub repo** →
   pick this repo. Railway auto-detects the `Procfile` and builds via Nixpacks.

2. **Set environment variables**

   Project → **Variables** tab:

   - `OPENAI_API_KEY` — *optional fallback*. Users can supply their own key
     per request via the QuantLab UI; this default is only used when no
     per-request key is supplied. Leave unset if you want to force users to
     bring their own key.
   - `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `XAI_API_KEY`,
     `OPENROUTER_API_KEY` — same logic as above.
   - `PORT` — Railway sets this automatically; do not override.

3. **Generate a public domain**

   Service → **Settings** → **Networking** → **Generate Domain**.
   You will get a URL like `https://quantan-trading-agents.up.railway.app`.

4. **Smoke-test the deployment**

   ```bash
   curl https://quantan-trading-agents.up.railway.app/health
   # → {"status":"ok","service":"TradingAgents","version":"0.3.0"}

   curl https://quantan-trading-agents.up.railway.app/smoke
   # → {"ok":true, "context_propagation":true, "elapsed_ms":<number>, ...}
   ```

   Both must succeed before continuing. If `/smoke.context_propagation`
   is `false`, the FastAPI/asyncio version on the host is stripping
   contextvars across the executor boundary — file an issue.

5. **Wire into Vercel** (see "Vercel configuration" below).

---

## Option B — Render

1. `https://render.com` → **New** → **Web Service** → connect this repo.
2. **Runtime:** Python 3.11.
3. **Build command:** `pip install -r requirements.txt`
4. **Start command:** `uvicorn server_trading_agents:app --host 0.0.0.0 --port $PORT`
5. Set the same `*_API_KEY` env vars as Railway above.
6. Render assigns a URL like `https://quantan-trading-agents.onrender.com`.
7. Curl `/health` and `/smoke` to verify.

> Render's free tier sleeps after 15 minutes idle and takes ~30s to wake.
> For production use a paid plan or stick to Railway.

---

## Vercel configuration

Once the backend is up and `/health` + `/smoke` return 200:

1. Vercel project → **Settings** → **Environment Variables**.
2. Add:
   - `TRADING_AGENTS_BASE` = your backend's public HTTPS origin
     (`https://quantan-trading-agents.up.railway.app`). **No trailing slash,
     no path.** HTTPS is required in production — the proxy route blocks
     `http://` with a 502 `invalid_trading_agents_base` error.
   - *(optional)* `TRADING_AGENTS_FALLBACK_BASE` — a secondary origin used
     only if the primary is unconfigured. Useful for ops failover.
3. **Apply to:** Production, Preview, and Development.
4. Trigger a redeploy (push to `main`, or **Deployments** → "Redeploy").

### Verifying from the browser

After redeploy, open `/stock/AAPL` → **LLM** tab. You should see:

- A green dot + "Setup complete · Ready" badge.
- The status panel shows `backend: <your URL>`.
- Entering a valid OpenAI/Anthropic key and clicking **Run analysis**
  successfully returns a result (5–8 minutes for default 1-round debate;
  longer for higher debate rounds).

If the dot is red:

- **`backend_not_configured`** — `TRADING_AGENTS_BASE` is not set in Vercel
  for the active environment. Re-check the env var and the deploy.
- **`backend_unreachable`** — Vercel reached the URL but got a non-200.
  Curl `/health` directly; check the backend logs on Railway/Render.
- **`invalid_trading_agents_base`** — URL is malformed or http-only in
  production. Use the canonical HTTPS origin only.

---

## Health endpoints reference

| Endpoint | Purpose | Cost |
| --- | --- | --- |
| `GET /health` | Liveness only — confirms the FastAPI app is running. | Free. |
| `GET /smoke`  | Liveness + asyncio/contextvar propagation probe + provider list. Does **not** call any LLM. | Free. |
| `GET /api/trading-agents/health?deep=1` (Vercel proxy) | Calls `/smoke` instead of `/health` so the QuantLab UI shows "Ready" only when the deep probe is green. | Free. |

---

## Privacy and key handling

- Per-request API keys travel: browser → Vercel proxy → your backend → LLM
  provider. They are **never** logged, written to disk, or stored in the
  result cache.
- The Python backend uses a `_ApiKeyEnvGuard` context manager + a private
  `contextvars.ContextVar` to scope the key to the single request thread
  (Phase 11 A3 fix — previously a bug could leak the key into the global
  process env when the env var didn't pre-exist).
- If a user submits an api_key but the contextvar fails to propagate into
  the worker thread, the request aborts with `ContextPropagationError`
  rather than silently falling through to the server's default credentials.

---

## Cost expectations

A single 1-round debate with `gpt-4o` deep + `gpt-4o-mini` quick costs
roughly **$0.15–$0.40** in OpenAI usage and takes 4–7 minutes. Higher
`max_debate_rounds` and `max_risk_discuss_rounds` multiply both. Users
supplying their own key bear that cost on their own provider account; the
operator's `OPENAI_API_KEY` (if set) is only used as a fallback.
