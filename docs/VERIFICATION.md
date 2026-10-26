# Verification status

Recorded from an offline development sandbox (Python 3.12, Node 22, no internet, no Gemini key). Anything not listed as RUN has not been verified.

| Check | Result |
|---|---|
| Backend unit tests (`python -m unittest discover -s tests`) | **RUN: 38 passed, 0 failed.** Baseline before changes: 17 passed. Gemini mocked. In the sandbox `flask-cors` and `python-dotenv` could not be installed, so minimal stand-ins were used; CORS headers and `.env` loading were not exercised. |
| Live HTTP smoke test of the Flask server (health, missing file, missing key, bad input) | **RUN** earlier in the sandbox against the running server (before the hardening pass); the same behaviors are covered by the unit tests now. |
| Frontend JS/JSX syntax | **RUN:** 0 syntax errors (TypeScript parser). This is not a build. |
| Stricter frontend static check (undefined names, unused imports, bad local imports) | **RUN:** none found. Remaining tsc messages are only missing React type definitions and CSS imports, which need `npm install`. |
| `verify.ps1` | **Written but NOT RUN** (no PowerShell in the sandbox). |
| Frontend/backend route contract | **RUN:** all 6 frontend URLs match Flask routes. |
| Secret scan of the source tree | **RUN:** no key-like strings, no `.env`, no secrets in `VITE_` variables. |
| `live_check.py` | Logic **RUN against a simulated SDK only**. Reports BLOCKED correctly without SDK/key. **Not run against real Gemini.** |
| `npm install` / `npm run build` | **NOT RUN** (no network). |
| Live Gemini calls for any feature | **NOT RUN.** The `google-genai` call shapes (`HttpOptions(timeout=ms)`, `Part.from_bytes`, `GenerateContentConfig`) are written from documentation knowledge and mocked in tests; confirm with `live_check.py`. |
| Browser/end-to-end testing, responsive layout, accessibility audit | **NOT RUN.** |
| Frontend unit tests | **Not configured.** |

## Defects found and fixed in this pass (each has a regression test)
1. Flask debugger was hard-coded on. Now off unless `FLASK_DEBUG=1`.
2. No Gemini timeout. Now configurable (default 60 s); the frontend also aborts after 100 s.
3. No retry policy. Now one retry for 500/502/503/504 only; auth, bad request, quota and timeout errors are never retried.
4. No rate limiting on AI endpoints. Added per-client in-memory limit (default 10 POST/min), proxy headers ignored unless configured.
5. Calorie target (and other integers) silently truncated decimals (2000.9 became 2000). Now rejected.
6. Corrupted or truncated images passed validation. Added structural checks for PNG/JPEG/WebP.
7. Contradictory meal-plan inputs (for example Non-vegetarian + Vegan, or an allergen listed as a liked food) were sent to the AI. Now rejected with a clear message.
8. Meal plans could mention a listed allergen unnoticed. Now flagged to the user.
9. Safety-blocked Gemini responses gave a vague "empty response". Now a specific `ai_blocked` error.
10. Duplicate submissions (repeated Enter) could fire two AI requests. Now ignored while one is in flight.
11. Health endpoint did not show whether the SDK was installed. Now it does, still without calling Gemini.
