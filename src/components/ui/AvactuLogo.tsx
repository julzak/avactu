interface AvactuLogoProps {
  size?: number;
  className?: string;
}

export function AvactuLogo({ size = 128, className = '' }: AvactuLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        {/* Gradient for mesh lines */}
        <linearGradient id="meshGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0ea5e9" />
          <stop offset="50%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>

        {/* Gradient for A structure */}
        <linearGradient id="aGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#0ea5e9" />
        </linearGradient>

        {/* Glow filter for mesh */}
        <filter id="meshGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Strong glow for A */}
        <filter id="aGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Coral glow for heart */}
        <filter id="heartGlow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Rotating globe group */}
      <g className="animate-[spin_60s_linear_infinite]" style={{ transformOrigin: '64px 64px' }}>
        {/* Sphere mesh - Longitude lines (vertical) */}
        <g filter="url(#meshGlow)" stroke="url(#meshGradient)" fill="none">
          {/* Main longitude arcs */}
          <ellipse cx="64" cy="64" rx="45" ry="45" strokeWidth="0.4" opacity="0.3" />
          <ellipse cx="64" cy="64" rx="45" ry="15" strokeWidth="0.4" opacity="0.5" transform="rotate(0, 64, 64)" />
          <ellipse cx="64" cy="64" rx="45" ry="15" strokeWidth="0.4" opacity="0.4" transform="rotate(30, 64, 64)" />
          <ellipse cx="64" cy="64" rx="45" ry="15" strokeWidth="0.4" opacity="0.5" transform="rotate(60, 64, 64)" />
          <ellipse cx="64" cy="64" rx="45" ry="15" strokeWidth="0.4" opacity="0.6" transform="rotate(90, 64, 64)" />
          <ellipse cx="64" cy="64" rx="45" ry="15" strokeWidth="0.4" opacity="0.5" transform="rotate(120, 64, 64)" />
          <ellipse cx="64" cy="64" rx="45" ry="15" strokeWidth="0.4" opacity="0.4" transform="rotate(150, 64, 64)" />

          {/* Latitude lines (horizontal) */}
          <ellipse cx="64" cy="34" rx="35" ry="10" strokeWidth="0.3" opacity="0.3" />
          <ellipse cx="64" cy="44" rx="42" ry="12" strokeWidth="0.3" opacity="0.4" />
          <ellipse cx="64" cy="54" rx="44" ry="14" strokeWidth="0.3" opacity="0.5" />
          <ellipse cx="64" cy="64" rx="45" ry="15" strokeWidth="0.4" opacity="0.6" />
          <ellipse cx="64" cy="74" rx="44" ry="14" strokeWidth="0.3" opacity="0.5" />
          <ellipse cx="64" cy="84" rx="42" ry="12" strokeWidth="0.3" opacity="0.4" />
          <ellipse cx="64" cy="94" rx="35" ry="10" strokeWidth="0.3" opacity="0.3" />

          {/* Additional depth lines */}
          <ellipse cx="64" cy="64" rx="30" ry="45" strokeWidth="0.3" opacity="0.25" />
          <ellipse cx="64" cy="64" rx="15" ry="45" strokeWidth="0.3" opacity="0.2" />

          {/* Mesh intersection nodes */}
          <circle cx="19" cy="64" r="1" fill="#22d3ee" opacity="0.6" />
          <circle cx="109" cy="64" r="1" fill="#22d3ee" opacity="0.6" />
          <circle cx="64" cy="19" r="1" fill="#22d3ee" opacity="0.5" />
          <circle cx="64" cy="109" r="1" fill="#22d3ee" opacity="0.5" />
          <circle cx="34" cy="34" r="0.8" fill="#22d3ee" opacity="0.4" />
          <circle cx="94" cy="34" r="0.8" fill="#22d3ee" opacity="0.4" />
          <circle cx="34" cy="94" r="0.8" fill="#22d3ee" opacity="0.4" />
          <circle cx="94" cy="94" r="0.8" fill="#22d3ee" opacity="0.4" />
          <circle cx="44" cy="44" r="0.6" fill="#22d3ee" opacity="0.3" />
          <circle cx="84" cy="44" r="0.6" fill="#22d3ee" opacity="0.3" />
          <circle cx="44" cy="84" r="0.6" fill="#22d3ee" opacity="0.3" />
          <circle cx="84" cy="84" r="0.6" fill="#22d3ee" opacity="0.3" />
        </g>
      </g>

      {/* Static A structure - doesn't rotate */}
      <g filter="url(#aGlow)">
        {/* Left leg of A */}
        <line
          x1="64"
          y1="28"
          x2="34"
          y2="100"
          stroke="url(#aGradient)"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        {/* Right leg of A */}
        <line
          x1="64"
          y1="28"
          x2="94"
          y2="100"
          stroke="url(#aGradient)"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        {/* Crossbar of A */}
        <line
          x1="44"
          y1="72"
          x2="84"
          y2="72"
          stroke="url(#aGradient)"
          strokeWidth="1.2"
          strokeLinecap="round"
        />

        {/* Node points on A */}
        <circle cx="64" cy="28" r="2" fill="#22d3ee" />
        <circle cx="34" cy="100" r="2.5" fill="#22d3ee" />
        <circle cx="94" cy="100" r="2.5" fill="#22d3ee" />
        <circle cx="44" cy="72" r="1.8" fill="#22d3ee" />
        <circle cx="84" cy="72" r="1.8" fill="#22d3ee" />
      </g>

      {/* Tiny heart at apex of A */}
      <g filter="url(#heartGlow)" transform="translate(64, 22) scale(0.35)">
        <path
          d="M0 4 C -4 -2, -10 0, -10 6 C -10 12, 0 20, 0 20 C 0 20, 10 12, 10 6 C 10 0, 4 -2, 0 4 Z"
          fill="#f43f5e"
        />
      </g>
    </svg>
  );
}
