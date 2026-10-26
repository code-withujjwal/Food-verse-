import { AlertTriangle, Info } from 'lucide-react';

export default function Notice({ tone = 'info', title, children }) {
  const Icon = tone === 'warn' ? AlertTriangle : Info;
  return (
    <div className={`notice notice-${tone}`}>
      <Icon size={20} aria-hidden="true" />
      <div>
        {title && <strong>{title}</strong>}
        <p>{children}</p>
      </div>
    </div>
  );
}
