import { useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import { getHealth } from '../api/client.js';

export default function Header({ onMenu }) {
  const [status, setStatus] = useState({ tone: 'checking', text: 'Checking server…' });

  useEffect(() => {
    let active = true;
    getHealth()
      .then((health) => {
        if (!active) return;
        if (!health.sdk_installed) setStatus({ tone: 'warn', text: 'Server running · google-genai not installed' });
        else if (!health.gemini_configured) setStatus({ tone: 'warn', text: 'Server running · Gemini key missing' });
        else setStatus({ tone: 'ready', text: `Gemini configured · ${health.model}` });
      })
      .catch(() => active && setStatus({ tone: 'offline', text: 'Backend offline' }));
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="topbar">
      <button type="button" className="icon-btn menu-btn" onClick={onMenu} aria-label="Open menu">
        <Menu size={22} />
      </button>
      <span className="topbar-brand">Food Verse AI</span>
      <span className={`status status-${status.tone}`} role="status">
        <i aria-hidden="true" />
        {status.text}
      </span>
    </div>
  );
}
