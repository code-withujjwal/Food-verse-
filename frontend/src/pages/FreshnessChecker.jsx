import { useState } from 'react';
import { Eye, Leaf } from 'lucide-react';
import { checkFreshness } from '../api/client.js';
import useAnalysis from '../hooks/useAnalysis.js';
import { addHistory } from '../utils/history.js';
import { asList } from '../utils/format.js';
import PageHeader from '../components/PageHeader.jsx';
import ImageUploader from '../components/ImageUploader.jsx';
import LoadingState from '../components/LoadingState.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Notice from '../components/Notice.jsx';

const CONDITIONS = {
  appears_fresh: { label: 'Appears fresh', tone: 'good' },
  some_concerns: { label: 'Some concerns', tone: 'warn' },
  visible_spoilage: { label: 'Visible spoilage', tone: 'bad' },
  unclear: { label: 'Unclear from this photo', tone: 'neutral' },
};

export default function FreshnessChecker() {
  const [file, setFile] = useState(null);
  const { data, error, loading, status, run, reset } = useAnalysis();

  async function analyze() {
    const result = await run(() => checkFreshness(file));
    if (result) {
      const label = (CONDITIONS[result.condition] || CONDITIONS.unclear).label;
      addHistory({ module: 'Freshness Check', title: `${result.food_identified || 'Food'} · ${label}`, to: '/freshness' });
    }
  }

  const condition = CONDITIONS[data?.condition] || CONDITIONS.unclear;
  const unclear = data && (data.image_clear === false || data.condition === 'unclear');

  return (
    <div className="stack-lg">
      <PageHeader icon={Leaf} title="Freshness Check">
        Upload a photo of fruit, vegetables or other food to screen for visible signs of spoilage.
      </PageHeader>

      <Notice tone="warn" title="This is not a food safety test">
        A photo can’t show smell, texture, storage time or bacteria. If you’re unsure, don’t eat it.
      </Notice>

      <div className="split">
        <section className="card stack" aria-label="Upload">
          <ImageUploader
            file={file}
            disabled={loading}
            onChange={(f) => {
              setFile(f);
              reset();
            }}
            hint="Photograph the food up close in good light"
          />
          <button type="button" className="btn btn-primary" disabled={!file || loading} onClick={analyze}>
            {loading ? 'Screening…' : 'Check freshness'}
          </button>
        </section>

        <section className="stack" aria-live="polite">
          {status === 'idle' && (
            <EmptyState icon={Eye} title="Visible observations will appear here">
              Choose a photo, then select Check freshness.
            </EmptyState>
          )}
          {loading && <LoadingState message="Looking for visible signs of spoilage…" />}
          {status === 'error' && <ErrorMessage message={error} onRetry={file ? analyze : undefined} />}

          {status === 'success' && data && (
            <>
              <div className={`card verdict verdict-${condition.tone}`}>
                <span className="muted small">{data.food_identified && data.food_identified !== 'Unclear' ? data.food_identified : 'Food not identified'}</span>
                <strong>{condition.label}</strong>
                {data.condition_summary && <p>{data.condition_summary}</p>}
              </div>

              {unclear && (
                <Notice tone="warn" title="Limited confidence">
                  The image may be too unclear for a reliable screening. Try a closer, brighter photo.
                </Notice>
              )}

              {asList(data.observations).length > 0 && (
                <div className="card stack">
                  <h2>Visible observations</h2>
                  <ul className="bullets">
                    {asList(data.observations).map((o, i) => (
                      <li key={i}>{o}</li>
                    ))}
                  </ul>
                </div>
              )}

              {data.uncertainty_note && (
                <Notice title="What this can’t tell you">{data.uncertainty_note}</Notice>
              )}

              {asList(data.next_steps).length > 0 && (
                <div className="card stack">
                  <h2>Next steps</h2>
                  <ul className="bullets">
                    {asList(data.next_steps).map((o, i) => (
                      <li key={i}>{o}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
