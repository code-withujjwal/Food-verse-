import { useState } from 'react';
import { ClipboardList, ShieldCheck } from 'lucide-react';
import { analyzeKitchen } from '../api/client.js';
import useAnalysis from '../hooks/useAnalysis.js';
import { addHistory } from '../utils/history.js';
import { asList } from '../utils/format.js';
import PageHeader from '../components/PageHeader.jsx';
import ImageUploader from '../components/ImageUploader.jsx';
import LoadingState from '../components/LoadingState.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Notice from '../components/Notice.jsx';

const RISK = {
  low: { label: 'Few visible issues', tone: 'good' },
  moderate: { label: 'Some visible issues', tone: 'warn' },
  high: { label: 'Several visible issues', tone: 'bad' },
  unclear: { label: 'Unclear from this photo', tone: 'neutral' },
};

export default function KitchenAnalyzer() {
  const [file, setFile] = useState(null);
  const { data, error, loading, status, run, reset } = useAnalysis();

  async function analyze() {
    const result = await run(() => analyzeKitchen(file));
    if (result?.is_kitchen) {
      addHistory({ module: 'Kitchen Review', title: (RISK[result.risk_level] || RISK.unclear).label, to: '/kitchen' });
    }
  }

  const risk = RISK[data?.risk_level] || RISK.unclear;

  return (
    <div className="stack-lg">
      <PageHeader icon={ShieldCheck} title="Kitchen Review">
        Upload a photo of a kitchen or prep area to get visible hygiene observations and a cleanup checklist.
      </PageHeader>

      <Notice tone="warn" title="Not a hygiene certification">
        A photo can’t show germs, temperatures or cleaning routines. This review only covers what is visible.
      </Notice>

      <div className="split">
        <section className="card stack" aria-label="Upload">
          <ImageUploader
            file={file}
            disabled={loading}
            sample="/test-assets/kitchen.jpg"
            sampleName="sample-kitchen.jpg"
            onChange={(f) => {
              setFile(f);
              reset();
            }}
            hint="Show work surfaces, storage and equipment in one frame"
          />
          <button type="button" className="btn btn-primary" disabled={!file || loading} onClick={analyze}>
            {loading ? 'Reviewing…' : 'Review kitchen'}
          </button>
        </section>

        <section className="stack" aria-live="polite">
          {status === 'idle' && (
            <EmptyState icon={ClipboardList} title="Your review will appear here">
              Choose a photo, then select Review kitchen.
            </EmptyState>
          )}
          {loading && <LoadingState message="Checking surfaces, storage and handling…" />}
          {status === 'error' && <ErrorMessage message={error} onRetry={file ? analyze : undefined} />}

          {status === 'success' && data && !data.is_kitchen && (
            <Notice tone="warn" title="No kitchen detected">
              {data.summary || 'This doesn’t look like a kitchen or food-prep area. Try a different photo.'}
            </Notice>
          )}

          {status === 'success' && data?.is_kitchen && (
            <>
              <div className={`card verdict verdict-${risk.tone}`}>
                <span className="muted small">Based on visible evidence only</span>
                <strong>{risk.label}</strong>
                {data.summary && <p>{data.summary}</p>}
              </div>

              <div className="two-col">
                <div className="card stack">
                  <h2>Observed in the photo</h2>
                  {asList(data.observed_evidence).length ? (
                    <ul className="bullets">
                      {asList(data.observed_evidence).map((o, i) => (
                        <li key={i}>{o}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">Nothing specific was noted.</p>
                  )}
                </div>
                <div className="card stack">
                  <h2>Possible concerns</h2>
                  {asList(data.possible_concerns).length ? (
                    <ul className="bullets">
                      {asList(data.possible_concerns).map((o, i) => (
                        <li key={i}>{o}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">No concerns were raised.</p>
                  )}
                </div>
              </div>

              <div className="card stack">
                <h2>Improvement checklist</h2>
                <ul className="checklist">
                  {asList(data.checklist).map((o, i) => (
                    <li key={i}>
                      <label>
                        <input type="checkbox" /> <span>{o}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
              {data.limitations && <Notice title="Limits of this review">{data.limitations}</Notice>}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
