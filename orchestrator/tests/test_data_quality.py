import unittest

from orchestrator.data.quality.denoise import kalman_1d, noise_score, robust_zscore_filter
from orchestrator.data.quality.validate import validate_ohlcv


class TestDataQuality(unittest.TestCase):
    def test_validate_ohlcv_pass(self) -> None:
        rows = [
            {"timestamp": "t1", "open": 1, "high": 2, "low": 1, "close": 1.5, "volume": 10},
            {"timestamp": "t2", "open": 1.5, "high": 2.2, "low": 1.4, "close": 2.0, "volume": 20},
        ]
        result = validate_ohlcv(rows)
        self.assertTrue(result["validation_pass"])

    def test_denoise_reduces_noise(self) -> None:
        raw = [100, 101, 99, 250, 100, 101]
        cleaned = kalman_1d(robust_zscore_filter(raw))
        self.assertLessEqual(noise_score(cleaned), noise_score(raw))


if __name__ == "__main__":
    unittest.main()
