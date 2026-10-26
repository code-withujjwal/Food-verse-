export default function PageHeader({ icon: Icon, title, children }) {
  return (
    <header className="page-header">
      {Icon && (
        <span className="page-header-icon">
          <Icon size={26} aria-hidden="true" />
        </span>
      )}
      <div>
        <h1>{title}</h1>
        <p className="muted">{children}</p>
      </div>
    </header>
  );
}
