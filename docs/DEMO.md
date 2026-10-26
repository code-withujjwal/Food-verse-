# Demo checklist (about 6 minutes)

**Before:** backend and frontend running; header chip reads "Gemini configured". Have ready: a clear meal photo, a photo of a fruit or vegetable (ideally slightly bruised), a kitchen photo. Run `python live_check.py --all --food <img> --freshness <img> --kitchen <img>` once beforehand; all steps should say PASS.

1. **Dashboard:** state the idea; point at the header status chip (live backend + Gemini config).
2. **Food Scanner:** upload the meal photo, Analyze. Show calories, macro bars, serving assumptions, the "Estimates only" notice.
3. **Freshness Check:** upload the produce photo. Show visible observations, the cautious verdict, and the "not a food safety test" banner.
4. **Kitchen Review:** upload the kitchen photo. Show observed vs possible concerns and the tickable checklist.
5. **Cooking Assistant:** enter ingredients, Vegetarian, 30 min. Show recipes, then **Show different recipes**.
6. **Meal Planner:** Vegetarian, 1800 kcal, 4 meals, allergy "peanuts". Show daily totals (computed by the server), the allergy warning, and the estimate disclaimer.
7. **Resilience (optional):** submit 1999.5 kcal (rejected, no silent rounding); upload a .txt renamed to .png (rejected); stop Flask and click Analyze (clear "cannot reach server" message).
8. **Dashboard:** show Recent activity (stored in the browser only).

If an AI step fails live, show the error message: that is deliberate behavior, results are never faked.
