import unittest

from orchestrator.alpha.fusion import fuse_scores


class TestFusion(unittest.TestCase):
    def test_fusion_outputs_float(self) -> None:
        features = {
            "log_ret": 0.01,
            "volume": 2_000_000,
            "gex_pressure": 1000,
            "quality_score": 0.6,
            "value_score": 0.6,
            "moat_score": 0.5,
            "leverage_ratio": 0.3,
            "panic_index": 0.4,
            "fomo_index": 0.2,
            "crowding_score": 0.3,
            "loss_aversion_proxy": 0.3,
        }
        score = fuse_scores(features, regime="mixed")
        self.assertIsInstance(score, float)


if __name__ == "__main__":
    unittest.main()
