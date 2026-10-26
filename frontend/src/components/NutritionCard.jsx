import { round } from '../utils/format.js';

// share is the percentage (0-100) of the meal's calories that come from this nutrient.
export default function NutritionCard({ label, value, unit = 'g', share }) {
  const width = Number.isFinite(share) ? Math.max(4, Math.min(100, share)) : 0;
  return (
    <div className="nutrition-card">
      <span className="muted small">{label}</span>
      <strong>
        {round(value)}
        <small>{unit}</small>
      </strong>
      {Number.isFinite(share) && (
        <>
          <div className="meter" aria-hidden="true">
            <span style={{ width: `${width}%` }} />
          </div>
          <span className="muted small">{Math.round(share)}% of calories</span>
        </>
      )}
    </div>
  );
}
