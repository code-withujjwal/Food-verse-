import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Camera, ChefHat, Leaf, ShieldCheck, Trash2 } from 'lucide-react';
import { clearHistory, getHistory } from '../utils/history.js';
import { timeAgo } from '../utils/format.js';
import EmptyState from '../components/EmptyState.jsx';

function PlateArt() {
  return (
    <svg className="plate-art" viewBox="0 0 320 320" role="img" aria-label="Illustration of a plate with avocado, tomato and leaves">
      <circle cx="160" cy="160" r="150" fill="#f3f1e7" />
      <circle cx="160" cy="160" r="118" fill="none" stroke="#dcd8c6" strokeWidth="3" />
      <ellipse cx="120" cy="150" rx="54" ry="68" fill="#2f6b4a" transform="rotate(-20 120 150)" />
      <ellipse cx="124" cy="154" rx="42" ry="55" fill="#b8d84a" transform="rotate(-20 124 154)" />
      <circle cx="128" cy="164" r="19" fill="#8a5a2b" />
      <circle cx="222" cy="120" r="34" fill="#d9543d" />
      <circle cx="222" cy="120" r="24" fill="#ea7a60" />
      <circle cx="214" cy="212" r="30" fill="#d9543d" />
      <circle cx="214" cy="212" r="20" fill="#ea7a60" />
      <path d="M86 236c14-30 44-40 70-30-6 28-34 44-70 30z" fill="#a9bfa0" />
      <path d="M150 74c20-6 38 4 44 22-20 6-38-2-44-22z" fill="#2f6b4a" />
    </svg>
  );
}

const MODULES = [
  { to: '/scanner', icon: Camera, title: 'Food Scanner', text: 'Photograph a meal and get estimated calories, protein, carbs and fat, with the assumptions spelled out.', featured: true },
  { to: '/freshness', icon: Leaf, title: 'Freshness Check', text: 'Screen fruit, vegetables and leftovers for visible signs of spoilage.' },
  { to: '/kitchen', icon: ShieldCheck, title: 'Kitchen Review', text: 'Spot visible hygiene and handling issues in a prep area.' },
  { to: '/cooking', icon: ChefHat, title: 'Cooking Assistant', text: 'Turn the ingredients you have into recipes that fit your time and diet.' },
  { to: '/planner', icon: CalendarDays, title: 'Meal Planner', text: 'Build a one-day plan around your calorie target and food preferences.' },
];

export default function Dashboard() {
  const [history, setHistory] = useState(getHistory);

  return (
    <div className="stack-lg">
      <section className="hero">
        <div className="hero-copy">
          <h1>Know what’s on your plate before you eat it.</h1>
          <p>
            Food Verse AI reads photos of meals, produce and kitchens, then helps you decide what to cook next. Every result is an estimate from
            Gemini, and we tell you where it could be wrong.
          </p>
          <div className="row">
            <Link to="/scanner" className="btn btn-lime">
              <Camera size={18} aria-hidden="true" /> Scan a meal
            </Link>
            <Link to="/cooking" className="btn btn-outline-light">
              <ChefHat size={18} aria-hidden="true" /> What can I cook?
            </Link>
          </div>
        </div>
        <PlateArt />
      </section>

      <section aria-labelledby="modules-title">
        <h2 id="modules-title">Choose a tool</h2>
        <div className="module-grid">
          {MODULES.map(({ to, icon: Icon, title, text, featured }) => (
            <Link key={to} to={to} className={`module${featured ? ' module-featured' : ''}`}>
              <span className="module-icon">
                <Icon size={featured ? 28 : 22} aria-hidden="true" />
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="card" aria-labelledby="recent-title">
        <div className="card-head">
          <h2 id="recent-title">Recent activity</h2>
          {history.length > 0 && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                clearHistory();
                setHistory([]);
              }}
            >
              <Trash2 size={15} aria-hidden="true" /> Clear
            </button>
          )}
        </div>
        {history.length === 0 ? (
          <EmptyState icon={Camera} title="Nothing here yet">
            Your last few results appear here. They’re stored only in this browser, and photos are never saved.
          </EmptyState>
        ) : (
          <ul className="history">
            {history.map((item) => (
              <li key={item.at}>
                <Link to={item.to}>
                  <strong>{item.module}</strong>
                  <span>{item.title}</span>
                </Link>
                <time className="muted small">{timeAgo(item.at)}</time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
