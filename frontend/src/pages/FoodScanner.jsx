import { useState } from 'react';
import { Camera, Flame, Utensils } from 'lucide-react';
import { analyzeFood } from '../api/client.js';
import useAnalysis from '../hooks/useAnalysis.js';
import { addHistory } from '../utils/history.js';
import { asList, round } from '../utils/format.js';
import PageHeader from '../components/PageHeader.jsx';
import ImageUploader from '../components/ImageUploader.jsx';
import LoadingState from '../components/LoadingState.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Notice from '../components/Notice.jsx';
import NutritionCard from '../components/NutritionCard.jsx';

export default function FoodScanner() {
  const [file, setFile] = useState(null);
  const { data, error, loading, status, run, reset } = useAnalysis();

  async function analyze() {
    const result = await run(() => analyzeFood(file));
    if (result?.is_food) {
      const names = (result.items || []).map((i) => i.name).filter(Boolean).join(', ');
      addHistory({ module: 'Food Scanner', title: `${names || 'Meal'} · about ${round(result.calories)} kcal`, to: '/scanner' });
    }
  }

  const protein = Number(data?.protein_g) || 0;
  const carbs = Number(data?.carbs_g) || 0;
  const fat = Number(data?.fat_g) || 0;
  const macroCalories = protein * 4 + carbs * 4 + fat * 9 || 1;

  return (
    <div className="stack-lg">
      <PageHeader icon={Camera} title="Food Scanner">
        Upload a photo of a meal to see what Gemini recognizes and a rough nutrition estimate.
      </PageHeader>

      <div className="split">
        <section className="card stack" aria-label="Upload">
          <ImageUploader
            file={file}
            disabled={loading}
            sample="/test-assets/food-scan.jpg"
            sampleName="grilled-chicken-meal.jpg"
            onChange={(f) => {
              setFile(f);
              reset();
            }}
            hint="A clear, well-lit photo from above works best"
          />
          <button type="button" className="btn btn-primary" disabled={!file || loading} onClick={analyze}>
            {loading ? 'Analyzing…' : 'Analyze food'}
          </button>
        </section>

        <section className="stack" aria-live="polite">
          {status === 'idle' && (
            <EmptyState icon={Utensils} title="Your analysis will appear here">
              Choose a photo, then select Analyze food.
            </EmptyState>
          )}
          {loading && <LoadingState message="Identifying food and estimating nutrition…" />}
          {status === 'error' && <ErrorMessage message={error} onRetry={file ? analyze : undefined} />}

          {status === 'success' && data && !data.is_food && (
            <Notice tone="warn" title="No food detected">
              {data.summary || 'Gemini could not find food in this image. Try a clearer photo of the meal.'}
            </Notice>
          )}

          {status === 'success' && data?.is_food && (
            <>
              <div className="card calorie-card">
                <Flame size={26} aria-hidden="true" />
                <div>
                  <span className="muted small">Estimated energy</span>
                  <strong className="calorie-number">
                    {round(data.calories)} <small>kcal</small>
                  </strong>
                </div>
              </div>
              <div className="nutrition-grid">
                <NutritionCard label="Protein" value={data.protein_g} share={(protein * 4 * 100) / macroCalories} />
                <NutritionCard label="Carbohydrates" value={data.carbs_g} share={(carbs * 4 * 100) / macroCalories} />
                <NutritionCard label="Fat" value={data.fat_g} share={(fat * 9 * 100) / macroCalories} />
              </div>

              <div className="card stack">
                <h2>What Gemini sees</h2>
                {data.description && <p>{data.description}</p>}
                {asList((data.items || []).map((i) => (i?.name ? `${i.name}${i.estimated_portion ? ` – ${i.estimated_portion}` : ''}` : ''))).length > 0 && (
                  <ul className="tag-list">
                    {(data.items || []).filter((i) => i?.name).map((item, idx) => (
                      <li key={idx}>
                        {item.name}
                        {item.estimated_portion && <span className="muted"> · {item.estimated_portion}</span>}
                      </li>
                    ))}
                  </ul>
                )}
                {data.serving_assumptions && (
                  <p>
                    <strong>Serving assumptions: </strong>
                    {data.serving_assumptions}
                  </p>
                )}
                {asList(data.observations).length > 0 && (
                  <ul className="bullets">
                    {asList(data.observations).map((o, i) => (
                      <li key={i}>{o}</li>
                    ))}
                  </ul>
                )}
                {data.summary && (
                  <p>
                    <strong>Summary: </strong>
                    {data.summary}
                  </p>
                )}
              </div>
              <Notice title="Estimates only">
                {data.confidence_note ? `${data.confidence_note} ` : ''}
                Photos can’t show hidden ingredients, oil, or exact portions, so treat these numbers as rough guidance, not measured values.
              </Notice>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
