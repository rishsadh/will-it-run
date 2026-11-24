import re
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import check_release  # noqa: E402


class Release(unittest.TestCase):
    def test_check_release_is_clean(self):
        r = subprocess.run([sys.executable, str(ROOT / "tools" / "check_release.py")], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout)

    def test_price_pattern_catches_prices_not_code(self):
        rx = check_release.PRICE_RE
        for bad in ("$499", "from ₹45,000", "299 USD", "12.5 dollars"):
            self.assertTrue(rx.search(bad), bad)
        for ok in ('$("os").value', "16 GB", "1.15 + 1.0", "gpt-oss 20B"):
            self.assertFalse(rx.search(ok), ok)

    def test_no_dashes_in_public_files(self):
        for p in check_release.files():
            text = p.read_text(encoding="utf-8")
            self.assertIsNone(re.search("[–—]", text), str(p))


if __name__ == "__main__":
    unittest.main()
