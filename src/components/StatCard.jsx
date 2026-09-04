import IconCircle from './IconCircle';

export default function StatCard({ label, value, Icon, color, bg, sub }) {
  return (
    <div className="cc-card">
      <div className="cc-stat-label">
        <IconCircle Icon={Icon} color={color} bg={bg} />
        {label}
      </div>
      <div className="cc-stat-value">{value}</div>
      {sub ? <div className="cc-stat-sub">{sub}</div> : null}
    </div>
  );
}
