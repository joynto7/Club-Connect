export default function LogoIcon({
  size = 36,
  className = "",
  animateOrbit = false,
}: {
  size?: number;
  className?: string;
  animateOrbit?: boolean;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-label="Club Connect Logo"
      className={className}
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id="cc-gold1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#fcd34d" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
        <linearGradient id="cc-gold2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#EBA814" />
        </linearGradient>
        <radialGradient id="cc-glow" cx="50%" cy="38%" r="55%">
          <stop offset="0%"   stopColor="#EBA814" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#EBA814" stopOpacity="0"   />
        </radialGradient>
      </defs>

      {/* Background */}
      <rect width="100" height="100" fill="#18181b" />
      <rect width="100" height="100" fill="url(#cc-glow)" />

      {/* Static hub — always visible as the fixed anchor */}
      <circle cx="50" cy="50" r="14"  fill="url(#cc-gold1)" />
      <circle cx="50" cy="50" r="8.5" fill="#18181b" />
      <circle cx="50" cy="50" r="4"   fill="url(#cc-gold2)" />

      {/* Orbit group — spins when animateOrbit is true */}
      <g
        className={animateOrbit ? "orbit-group" : ""}
        style={animateOrbit ? {
          transformBox:    "view-box",
          transformOrigin: "50% 50%",
        } as React.CSSProperties : undefined}
      >
        <circle cx="50" cy="50" r="33" fill="none"
          stroke="#EBA814" strokeWidth="1" strokeDasharray="4 3" opacity="0.35"
        />
        <line x1="50" y1="50" x2="50"   y2="17"   stroke="#EBA814" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
        <line x1="50" y1="50" x2="78.6" y2="66.5" stroke="#EBA814" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
        <line x1="50" y1="50" x2="21.4" y2="66.5" stroke="#EBA814" strokeWidth="2" strokeLinecap="round" opacity="0.6" />

        <circle cx="50"   cy="17"   r="9.5" fill="url(#cc-gold1)" />
        <circle cx="50"   cy="17"   r="4.5" fill="#18181b" />
        <circle cx="78.6" cy="66.5" r="8"   fill="url(#cc-gold2)" />
        <circle cx="78.6" cy="66.5" r="3.5" fill="#18181b" />
        <circle cx="21.4" cy="66.5" r="8"   fill="url(#cc-gold2)" />
        <circle cx="21.4" cy="66.5" r="3.5" fill="#18181b" />
      </g>
    </svg>
  );
}
