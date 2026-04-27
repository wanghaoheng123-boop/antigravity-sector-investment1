import unittest

from orchestrator.options_intel.gex_profile import compute_gex_profile
from orchestrator.options_intel.max_pain import compute_max_pain


class TestOptionsIntel(unittest.TestCase):
    def setUp(self) -> None:
        self.chain = [
            {"type": "call", "strike": 90, "openInterest": 100, "gamma": 0.02},
            {"type": "call", "strike": 100, "openInterest": 150, "gamma": 0.02},
            {"type": "put", "strike": 95, "openInterest": 120, "gamma": 0.018},
            {"type": "put", "strike": 105, "openInterest": 200, "gamma": 0.018},
        ]

    def test_max_pain_returns_value(self) -> None:
        mp = compute_max_pain(self.chain)
        self.assertIsNotNone(mp)

    def test_gex_profile_keys(self) -> None:
        gex = compute_gex_profile(self.chain, 100.0)
        self.assertIn("call_wall", gex)
        self.assertIn("put_wall", gex)
        self.assertIn("gex_total", gex)


if __name__ == "__main__":
    unittest.main()
