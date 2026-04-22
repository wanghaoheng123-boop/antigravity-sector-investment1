def fetch_options_stub(symbol: str, spot: float) -> list[dict]:
    strikes = [spot * 0.9, spot * 0.95, spot, spot * 1.05, spot * 1.1]
    chain = []
    for s in strikes:
        chain.append({"symbol": symbol, "type": "call", "strike": round(s, 2), "openInterest": 500, "gamma": 0.02})
        chain.append({"symbol": symbol, "type": "put", "strike": round(s, 2), "openInterest": 450, "gamma": 0.018})
    return chain
