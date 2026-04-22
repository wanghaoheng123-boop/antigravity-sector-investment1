from datetime import datetime, timedelta


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
