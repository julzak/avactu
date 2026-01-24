interface AvactuLogoProps {
  className?: string;
}

export function AvactuLogo({ className = 'w-10 h-10 text-cyan-400' }: AvactuLogoProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Outer circle - network ring */}
      <circle cx="12" cy="12" r="10" className="opacity-50" />

      {/* A shape - left stroke */}
      <path d="M12 2L9.5 7.5L7 13L4.5 18.5" />

      {/* A shape - right stroke */}
      <path d="M12 2L14.5 7.5L17 13L19.5 18.5" />

      {/* A crossbar */}
      <path d="M6 16H18" className="opacity-75" />

      {/* Apex node - pulsing accent */}
      <circle
        cx="12"
        cy="2"
        r="1.5"
        fill="currentColor"
        className="animate-pulse"
      />
    </svg>
  );
}
