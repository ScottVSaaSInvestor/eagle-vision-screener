interface EagleIconProps {
  size?: number;
  className?: string;
  color?: string;
}

export function EagleIcon({ size = 40, className = '', color = '#C5A572' }: EagleIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Body */}
      <ellipse cx="50" cy="55" rx="10" ry="16" fill={color} />
      {/* Head */}
      <circle cx="50" cy="30" r="9" fill={color} />
      {/* Beak */}
      <polygon points="50,30 58,33 55,36" fill="#002B49" />
      {/* Left Wing */}
      <path d="M40 50 L5 35 L15 55 L40 60 Z" fill={color} />
      {/* Right Wing */}
      <path d="M60 50 L95 35 L85 55 L60 60 Z" fill={color} />
      {/* Wing details */}
      <path d="M40 50 L12 40 L20 52" stroke="#002B49" strokeWidth="1" />
      <path d="M60 50 L88 40 L80 52" stroke="#002B49" strokeWidth="1" />
      {/* Tail */}
      <path d="M44 70 L50 85 L56 70 L50 72 Z" fill={color} />
      {/* Talons */}
      <path d="M43 70 L35 80 L38 75 L32 78" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M57 70 L65 80 L62 75 L68 78" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      {/* Eye */}
      <circle cx="53" cy="27" r="2.5" fill="#CFFF04" />
      <circle cx="53" cy="27" r="1" fill="#002B49" />
    </svg>
  );
}
