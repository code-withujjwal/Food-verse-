import { useState } from 'react';
import { CalendarDays, Sunrise } from 'lucide-react';
import { planMeals } from '../api/client.js';
import useAnalysis from '../hooks/useAnalysis.js';
import { addHistory } from '../utils/history.js';
import { asList, round } from '../utils/format.js';
import { DIETS } from '../constants.js';
import PageHeader from '../components/PageHeader.jsx';
import LoadingState from '../components/LoadingState.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Notice from '../components/Notice.jsx';
import NutritionCard from '../components/NutritionCard.jsx';

export default function MealPlanner() {
  const [form, setForm] = useState({
    diet: 'No preference',
    food_preference: 'Vegetarian',
    likes: '',
    dislikes: '',
    allergies: '',
    calorie_target: 2000,
    meals_per_day: 4,
  });
  const [errors, setErrors] = useState({});
  const { data, error, loading, status, run } = useAnalysis();

  const update = (field) => (event) => setForm((f) => ({ ...f, [field]: event.target.value }));

  function validate() {
    const found = {};
    const calories = Number(form.calorie_target);
    if (!Number.isInteger(calories) || calories < 1000 || calories > 5000) found.calorie_target = 'Enter a daily target between 1000 and 5000 kcal.';
    return found;
  }

  async function submit(event) {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;
    const payload = {
      ...form,
      calorie_target: Number(form.calorie_target),
      meals_per_day: Number(form.meals_per_day),
      allergies: form.allergies.split(',').map((a) => a.trim()).filter(Boolean),
    };
    const result = await run(() => planMeals(payload));
    if (result) addHistory({ module: 'Meal Planner', title: `${payload.meals_per_day} meals · about ${round(result.totals?.calories)} kcal`, to: '/planner' });
  }

  const meals = Array.isArray(data?.meals) ? data.meals : [];
  const totals = data?.totals || {};
  const hasAllergies = asList(data?.allergies).length > 0;
  const protein = Number(totals.protein_g) || 0;
  const carbs = Number(totals.carbs_g) || 0;
  const fat = Number(totals.fat_g) || 0;
  const macroCalories = protein * 4 + carbs * 4 + fat * 9 || 1;

  return (
    <div className="stack-lg">
      <PageHeader icon={CalendarDays} title="Meal Planner">
        Build a one-day plan around your calorie target and the foods you like.
      </PageHeader>

      <div className="split">
        <form className="card stack" onSubmit={submit} noValidate>
          <div className="form-row">
            <label className="field">
              <span>Food preference</span>
              <select value={form.food_preference} onChange={update('food_preference')}>
                <option>Vegetarian</option>
                <option>Non-vegetarian</option>
              </select>
            </label>
            <label className="field">
              <span>Diet style</span>
              <select value={form.diet} onChange={update('diet')}>
                {DIETS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-row">
            <label className="field">
              <span>Daily calories (kcal)</span>
              <input type="number" min="1000" max="5000" step="50" value={form.calorie_target} onChange={update('calorie_target')} aria-invalid={Boolean(errors.calorie_target)} />
              {errors.calorie_target && (
                <span className="field-error" role="alert">
                  {errors.calorie_target}
                </span>
              )}
            </label>
            <label className="field">
              <span>Meals per day</span>
              <select value={form.meals_per_day} onChange={update('meals_per_day')}>
                {[2, 3, 4, 5, 6].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            <span>Foods you enjoy (optional)</span>
            <input type="text" value={form.likes} onChange={update('likes')} placeholder="e.g. lentils, paneer, berries" maxLength={300} />
          </label>
          <label className="field">
            <span>Foods to avoid (optional)</span>
            <input type="text" value={form.dislikes} onChange={update('dislikes')} placeholder="e.g. mushrooms, bitter gourd" maxLength={300} />
          </label>
          <label className="field">
            <span>Allergies or restrictions (optional)</span>
            <input type="text" value={form.allergies} onChange={update('allergies')} placeholder="Separate with commas, e.g. peanuts, shellfish" />
          </label>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Planning…' : 'Plan my day'}
          </button>
        </form>

        <section className="stack" aria-live="polite">
          {status === 'idle' && (
            <EmptyState icon={Sunrise} title="Your plan will appear here">
              Set your calorie target and preferences, then select Plan my day.
            </EmptyState>
          )}
          {loading && <LoadingState message="Balancing meals around your target…" />}
          {status === 'error' && <ErrorMessage message={error} onRetry={() => submit({ preventDefault() {} })} />}

          {status === 'success' && data && (
            <>
              {hasAllergies && (
                <Notice tone="warn" title={`Allergies listed: ${asList(data.allergies).join(', ')}`}>
                  {data.allergy_notice || 'Always check ingredient labels and cross-contamination warnings before eating.'} AI suggestions can miss hidden allergens.
                </Notice>
              )}

              {Array.isArray(data.allergen_flags) && data.allergen_flags.length > 0 && (
                <Notice tone="warn" title="Possible allergen mentioned in the plan">
                  {data.allergen_flags.map((f) => `${f.allergen} appears in “${f.meal}”`).join('; ')}. Do not eat these meals without checking ingredients, and consider generating a new plan.
                </Notice>
              )}

              <div className="card stack">
                <div className="card-head">
                  <h2>Daily total (estimate)</h2>
                  <span className="muted small">Target {data.calorie_target} kcal</span>
                </div>
                <p className="calorie-number">
                  {round(totals.calories)} <small>kcal</small>
                </p>
                <div className="nutrition-grid">
                  <NutritionCard label="Protein" value={protein} share={(protein * 4 * 100) / macroCalories} />
                  <NutritionCard label="Carbohydrates" value={carbs} share={(carbs * 4 * 100) / macroCalories} />
                  <NutritionCard label="Fat" value={fat} share={(fat * 9 * 100) / macroCalories} />
                </div>
              </div>

              <div className="meal-list">
                {meals.map((meal, i) => (
                  <article className="card meal" key={i}>
                    <span className="pill">{meal.type || `Meal ${i + 1}`}</span>
                    <h3>{meal.name || 'Unnamed meal'}</h3>
                    {meal.portion && <p className="muted">{meal.portion}</p>}
                    <p className="meal-macros">
                      <strong>{round(meal.calories)} kcal</strong>
                      <span>P {round(meal.protein_g)} g</span>
                      <span>C {round(meal.carbs_g)} g</span>
                      <span>F {round(meal.fat_g)} g</span>
                    </p>
                    {asList(meal.substitutions).length > 0 && (
                      <ul className="bullets small">
                        {asList(meal.substitutions).map((s, j) => (
                          <li key={j}>Swap: {s}</li>
                        ))}
                      </ul>
                    )}
                  </article>
                ))}
              </div>

              {asList(data.notes).length > 0 && (
                <div className="card stack">
                  <h2>Notes</h2>
                  <ul className="bullets">
                    {asList(data.notes).map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                </div>
              )}
              <Notice title="Estimates, not medical advice">
                Portions and nutrition values are approximate. This plan is general food guidance and isn’t a substitute for a dietitian or doctor, especially if you manage a health condition.
              </Notice>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
