"""
FastAPI server wrapping TradingAgents LangGraph multi-agent analysis.
Runs alongside Next.js (default: port 3001).

Start:
    python server_trading_agents.py
    # or with custom port:
    python server_trading_agents.py --port 3001

Endpoints:
    GET  /health                          → { "status": "ok" }
    POST /analyze/{ticker}                → AnalysisResult
    GET  /analyze/{ticker}/latest         → AnalysisResult | null (cached last result)

POST /analyze body (all fields optional):
{
    "trade_date":  "2024-05-10",          ← date for analysis (default: today)
    "llm_provider": "openai",             ← openai | google | anthropic | xai | openrouter | ollama
    "deep_think_llm":  "gpt-5.2",         ← model for deep reasoning
    "quick_think_llm": "gpt-5-mini",      ← model for quick tasks
    "max_debate_rounds": 1,                ← bull/bear debate rounds
    "data_vendor":  "yfinance"            ← yfinance | alpha_vantage (needs API key)
}
"""

from __future__ import annotations

import argparse
import asyncio
import os
import threading
import traceback
import uuid
from dataclasses import dataclass, field
from datetime import datetime, date
from typing import Any, Optional

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

# TradingAgents imports
from tradingagents.graph.trading_graph import TradingAgentsGraph
from tradingagents.default_config import DEFAULT_CONFIG


# ─────────────────────────────────────────────
# Pydantic models
# ─────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    trade_date: Optional[str] = None  # "YYYY-MM-DD"
    llm_provider: Optional[str] = None
    deep_think_llm: Optional[str] = None
    quick_think_llm: Optional[str] = None
    max_debate_rounds: Optional[int] = None
    max_risk_discuss_rounds: Optional[int] = None
    data_vendor: Optional[str] = None  # yfinance | alpha_vantage

    model_config = {"extra": "forbid"}


class AnalysisResult(BaseModel):
    job_id: str
    ticker: str
    trade_date: str
    decision: str
    decision_grade: str  # BUY | OVERWEIGHT | HOLD | UNDERWEIGHT | SELL
    confidence_label: str  # High | Medium | Low (derived from debate count)
    llm_provider: str
    model_used: str
    analysis_timestamp: str
    elapsed_seconds: float
    # Key extracted reports (truncated for readability)
    market_report: str = ""
    sentiment_report: str = ""
    news_report: str = ""
    fundamentals_report: str = ""
    investment_plan: str = ""
    risk_debate_summary: str = ""
    final_trade_decision: str = ""
    # Raw state keys present (for debugging)
    state_keys: list[str] = field(default_factory=list)
    error: Optional[str] = None


# ─────────────────────────────────────────────
# In-memory result cache (thread-safe)
# ─────────────────────────────────────────────

_results: dict[str, AnalysisResult] = {}
_results_lock = threading.Lock()


def grade_to_confidence(decision: str) -> str:
    d = decision.upper()
    if d in ("BUY", "SELL", "OVERWEIGHT", "UNDERWEIGHT"):
        return "High"
    if d in ("HOLD",):
        return "Medium"
    return "Low"


def build_result(
    ticker: str,
    trade_date_str: str,
    job_id: str,
    final_state: dict[str, Any] | None,
    decision: str,
    elapsed: float,
    llm_provider: str,
    model: str,
    error: str | None = None,
) -> AnalysisResult:
    if error or not final_state:
        return AnalysisResult(
            job_id=job_id,
            ticker=ticker,
            trade_date=trade_date_str,
            decision=decision or "ERROR",
            decision_grade=(decision or "ERROR").split()[0] if decision else "ERROR",
            confidence_label="Low",
            llm_provider=llm_provider,
            model_used=model,
            analysis_timestamp=datetime.utcnow().isoformat() + "Z",
            elapsed_seconds=round(elapsed, 1),
            state_keys=[],
            error=error,
        )

    def cut(s: Any, max_len: int = 1800) -> str:
        if not isinstance(s, str):
            s = str(s)
        return s[:max_len] + ("..." if len(s) > max_len else "")

    return AnalysisResult(
        job_id=job_id,
        ticker=ticker,
        trade_date=trade_date_str,
        decision=decision,
        decision_grade=decision.split()[0] if decision else "HOLD",
        confidence_label=grade_to_confidence(decision),
        llm_provider=llm_provider,
        model_used=model,
        analysis_timestamp=datetime.utcnow().isoformat() + "Z",
        elapsed_seconds=round(elapsed, 1),
        market_report=cut(final_state.get("market_report", "")),
        sentiment_report=cut(final_state.get("sentiment_report", "")),
        news_report=cut(final_state.get("news_report", "")),
        fundamentals_report=cut(final_state.get("fundamentals_report", "")),
        investment_plan=cut(final_state.get("trader_investment_plan", "")),
        risk_debate_summary=cut(final_state.get("final_trade_decision", "")),
        final_trade_decision=cut(final_state.get("final_trade_decision", "")),
        state_keys=[k for k in final_state.keys() if not k.startswith("_")],
    )


# ─────────────────────────────────────────────
# Core analysis runner (runs in thread pool)
# ─────────────────────────────────────────────

def _run_analysis(
    ticker: str,
    trade_date_str: str,
    job_id: str,
    req: AnalyzeRequest,
) -> AnalysisResult:
    config = DEFAULT_CONFIG.copy()

    provider = req.llm_provider or os.environ.get("TA_LLM_PROVIDER", "openai")
    deep_model = req.deep_think_llm or os.environ.get("TA_DEEP_MODEL", "gpt-5.2")
    quick_model = req.quick_think_llm or os.environ.get("TA_QUICK_MODEL", "gpt-5-mini")

    config.update({
        "llm_provider": provider,
        "deep_think_llm": deep_model,
        "quick_think_llm": quick_model,
        "max_debate_rounds": req.max_debate_rounds if req.max_debate_rounds is not None else 1,
        "max_risk_discuss_rounds": req.max_risk_discuss_rounds if req.max_risk_discuss_rounds is not None else 1,
        "data_vendors": {
            k: (req.data_vendor or "yfinance")
            for k in ("core_stock_apis", "technical_indicators", "fundamental_data", "news_data")
        },
    })

    start = datetime.utcnow()
    try:
        ta = TradingAgentsGraph(debug=False, config=config)
        _, decision = ta.propagate(ticker, trade_date_str)
        elapsed = (datetime.utcnow() - start).total_seconds()
        result = build_result(
            ticker=ticker,
            trade_date_str=trade_date_str,
            job_id=job_id,
            final_state=_,
            decision=decision or "HOLD",
            elapsed=elapsed,
            llm_provider=provider,
            model=deep_model,
        )
    except Exception as e:
        elapsed = (datetime.utcnow() - start).total_seconds()
        traceback.print_exc()
        result = build_result(
            ticker=ticker,
            trade_date_str=trade_date_str,
            job_id=job_id,
            final_state=None,
            decision="ERROR",
            elapsed=elapsed,
            llm_provider=provider,
            model=deep_model,
            error=f"{type(e).__name__}: {e}",
        )

    with _results_lock:
        _results[job_id] = result
        _results[f"{ticker}_latest"] = result

    return result


# ─────────────────────────────────────────────
# FastAPI app
# ─────────────────────────────────────────────

app = FastAPI(
    title="TradingAgents API",
    description="Multi-agent LLM financial trading analysis — wrapped as a FastAPI service.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "TradingAgents", "version": "0.2.2"}


@app.post("/analyze/{ticker}", response_model=AnalysisResult)
async def analyze(
    ticker: str,
    req: AnalyzeRequest = AnalyzeRequest(),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """
    Run a full multi-agent analysis for `ticker`.

    Returns a structured result with decision, all analyst reports,
    and risk debate summary.

    Note: first call with a new LLM provider may be slow (API key check +
    model download). Subsequent calls reuse the cached LangGraph session.
    """
    ticker = ticker.strip().upper()
    if not ticker:
        raise HTTPException(400, "ticker is required")

    today_str = date.today().isoformat()
    trade_date_str = req.trade_date or today_str

    try:
        datetime.strptime(trade_date_str, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(400, f"trade_date must be YYYY-MM-DD, got: {trade_date_str}")

    job_id = str(uuid.uuid4())[:8]

    # Run synchronously in a thread pool — TradingAgents is sync internally.
    # Using asyncio.to_thread so FastAPI stays responsive.
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        _run_analysis,
        ticker,
        trade_date_str,
        job_id,
        req,
    )

    return result


@app.get("/analyze/{ticker}/latest", response_model=Optional[AnalysisResult])
async def latest_analysis(ticker: str):
    """Return the most recent analysis result for this ticker (in-memory cache)."""
    ticker = ticker.strip().upper()
    with _results_lock:
        result = _results.get(f"{ticker}_latest", None)
    if not result:
        raise HTTPException(404, f"No cached analysis found for {ticker}")
    return result


# ─────────────────────────────────────────────
# CLI entrypoint
# ─────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="TradingAgents FastAPI server")
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind")
    parser.add_argument("--port", type=int, default=3001, help="Port to bind")
    args = parser.parse_args()

    import uvicorn
    print(f"\nTradingAgents API -> http://{args.host}:{args.port}")
    print(f"  POST /analyze/{{ticker}}   run analysis")
    print(f"  GET  /analyze/{{ticker}}/latest   cached result")
    print(f"  GET  /health\n")
    uvicorn.run(app, host=args.host, port=args.port, log_level="warning")


if __name__ == "__main__":
    main()
