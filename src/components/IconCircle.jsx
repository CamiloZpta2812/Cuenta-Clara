
export default function IconCircle({ Icon, color, bg, size = 30, iconSize = 15 }) {
  return (
    <div className="cc-icon-circle" style={{ width: size, height: size, background: bg }}>
      <Icon size={iconSize} color={color} strokeWidth={2.2} />
    </div>
  );
}
