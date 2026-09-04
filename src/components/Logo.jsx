
export default function Logo({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="36" fill="none" stroke="#BB4B34" strokeWidth="6" />
      <path d="M 14 50 A 36 36 0 0 0 86 50 Z" fill="#BB4B34" />
      <line x1="9" y1="50" x2="91" y2="50" stroke="#F4F1EA" strokeWidth="5" />
    </svg>
  );
}
