def fetch_sentiment_stub(_symbol: str) -> dict[str, float]:
    return {
        "panic_index": 0.42,
        "fomo_index": 0.33,
        "crowding_score": 0.4,
        "loss_aversion_proxy": 0.35,
    }
