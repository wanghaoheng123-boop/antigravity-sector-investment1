from __future__ import annotations

import json
import os
from urllib.error import URLError
from urllib.request import urlopen


def fetch_options_stub(symbol: str, spot: float) -> list[dict]:
    strikes = [spot * 0.9, spot * 0.95, spot, spot * 1.05, spot * 1.1]
    chain = []
    for s in strikes:
        chain.append({"symbol": symbol, "type": "call", "strike": round(s, 2), "openInterest": 500, "gamma": 0.02})
        chain.append({"symbol": symbol, "type": "put", "strike": round(s, 2), "openInterest": 450, "gamma": 0.018})
    return chain


def fetch_options(symbol: str, spot: float) -> tuple[list[dict], str]:
    """Fetch options intelligence chain proxy from local API when possible."""
    api_base = os.getenv("QUANTAN_API_BASE")
    if api_base:
        url = f"{api_base.rstrip('/')}/api/options/intelligence/{symbol}"
        try:
            with urlopen(url, timeout=8) as resp:  # nosec B310
                payload = json.loads(resp.read().decode("utf-8"))
            call_wall = payload.get("callWallStrike")
            put_wall = payload.get("putWallStrike")
            max_pain = payload.get("maxPainStrike")
            strikes = [x for x in [call_wall, put_wall, max_pain, spot] if isinstance(x, (int, float))]
            if strikes:
                chain: list[dict] = []
                for s in sorted(set(float(x) for x in strikes)):
                    chain.append({"symbol": symbol, "type": "call", "strike": round(s, 2), "openInterest": 700, "gamma": 0.02})
                    chain.append({"symbol": symbol, "type": "put", "strike": round(s, 2), "openInterest": 650, "gamma": 0.018})
                return chain, "api"
        except (URLError, TimeoutError, ValueError, json.JSONDecodeError):
            pass
    return fetch_options_stub(symbol, spot), "stub"
