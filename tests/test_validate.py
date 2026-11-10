import copy
import datetime
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import validate  # noqa: E402

TODAY = datetime.date(2026, 11, 20)
MODELS = json.loads((ROOT / "data" / "models.json").read_text(encoding="utf-8"))
TIERS = json.loads((ROOT / "data" / "hardware-tiers.json").read_text(encoding="utf-8"))


def broken(**changes):
    d = copy.deepcopy(MODELS)
    d["models"][0].update(changes)
    return d


class ValidateModels(unittest.TestCase):
    def test_real_data_is_clean(self):
        self.assertEqual(validate.validate_models(MODELS, TODAY), [])
        self.assertEqual(validate.validate_tiers(TIERS), [])

    def test_about_twelve_models(self):
        self.assertEqual(len(MODELS["models"]), 12)

    def test_missing_source_fails(self):
        d = copy.deepcopy(MODELS)
        del d["models"][0]["source_url"]
        self.assertTrue(any("source_url" in p for p in validate.validate_models(d, TODAY)))

    def test_empty_source_fails(self):
        self.assertTrue(validate.validate_models(broken(source_url=""), TODAY))

    def test_non_https_source_fails(self):
        self.assertTrue(validate.validate_models(broken(source_url="http://example.com/x"), TODAY))

    def test_missing_date_fails(self):
        d = copy.deepcopy(MODELS)
        del d["models"][0]["read_date"]
        self.assertTrue(any("read_date" in p for p in validate.validate_models(d, TODAY)))

    def test_bad_and_future_dates_fail(self):
        self.assertTrue(validate.validate_models(broken(read_date="10 Nov 2026"), TODAY))
        self.assertTrue(validate.validate_models(broken(read_date="2026-13-40"), TODAY))
        self.assertTrue(validate.validate_models(broken(read_date="2027-01-01"), TODAY))

    def test_memory_must_be_estimate(self):
        self.assertTrue(validate.validate_models(broken(memory_basis="measured"), TODAY))

    def test_memory_must_match_formula(self):
        self.assertTrue(validate.validate_models(broken(memory_gb=1.0), TODAY))

    def test_unknown_goal_and_app_fail(self):
        self.assertTrue(validate.validate_models(broken(goals=["gaming"]), TODAY))
        self.assertTrue(validate.validate_models(broken(apps=["nope"]), TODAY))

    def test_duplicate_id_fails(self):
        d = copy.deepcopy(MODELS)
        d["models"][1]["id"] = d["models"][0]["id"]
        self.assertTrue(any("duplicate" in p for p in validate.validate_models(d, TODAY)))

    def test_empty_list_fails(self):
        self.assertTrue(validate.validate_models({"models": []}, TODAY))


class ValidateTiers(unittest.TestCase):
    def test_price_field_fails(self):
        d = copy.deepcopy(TIERS)
        d["tiers"][0]["price"] = 999
        self.assertTrue(validate.validate_tiers(d))

    def test_product_field_fails(self):
        d = copy.deepcopy(TIERS)
        d["tiers"][0]["product"] = "x"
        self.assertTrue(validate.validate_tiers(d))

    def test_tiers_must_rise(self):
        d = copy.deepcopy(TIERS)
        d["tiers"][1]["vram_gb"] = 1
        self.assertTrue(validate.validate_tiers(d))


if __name__ == "__main__":
    unittest.main()
