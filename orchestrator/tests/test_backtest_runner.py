import unittest

from orchestrator.backtest.runner import run_backtest


class TestBacktestRunner(unittest.TestCase):
    def test_runner_metrics(self) -> None:
        rows = []
        for i in range(1, 50):
            rows.append(
                {
                    "log_ret": 0.001 if i % 2 == 0 else -0.0005,
                    "volume": 1_000_000 + i,
                    "gex_pressure": 100.0,
                    "quality_score": 0.6,
                    "value_score": 0.5,
                    "moat_score": 0.55,
                    "leverage_ratio": 0.3,
                    "panic_index": 0.45,
                    "fomo_index": 0.25,
                    "crowding_score": 0.35,
                    "loss_aversion_proxy": 0.3,
                }
            )
        metrics = run_backtest(rows)
        self.assertIn("sharpe", metrics)
        self.assertIn("sortino", metrics)
        self.assertIn("calmar", metrics)


if __name__ == "__main__":
    unittest.main()
