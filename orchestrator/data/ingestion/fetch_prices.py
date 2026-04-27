from __future__ import annotations

import json
import os
from datetime import datetime, timedelta
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen


def fetch_prices_stub(symbol: str, days: int = 120) -> list[dict]:
    """Deterministic offline stub for pipeline wiring."""
    now = datetime.utcnow()
    rows = []
    price = 100.0
    for i in range(days):
        ts = (now - timedelta(days=days - i)).isoformat()
        drift = 0.001 if i % 7 else -0.002
        price = max(1.0, price * (1 + drift))
        rows.append(
            {
                "timestamp": ts,
                "open": price * 0.998,
                "high": price * 1.005,
                "low": price * 0.995,
                "close": price,
                "volume": 1_000_000 + (i * 500),
                "symbol": symbol,
            }
        )
    return rows


def fetch_prices(symbol: str, days: int = 120) -> tuple[list[dict], str]:
    """Fetch prices from local API when available, fallback to deterministic stub."""
    api_base = os.getenv("QUANTAN_API_BASE")
    if api_base:
        url = f"{api_base.rstrip('/')}/api/analytics/{symbol}"
        try:
            with urlopen(url, timeout=8) as resp:  # nosec B310
                payload = json.loads(resp.read().decode("utf-8"))
            history = payload.get("history") or []
            rows = []
            for item in history[-days:]:
                rows.append(
                    {
                        "timestamp": item.get("date") or item.get("timestamp"),
                        "open": float(item["open"]),
                        "high": float(item["high"]),
                        "low": float(item["low"]),
                        "close": float(item["close"]),
                        "volume": float(item.get("volume", 0.0)),
                        "symbol": symbol,
                    }
                )
            if rows:
                return rows, "api"
        except (URLError, TimeoutError, KeyError, ValueError, json.JSONDecodeError):
            pass

    fixture_path = os.getenv("QUANTAN_PRICE_FIXTURE")
    if fixture_path and Path(fixture_path).exists():
        payload = json.loads(Path(fixture_path).read_text(encoding="utf-8"))
        rows = [x for x in payload if str(x.get("symbol", symbol)).upper() == symbol.upper()]
        if rows:
            return rows[-days:], "fixture"
    return fetch_prices_stub(symbol, days=days), "stub"
