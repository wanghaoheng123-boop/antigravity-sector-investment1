import unittest

from orchestrator.alpha.pillar_behavior import behavior_score
from orchestrator.alpha.pillar_buffett import buffett_score
from orchestrator.alpha.pillar_medallion import medallion_score


class TestPillarSignals(unittest.TestCase):
    def test_pillars_emit_scores(self) -> None:
        features = {
            "log_ret": 0.01,
            "volume": 1_500_000,
            "gex_pressure": 300.0,
            "quality_score": 0.7,
            "value_score": 0.6,
            "moat_score": 0.5,
            "leverage_ratio": 0.2,
            "panic_index": 0.4,
            "fomo_index": 0.3,
            "crowding_score": 0.2,
            "loss_aversion_proxy": 0.2,
        }
        self.assertIsInstance(medallion_score(features), float)
        self.assertIsInstance(buffett_score(features), float)
        self.assertIsInstance(behavior_score(features), float)


if __name__ == "__main__":
    unittest.main()
