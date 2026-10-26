"""Live Gemini verification. Makes REAL API calls using the key in backend/.env.

Usage (from backend/, venv active):
    python live_check.py                       # config check + one minimal Gemini call
    python live_check.py --food meal.jpg --freshness fruit.jpg --kitchen kitchen.jpg
    python live_check.py --all --food meal.jpg # also exercises recipes and meal planner

Every step goes through the real Flask routes (test client), so it covers
validation, prompts, Gemini, response parsing, and the JSON envelope.
The API key is never printed. Exit code 0 means every requested step passed.
"""
import argparse
import io
import mimetypes
import os
import sys

os.environ["RATE_LIMIT_PER_MINUTE"] = "0"  # this script is the only client

from app import app  # noqa: E402  (loads .env)
from services import gemini_service  # noqa: E402

results = []


def record(name, status, detail=""):
    results.append((name, status))
    print(f"[{status:7}] {name}" + (f" - {detail}" if detail else ""))


def check_image(client, name, path, endpoint, keys):
    if not path:
        return
    try:
        with open(path, "rb") as fh:
            data = fh.read()
    except OSError as exc:
        record(name, "FAIL", f"cannot read {path}: {exc.strerror}")
        return
    res = client.post(endpoint, data={"image": (io.BytesIO(data), os.path.basename(path))}, content_type="multipart/form-data")
    report(name, res, keys)


def report(name, res, keys):
    body = res.get_json() or {}
    if res.status_code == 200 and body.get("success"):
        missing = [k for k in keys if k not in body["data"]]
        record(name, "FAIL" if missing else "PASS", f"missing keys {missing}" if missing else f"keys ok, model={body.get('model')}")
        if not missing:
            preview = {k: body["data"][k] for k in keys[:3]}
            print(f"          sample: {preview}")
    else:
        err = body.get("error", {})
        record(name, "FAIL", f"HTTP {res.status_code} {err.get('code')}: {err.get('message')}")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--food")
    parser.add_argument("--freshness")
    parser.add_argument("--kitchen")
    parser.add_argument("--all", action="store_true", help="also test recipes and meal planner")
    args = parser.parse_args()

    print(f"model={gemini_service.get_model()}  sdk_installed={gemini_service.sdk_installed()}  key_set={gemini_service.is_configured()}")
    if not gemini_service.sdk_installed():
        record("SDK", "BLOCKED", "google-genai not installed: pip install -r requirements.txt")
        return 2
    if not gemini_service.is_configured():
        record("API key", "BLOCKED", "GEMINI_API_KEY missing or placeholder in backend/.env")
        return 2

    client = app.test_client()
    try:
        out = gemini_service.generate_json('Return exactly {"ok": true} as JSON.', required_keys=("ok",), temperature=0)
        record("Minimal Gemini call", "PASS" if out.get("ok") is True else "FAIL", "provider responded with valid JSON")
    except Exception as exc:  # report translated message only
        record("Minimal Gemini call", "FAIL", getattr(exc, "message", None) or str(exc))
        return 1

    check_image(client, "Food Scanner", args.food, "/api/food/analyze", ["is_food", "calories", "protein_g", "carbs_g", "fat_g", "summary"])
    check_image(client, "Freshness Check", args.freshness, "/api/food/freshness", ["condition", "observations", "condition_summary"])
    check_image(client, "Kitchen Review", args.kitchen, "/api/kitchen/analyze", ["is_kitchen", "observed_evidence", "summary", "checklist"])
    if args.all:
        report("Cooking Assistant", client.post("/api/cooking/recipes", json={"ingredients": "rice, spinach, paneer, onion", "diet": "Vegetarian", "max_time": 30, "difficulty": "Easy"}), ["recipes"])
        report("Meal Planner", client.post("/api/meals/plan", json={"food_preference": "Vegetarian", "calorie_target": 1800, "meals_per_day": 3, "allergies": ["peanuts"]}), ["meals", "totals", "allergen_flags"])

    failed = [n for n, s in results if s == "FAIL"]
    print(f"\n{sum(s == 'PASS' for _, s in results)} passed, {len(failed)} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
