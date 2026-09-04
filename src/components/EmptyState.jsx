
export default function EmptyState({ Icon, title, text }) {
  return (
    <div className="cc-empty">
      <Icon size={30} />
      <p style={{ fontWeight: 600, color: 'var(--ink)' }}>{title}</p>
      <p>{text}</p>
    </div>
  );
}
