import { useState } from 'react';
import { ChefHat, Clock, RefreshCw, Soup } from 'lucide-react';
import { generateRecipes } from '../api/client.js';
import useAnalysis from '../hooks/useAnalysis.js';
import { addHistory } from '../utils/history.js';
import { asList, round } from '../utils/format.js';
import { DIETS, DIFFICULTIES } from '../constants.js';
import PageHeader from '../components/PageHeader.jsx';
import LoadingState from '../components/LoadingState.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import EmptyState from '../components/EmptyState.jsx';

const TIMES = [15, 30, 45, 60, 90];

export default function CookingAssistant() {
  const [form, setForm] = useState({ ingredients: '', cuisine: '', diet: 'No preference', max_time: 30, difficulty: 'Easy' });
  const [formError, setFormError] = useState('');
  const [seen, setSeen] = useState([]);
  const { data, error, loading, status, run } = useAnalysis();

  const update = (field) => (event) => setForm((f) => ({ ...f, [field]: event.target.value }));

  async function generate(exclude) {
    const result = await run(() => generateRecipes({ ...form, max_time: Number(form.max_time), exclude }));
    const names = asList((result?.recipes || []).map((r) => r?.name));
    if (names.length) {
      setSeen([...exclude, ...names].slice(-12));
      addHistory({ module: 'Cooking Assistant', title: names[0], to: '/cooking' });
    }
  }

  function onSubmit(event) {
    event.preventDefault();
    if (!form.ingredients.trim()) {
      setFormError('List at least one ingredient you have.');
      return;
    }
    setFormError('');
    generate([]);
  }

  const recipes = Array.isArray(data?.recipes) ? data.recipes.filter((r) => r && r.name) : [];

  return (
    <div className="stack-lg">
      <PageHeader icon={ChefHat} title="Cooking Assistant">
        Tell us what’s in your kitchen and we’ll suggest recipes that fit your time, diet and skill level.
      </PageHeader>

      <div className="split">
        <form className="card stack" onSubmit={onSubmit} noValidate>
          <label className="field">
            <span>Ingredients you have</span>
            <textarea
              rows={4}
              value={form.ingredients}
              onChange={update('ingredients')}
              placeholder="e.g. paneer, spinach, tomatoes, rice, onion"
              maxLength={800}
              aria-invalid={Boolean(formError)}
            />
            {formError && (
              <span className="field-error" role="alert">
                {formError}
              </span>
            )}
          </label>
          <label className="field">
            <span>Cuisine (optional)</span>
            <input type="text" value={form.cuisine} onChange={update('cuisine')} placeholder="e.g. North Indian, Italian" maxLength={60} />
          </label>
          <div className="form-row">
            <label className="field">
              <span>Diet</span>
              <select value={form.diet} onChange={update('diet')}>
                {DIETS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Time available</span>
              <select value={form.max_time} onChange={update('max_time')}>
                {TIMES.map((t) => (
                  <option key={t} value={t}>
                    {t} minutes
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            <span>Difficulty</span>
            <select value={form.difficulty} onChange={update('difficulty')}>
              {DIFFICULTIES.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Finding recipes…' : 'Suggest recipes'}
          </button>
        </form>

        <section className="stack" aria-live="polite">
          {status === 'idle' && (
            <EmptyState icon={Soup} title="No recipes yet">
              Add the ingredients you have on hand. Basic pantry items like salt, oil and spices are assumed.
            </EmptyState>
          )}
          {loading && <LoadingState message="Cooking up ideas from your ingredients…" />}
          {status === 'error' && <ErrorMessage message={error} onRetry={() => generate(seen)} />}

          {status === 'success' && (
            <>
              {recipes.map((recipe, index) => (
                <article className="card recipe stack" key={`${recipe.name}-${index}`}>
                  <div>
                    <h2>{recipe.name}</h2>
                    {recipe.description && <p className="muted">{recipe.description}</p>}
                  </div>
                  <div className="meta-row">
                    <span>
                      <Clock size={16} aria-hidden="true" /> {round(recipe.prep_time_minutes)} min
                    </span>
                    <span className="pill">{recipe.difficulty || form.difficulty}</span>
                  </div>
                  <div className="two-col">
                    <div>
                      <h3>Ingredients</h3>
                      <ul className="bullets">
                        {(Array.isArray(recipe.ingredients) ? recipe.ingredients : []).map((ing, i) => (
                          <li key={i}>{typeof ing === 'string' ? ing : `${ing?.quantity || ''} ${ing?.item || ''}`.trim()}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h3>Steps</h3>
                      <ol className="steps">
                        {asList(recipe.steps).map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ol>
                    </div>
                  </div>
                  {(asList(recipe.substitutions).length > 0 || asList(recipe.tips).length > 0) && (
                    <div className="tips">
                      <h3>Swaps and tips</h3>
                      <ul className="bullets">
                        {[...asList(recipe.substitutions), ...asList(recipe.tips)].map((t, i) => (
                          <li key={i}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </article>
              ))}
              {recipes.length === 0 && <EmptyState icon={Soup} title="No usable recipes came back">Try again, or add a few more ingredients.</EmptyState>}
              <button type="button" className="btn btn-ghost" onClick={() => generate(seen)} disabled={loading}>
                <RefreshCw size={16} aria-hidden="true" /> Show different recipes
              </button>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
