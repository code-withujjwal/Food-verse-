export default function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="empty-state">
      {Icon && <Icon size={34} aria-hidden="true" />}
      <h3>{title}</h3>
      <p className="muted">{children}</p>
    </div>
  );
}
