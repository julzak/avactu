export function AvactuLogoTransparent({ className = "w-24 h-24" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" fill="none" className={className}>
      <defs>
        <filter id="blue-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="coral-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g transform="translate(64, 64)">
        {/* Réseau global - sphère */}
        <g filter="url(#blue-glow)" opacity="0.5" stroke="#0ea5e9" strokeWidth="0.8">
          <ellipse cx="0" cy="0" rx="50" ry="50" transform="rotate(0)" />
          <ellipse cx="0" cy="0" rx="50" ry="20" transform="rotate(45)" />
          <ellipse cx="0" cy="0" rx="50" ry="20" transform="rotate(-45)" />
          <circle cx="-40" cy="10" r="1.5" fill="#0ea5e9" stroke="none" />
          <circle cx="35" cy="-20" r="1.5" fill="#0ea5e9" stroke="none" />
          <circle cx="0" cy="45" r="1.5" fill="#0ea5e9" stroke="none" />
        </g>
        {/* Structure "A" */}
        <g filter="url(#blue-glow)" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round">
          <line x1="0" y1="-35" x2="-30" y2="40" />
          <line x1="0" y1="-35" x2="30" y2="40" />
          <line x1="-15" y1="5" x2="15" y2="5" />
          <circle cx="-30" cy="40" r="3" fill="#22d3ee" stroke="none" />
          <circle cx="30" cy="40" r="3" fill="#22d3ee" stroke="none" />
          <circle cx="-15" cy="5" r="2.5" fill="#22d3ee" stroke="none" />
          <circle cx="15" cy="5" r="2.5" fill="#22d3ee" stroke="none" />
        </g>
        {/* Coeur corail */}
        <g filter="url(#coral-glow)" transform="translate(0, -38) scale(0.8)">
          <path d="M0 4 C -4 -2, -10 0, -10 6 C -10 12, 0 22, 0 22 C 0 22, 10 12, 10 6 C 10 0, 4 -2, 0 4 Z" fill="#f43f5e" />
        </g>
      </g>
    </svg>
  );
}
