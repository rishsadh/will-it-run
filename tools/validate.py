#!/usr/bin/env python3
"""Validate data/models.json and data/hardware-tiers.json.

Fails on any model row without a source URL and a read date, on a memory figure that is
not labelled as an estimate, on a memory figure that does not match the stated formula,
and on any price or product field in the tiers file.
Usage: python tools/validate.py [models.json] [hardware-tiers.json]
Exit codes: 0 clean, 1 problems found.
Standard library only.
"""
import datetime
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GOALS = {"chat", "writing", "coding", "images"}
CLASSES = {"small", "medium", "large", "xl"}
URL_RE = re.compile(r"^https://[^\s/]+\.[^\s]+$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
FORBIDDEN_TIER_KEYS = {"price", "prices", "usd", "cost", "product", "products", "sku", "brand", "model", "url", "link"}
REQUIRED = ["id", "name", "size_class", "quant", "file_gb", "memory_gb", "memory_basis", "licence",
            "licence_source_url", "apps", "goals", "source_url", "read_date", "gpu_only"]


def check_date(value, label, problems, today):
    if not isinstance(value, str) or not DATE_RE.match(value):
        problems.append(f"{label}: read_date missing or not YYYY-MM-DD")
        return
    try:
        d = datetime.date.fromisoformat(value)
    except ValueError:
        problems.append(f"{label}: read_date is not a real date")
        return
    if d > today:
        problems.append(f"{label}: read_date {value} is in the future")


def check_url(value, label, problems):
    if not isinstance(value, str) or not URL_RE.match(value):
        problems.append(f"{label}: needs an https URL")


def validate_models(data, today=None):
    today = today or datetime.date.today()
    problems = []
    if not isinstance(data, dict) or not isinstance(data.get("models"), list) or not data["models"]:
        return ["models.json: no models list"]
    apps = data.get("apps") or {}
    for key, app in apps.items():
        label = f"app {key}"
        check_url(app.get("source_url"), label + " source_url", problems)
        check_date(app.get("read_date"), label, problems, today)
        if not app.get("os"):
            problems.append(f"{label}: os list missing")
    seen = set()
    for i, row in enumerate(data["models"]):
        label = f"model {row.get('id', '#' + str(i))}"
        for field in REQUIRED:
            if field not in row or row[field] in ("", None, []):
                if field == "gpu_only" and row.get("gpu_only") is False:
                    continue
                problems.append(f"{label}: missing {field}")
        if row.get("id") in seen:
            problems.append(f"{label}: duplicate id")
        seen.add(row.get("id"))
        check_url(row.get("source_url"), label + " source_url", problems)
        check_url(row.get("licence_source_url"), label + " licence_source_url", problems)
        check_date(row.get("read_date"), label, problems, today)
        if row.get("memory_basis") != "estimate":
            problems.append(f"{label}: memory_basis must be 'estimate'")
        if row.get("size_class") not in CLASSES:
            problems.append(f"{label}: size_class must be one of {sorted(CLASSES)}")
        for g in row.get("goals", []):
            if g not in GOALS:
                problems.append(f"{label}: unknown goal {g}")
        for a in row.get("apps", []):
            if a not in apps:
                problems.append(f"{label}: app {a} not defined in apps")
        f, m = row.get("file_gb"), row.get("memory_gb")
        if isinstance(f, (int, float)) and isinstance(m, (int, float)):
            if f <= 0 or m <= 0:
                problems.append(f"{label}: sizes must be positive")
            expected = f * 1.15 + 1.0
            if abs(m - expected) > 0.06:
                problems.append(f"{label}: memory_gb {m} does not match file_gb * 1.15 + 1.0 = {expected:.2f}")
        elif "file_gb" in row and "memory_gb" in row:
            problems.append(f"{label}: file_gb and memory_gb must be numbers")
    return problems


def validate_tiers(data):
    problems = []
    tiers = data.get("tiers") if isinstance(data, dict) else None
    if not tiers:
        return ["hardware-tiers.json: no tiers"]
    last = 0
    for t in tiers:
        label = f"tier {t.get('id', '?')}"
        for k in t:
            if k.lower() in FORBIDDEN_TIER_KEYS:
                problems.append(f"{label}: field {k} is not allowed (no prices, no products)")
        for k in ("vram_gb", "unified_gb", "ram_gb"):
            if not isinstance(t.get(k), (int, float)) or t[k] <= 0:
                problems.append(f"{label}: {k} must be a positive number")
        if isinstance(t.get("vram_gb"), (int, float)):
            if t["vram_gb"] <= last:
                problems.append(f"{label}: tiers must rise in vram_gb")
            last = t["vram_gb"]
    return problems


def main(argv):
    models_path = Path(argv[1]) if len(argv) > 1 else ROOT / "data" / "models.json"
    tiers_path = Path(argv[2]) if len(argv) > 2 else ROOT / "data" / "hardware-tiers.json"
    problems = validate_models(json.loads(models_path.read_text(encoding="utf-8")))
    problems += validate_tiers(json.loads(tiers_path.read_text(encoding="utf-8")))
    for p in problems:
        print(p)
    print(f"{len(problems)} problems")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
