"""Backend tests. Run from backend/:  python -m unittest discover -s tests -v

Routes are tested with Gemini mocked, and the Gemini service is tested against a
fake google-genai module. These tests prove our own logic; they do NOT prove a live
Gemini call works. Use `python live_check.py` for that.
"""
import io
import json
import os
import struct
import sys
import types
import unittest
import zlib
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app import create_app  # noqa: E402
from services import gemini_service  # noqa: E402
from services.gemini_service import GeminiServiceError  # noqa: E402
from utils.rate_limit import RateLimiter  # noqa: E402


def _chunk(kind, data):
    body = kind + data
    return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)


def make_png():
    """A real, complete 1x1 PNG."""
    ihdr = struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)
    idat = zlib.compress(b"\x00\xff\x00\x00")
    return b"\x89PNG\r\n\x1a\n" + _chunk(b"IHDR", ihdr) + _chunk(b"IDAT", idat) + _chunk(b"IEND", b"")


PNG = make_png()
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 32 + b"\xff\xd9"
WEBP = b"RIFF" + struct.pack("<I", 4 + 8) + b"WEBPVP8 " + b"\x00" * 4

FOOD_JSON = {"is_food": True, "calories": 420, "protein_g": 20, "carbs_g": 50, "fat_g": 15, "summary": "ok", "items": []}
FRESH_JSON = {"condition": "some_concerns", "observations": ["brown spots"], "condition_summary": "careful"}
KITCHEN_JSON = {"is_kitchen": True, "observed_evidence": ["crumbs"], "summary": "ok", "checklist": ["wipe counter"]}
MEAL_PAYLOAD = {"food_preference": "Vegetarian", "calorie_target": 1800, "meals_per_day": 2}
MULTIPART = "multipart/form-data"


def upload(name="meal.png", data=PNG):
    return {"image": (io.BytesIO(data), name)}


class RouteTests(unittest.TestCase):
    def setUp(self):
        env = patch.dict(os.environ, {"RATE_LIMIT_PER_MINUTE": "0"})  # limiter has its own tests
        env.start()
        self.addCleanup(env.stop)
        self.app = create_app()
        self.client = self.app.test_client()

    # --- health / generic behaviour ---
    def test_health_reports_config_without_secrets(self):
        with patch.dict(os.environ, {"GEMINI_API_KEY": "super-secret-key"}):
            res = self.client.get("/api/health")
        data = res.get_json()["data"]
        self.assertEqual(res.status_code, 200)
        self.assertTrue(data["gemini_configured"])
        self.assertNotIn("super-secret-key", res.get_data(as_text=True))

    def test_health_does_not_call_gemini(self):
        with patch("services.gemini_service.generate_json") as mock, patch.dict(os.environ, {"GEMINI_API_KEY": "k"}):
            self.client.get("/api/health")
        mock.assert_not_called()

    def test_debug_is_off_by_default(self):
        self.assertFalse(self.app.debug)

    def test_unknown_route_and_wrong_method_are_json(self):
        res = self.client.get("/api/nope")
        self.assertEqual((res.status_code, res.get_json()["error"]["code"]), (404, "not_found"))
        res = self.client.get("/api/food/analyze")
        self.assertEqual(res.status_code, 405)
        self.assertFalse(res.get_json()["success"])

    def test_unexpected_exception_hides_details(self):
        with patch("routes.food_routes.generate_json", side_effect=RuntimeError("secret internals")):
            res = self.client.post("/api/food/analyze", data=upload(), content_type=MULTIPART)
        self.assertEqual(res.status_code, 500)
        self.assertNotIn("secret internals", res.get_data(as_text=True))

    # --- image validation (shared by 3 endpoints) ---
    def test_all_image_endpoints_validate_input(self):
        for path in ("/api/food/analyze", "/api/food/freshness", "/api/kitchen/analyze"):
            with self.subTest(path=path, case="missing"):
                self.assertEqual(self.client.post(path).status_code, 400)
            with self.subTest(path=path, case="gif extension"):
                res = self.client.post(path, data=upload("x.gif"), content_type=MULTIPART)
                self.assertEqual(res.status_code, 400)
            with self.subTest(path=path, case="renamed text file"):
                res = self.client.post(path, data=upload("x.png", b"not an image"), content_type=MULTIPART)
                self.assertEqual(res.status_code, 400)
            with self.subTest(path=path, case="empty"):
                res = self.client.post(path, data=upload("x.png", b""), content_type=MULTIPART)
                self.assertEqual(res.status_code, 400)

    def test_truncated_images_rejected(self):
        for name, data in (("a.png", PNG[:-20]), ("a.jpg", JPEG[:-2] + b"\x00" * 8000), ("a.webp", WEBP[:-6])):
            with self.subTest(name=name):
                res = self.client.post("/api/food/analyze", data=upload(name, data), content_type=MULTIPART)
                self.assertEqual(res.status_code, 400)
                self.assertIn("corrupted", res.get_json()["error"]["message"])

    def test_valid_formats_reach_gemini_with_detected_mime(self):
        for name, data, mime in (("a.png", PNG, "image/png"), ("a.jpg", JPEG, "image/jpeg"), ("a.webp", WEBP, "image/webp")):
            with self.subTest(mime=mime), patch("routes.food_routes.generate_json", return_value=dict(FOOD_JSON)) as mock:
                res = self.client.post("/api/food/analyze", data=upload(name, data), content_type=MULTIPART)
                self.assertEqual(res.status_code, 200)
                self.assertEqual(mock.call_args.kwargs["image"], (data, mime))

    def test_mime_comes_from_content_not_filename(self):
        with patch("routes.food_routes.generate_json", return_value=dict(FOOD_JSON)) as mock:
            self.client.post("/api/food/analyze", data=upload("pretend.jpg", PNG), content_type=MULTIPART)
        self.assertEqual(mock.call_args.kwargs["image"][1], "image/png")

    def test_size_limits(self):
        over_8mb = PNG[:-12] + b"\x00" * int(8.3 * 1024 * 1024) + PNG[-12:]
        res = self.client.post("/api/food/analyze", data=upload("x.png", over_8mb), content_type=MULTIPART)
        self.assertEqual(res.status_code, 400)
        self.assertIn("8 MB", res.get_json()["error"]["message"])
        res = self.client.post("/api/food/analyze", data=upload("x.png", b"\x00" * (10 * 1024 * 1024)), content_type=MULTIPART)
        self.assertEqual((res.status_code, res.get_json()["error"]["code"]), (413, "file_too_large"))

    # --- success paths (Gemini mocked) ---
    def test_image_endpoints_success(self):
        cases = (
            ("/api/food/analyze", "routes.food_routes.generate_json", FOOD_JSON, "calories", 420),
            ("/api/food/freshness", "routes.food_routes.generate_json", FRESH_JSON, "condition", "some_concerns"),
            ("/api/kitchen/analyze", "routes.food_routes.generate_json", KITCHEN_JSON, "is_kitchen", True),
        )
        for path, target, payload, key, expected in cases:
            with self.subTest(path=path), patch(target, return_value=dict(payload)):
                res = self.client.post(path, data=upload(), content_type=MULTIPART)
                self.assertEqual(res.status_code, 200)
                self.assertEqual(res.get_json()["data"][key], expected)

    # --- missing key / provider failures surface as clean envelopes ---
    def test_missing_key_for_every_ai_endpoint(self):
        with patch.dict(os.environ, {"GEMINI_API_KEY": ""}):
            for path in ("/api/food/analyze", "/api/food/freshness", "/api/kitchen/analyze"):
                res = self.client.post(path, data=upload(), content_type=MULTIPART)
                self.assertEqual((path, res.status_code), (path, 503))
                self.assertIn("GEMINI_API_KEY", res.get_json()["error"]["message"])
            self.assertEqual(self.client.post("/api/cooking/recipes", json={"ingredients": "egg"}).status_code, 503)
            self.assertEqual(self.client.post("/api/meals/plan", json=MEAL_PAYLOAD).status_code, 503)

    def test_provider_errors_are_translated(self):
        for error, status, code in (
            (GeminiServiceError("quota", 429, "rate_limited"), 429, "rate_limited"),
            (GeminiServiceError("bad output", 502, "bad_response"), 502, "bad_response"),
            (GeminiServiceError("slow", 504, "ai_timeout"), 504, "ai_timeout"),
        ):
            with self.subTest(code=code), patch("routes.food_routes.generate_json", side_effect=error):
                res = self.client.post("/api/food/analyze", data=upload(), content_type=MULTIPART)
                self.assertEqual((res.status_code, res.get_json()["error"]["code"]), (status, code))

    # --- recipes ---
    def test_recipes_validation(self):
        for payload in ({"ingredients": ""}, {"ingredients": "   "}, {"ingredients": "egg", "max_time": 9999},
                        {"ingredients": "egg", "max_time": 30.5}, {"ingredients": "egg", "diet": "Carnivore"},
                        {"ingredients": "egg", "difficulty": "Impossible"}, {"ingredients": ["egg"]},
                        {"ingredients": "x" * 801}):
            with self.subTest(payload=payload):
                self.assertEqual(self.client.post("/api/cooking/recipes", json=payload).status_code, 400)
        self.assertEqual(self.client.post("/api/cooking/recipes", data="nope", content_type="text/plain").status_code, 400)
        self.assertEqual(self.client.post("/api/cooking/recipes", data="{bad json", content_type="application/json").status_code, 400)

    def test_recipes_success_and_exclusions_forwarded(self):
        with patch("routes.cooking_routes.generate_json", return_value={"recipes": [{"name": "Omelette"}]}) as mock:
            res = self.client.post("/api/cooking/recipes", json={"ingredients": "eggs", "exclude": ["Dal"], "max_time": "45"})
        self.assertEqual(res.status_code, 200)
        self.assertIn('"Dal"', mock.call_args.args[0])
        self.assertIn("45", mock.call_args.args[0])

    def test_recipes_empty_model_list_is_an_error(self):
        with patch("routes.cooking_routes.generate_json", return_value={"recipes": []}):
            res = self.client.post("/api/cooking/recipes", json={"ingredients": "eggs"})
        self.assertEqual((res.status_code, res.get_json()["error"]["code"]), (502, "bad_response"))

    # --- meal planner ---
    def test_calorie_target_rejects_decimals_instead_of_truncating(self):
        for value in (1999.5, "1999.5", "abc", True, None, 999, 5001, [2000]):
            with self.subTest(value=value):
                res = self.client.post("/api/meals/plan", json={**MEAL_PAYLOAD, "calorie_target": value})
                self.assertEqual(res.status_code, 400)

    def test_calorie_target_accepts_whole_numbers(self):
        for value in (1800, 1800.0, "1800", " 1800 "):
            with self.subTest(value=value), patch("routes.meal_routes.generate_json", return_value={"meals": [{"name": "x"}]}):
                res = self.client.post("/api/meals/plan", json={**MEAL_PAYLOAD, "calorie_target": value})
                self.assertEqual(res.status_code, 200)
                self.assertEqual(res.get_json()["data"]["calorie_target"], 1800)

    def test_meal_plan_validation(self):
        for payload in ({}, {**MEAL_PAYLOAD, "food_preference": "Carnivore"}, {**MEAL_PAYLOAD, "meals_per_day": 9},
                        {**MEAL_PAYLOAD, "allergies": "peanuts"}, {**MEAL_PAYLOAD, "allergies": [1]}):
            with self.subTest(payload=payload):
                self.assertEqual(self.client.post("/api/meals/plan", json=payload).status_code, 400)

    def test_contradictory_constraints_rejected_before_ai_call(self):
        cases = (
            {**MEAL_PAYLOAD, "food_preference": "Non-vegetarian", "diet": "Vegan"},
            {**MEAL_PAYLOAD, "food_preference": "Vegetarian", "diet": "Pescatarian"},
            {**MEAL_PAYLOAD, "allergies": ["Peanuts"], "likes": "rice, peanuts, dal"},
        )
        for payload in cases:
            with self.subTest(payload=payload), patch("routes.meal_routes.generate_json") as mock:
                res = self.client.post("/api/meals/plan", json=payload)
                self.assertEqual(res.status_code, 400)
                mock.assert_not_called()

    def test_meal_totals_computed_server_side_and_allergens_flagged(self):
        fake = {"meals": [
            {"type": "Breakfast", "name": "Peanut butter toast", "calories": 300, "protein_g": 10, "carbs_g": 50, "fat_g": 5},
            {"type": "Lunch", "name": "Dal rice", "calories": 600, "protein_g": 20, "carbs_g": 90, "fat_g": 10, "substitutions": ["Swap rice for quinoa"]},
        ], "totals": {"calories": 99999}}
        with patch("routes.meal_routes.generate_json", return_value=fake):
            res = self.client.post("/api/meals/plan", json={**MEAL_PAYLOAD, "allergies": ["peanut"]})
        data = res.get_json()["data"]
        self.assertEqual(data["totals"]["calories"], 900)
        self.assertEqual(data["allergen_flags"], [{"allergen": "peanut", "meal": "Peanut butter toast"}])

    def test_meal_plan_with_garbage_meal_values(self):
        fake = {"meals": [{"name": "A", "calories": "lots"}, "not a dict", {"name": "B", "calories": 100}]}
        with patch("routes.meal_routes.generate_json", return_value=fake):
            res = self.client.post("/api/meals/plan", json=MEAL_PAYLOAD)
        self.assertEqual(res.get_json()["data"]["totals"]["calories"], 100)

    # --- rate limiting ---
    def test_rate_limit_blocks_post_burst_but_not_health(self):
        with patch.dict(os.environ, {"RATE_LIMIT_PER_MINUTE": "3"}):
            client = create_app().test_client()
        codes = [client.post("/api/cooking/recipes", json={"ingredients": ""}).status_code for _ in range(5)]
        self.assertEqual(codes, [400, 400, 400, 429, 429])
        res = client.post("/api/cooking/recipes", json={"ingredients": ""})
        self.assertIn("Retry-After", res.headers)
        self.assertEqual(client.get("/api/health").status_code, 200)

    def test_rate_limit_ignores_spoofed_forwarded_header(self):
        with patch.dict(os.environ, {"RATE_LIMIT_PER_MINUTE": "2"}):
            client = create_app().test_client()
        codes = [client.post("/api/cooking/recipes", json={}, headers={"X-Forwarded-For": f"9.9.9.{i}"}).status_code for i in range(4)]
        self.assertEqual(codes[-1], 429)


class RateLimiterUnitTests(unittest.TestCase):
    def test_window_expires_and_clients_are_independent(self):
        now = [0.0]
        limiter = RateLimiter(2, 60, clock=lambda: now[0])
        self.assertTrue(limiter.check("a")[0])
        self.assertTrue(limiter.check("a")[0])
        self.assertFalse(limiter.check("a")[0])
        self.assertTrue(limiter.check("b")[0])
        now[0] = 61
        self.assertTrue(limiter.check("a")[0])

    def test_zero_disables(self):
        limiter = RateLimiter(0)
        self.assertTrue(all(limiter.check("a")[0] for _ in range(100)))


class ServiceTests(unittest.TestCase):
    """Exercise generate_json against a stand-in for the google-genai SDK."""

    def fake_sdk(self, outcomes):
        """outcomes: list of response texts or exceptions, consumed one per call."""
        calls = {"n": 0, "client_kwargs": None}

        class Models:
            def generate_content(self, model, contents, config):
                calls.update(model=model, contents=contents, config=config)
                outcome = outcomes[min(calls["n"], len(outcomes) - 1)]
                calls["n"] += 1
                if isinstance(outcome, Exception):
                    raise outcome
                if isinstance(outcome, types.SimpleNamespace):
                    return outcome
                return types.SimpleNamespace(text=outcome)

        class Client:
            def __init__(self, api_key, http_options=None):
                calls["api_key"], calls["http_options"] = api_key, http_options
                self.models = Models()

        genai = types.ModuleType("google.genai")
        genai.Client = Client
        sdk_types = types.ModuleType("google.genai.types")
        sdk_types.Part = types.SimpleNamespace(from_bytes=lambda data, mime_type: ("part", mime_type, len(data)))
        sdk_types.GenerateContentConfig = lambda **kw: kw
        sdk_types.HttpOptions = lambda **kw: kw
        genai.types = sdk_types
        google = types.ModuleType("google")
        google.genai = genai
        modules = {"google": google, "google.genai": genai, "google.genai.types": sdk_types}
        return calls, patch.dict(sys.modules, modules)

    @staticmethod
    def sdk_error(code, message="boom"):
        err = Exception(message)
        err.code = code
        return err

    def run_service(self, outcomes, env=None, **kwargs):
        calls, sdk = self.fake_sdk(outcomes)
        environ = {"GEMINI_API_KEY": "test-key", **(env or {})}
        with sdk, patch.dict(os.environ, environ), patch.object(gemini_service, "_sleep") as sleep:
            try:
                result = gemini_service.generate_json("prompt", **kwargs)
            except Exception as exc:
                return calls, sleep, exc
        return calls, sleep, result

    def test_calls_gemini_with_image_timeout_and_parses_fenced_json(self):
        calls, _, result = self.run_service(
            ["```json\n" + json.dumps(FOOD_JSON) + "\n```"],
            env={"GEMINI_MODEL": "test-model", "GEMINI_TIMEOUT_SECONDS": "30"},
            image=(PNG, "image/png"), required_keys=("calories",),
        )
        self.assertEqual(result["calories"], 420)
        self.assertEqual(calls["model"], "test-model")
        self.assertEqual(calls["api_key"], "test-key")
        self.assertEqual(calls["http_options"], {"timeout": 30000})
        self.assertEqual(calls["contents"][0][0], "part")
        self.assertEqual(calls["config"]["response_mime_type"], "application/json")

    def test_transient_error_retried_once_then_succeeds(self):
        calls, sleep, result = self.run_service([self.sdk_error(503), '{"ok": true}'])
        self.assertEqual(result, {"ok": True})
        self.assertEqual(calls["n"], 2)
        sleep.assert_called_once()

    def test_transient_error_gives_up_after_one_retry(self):
        calls, _, result = self.run_service([self.sdk_error(503)])
        self.assertIsInstance(result, GeminiServiceError)
        self.assertEqual(calls["n"], 2)

    def test_non_transient_errors_are_not_retried(self):
        for code, expected in ((401, "ai_rejected"), (400, "ai_rejected"), (429, "rate_limited"), (404, "model_not_found")):
            with self.subTest(code=code):
                calls, _, result = self.run_service([self.sdk_error(code)])
                self.assertEqual(calls["n"], 1)
                self.assertEqual(result.code, expected)

    def test_timeout_maps_to_504_without_retry(self):
        class ReadTimeout(Exception):
            pass
        calls, _, result = self.run_service([ReadTimeout("slow")])
        self.assertEqual((calls["n"], result.status, result.code), (1, 504, "ai_timeout"))

    def test_safety_block_reported_clearly(self):
        blocked = types.SimpleNamespace(text=None, prompt_feedback=types.SimpleNamespace(block_reason="SAFETY"))
        _, _, result = self.run_service([blocked])
        self.assertEqual(result.code, "ai_blocked")

    def test_empty_and_malformed_outputs_raise(self):
        for text, code in ((None, "empty_response"), ("", "empty_response"), ("not json", "bad_response"), ("[1, 2]", "bad_response")):
            with self.subTest(text=text):
                _, _, result = self.run_service([text])
                self.assertEqual(result.code, code)

    def test_missing_required_key(self):
        _, _, result = self.run_service(['{"a": 1}'], required_keys=("b",))
        self.assertEqual(result.code, "bad_response")

    def test_error_messages_never_leak_key(self):
        _, _, result = self.run_service([self.sdk_error(403, "bad key test-key")])
        self.assertNotIn("test-key", result.message)

    def test_missing_key_raises_config_error(self):
        _, _, result = self.run_service(['{}'], env={"GEMINI_API_KEY": ""})
        self.assertIsInstance(result, gemini_service.GeminiConfigError)

    def test_placeholder_key_counts_as_missing(self):
        with patch.dict(os.environ, {"GEMINI_API_KEY": "your-gemini-api-key-here"}):
            self.assertFalse(gemini_service.is_configured())

    def test_invalid_timeout_env_falls_back(self):
        with patch.dict(os.environ, {"GEMINI_TIMEOUT_SECONDS": "abc"}):
            self.assertEqual(gemini_service.get_timeout_seconds(), 60.0)


if __name__ == "__main__":
    unittest.main()
