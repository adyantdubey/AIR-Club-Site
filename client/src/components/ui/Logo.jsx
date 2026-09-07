// Club mark: a hexagon (chip / nut) with a wheel dot in the middle.
export default function Logo({ size = 36, className = '', pathClass = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <polygon
        className={pathClass}
        points="32,4 56,18 56,46 32,60 8,46 8,18"
        stroke="var(--blue)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <circle className={pathClass} cx="32" cy="32" r="9" stroke="var(--blue-glow)" strokeWidth="3" />
      <path className={pathClass} d="M32 23V13M32 51V41M23 32H13M51 32H41" stroke="var(--blue)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
