import { useState, useEffect, useCallback, memo } from 'react';
import { Maximize2 } from 'lucide-react';
import type { Location, Category } from '@/types';

const CATEGORY_COLORS = {
  geopolitique: '#f43f5e',
  economie: '#0ea5e9',
  politique: '#8b5cf6',
} as const;

const CATEGORY_GLOW = {
  geopolitique: '0 0 20px rgba(244, 63, 94, 0.6)',
  economie: '0 0 20px rgba(14, 165, 233, 0.6)',
  politique: '0 0 20px rgba(139, 92, 246, 0.6)',
} as const;

interface MiniMapProps {
  location: Location;
  category: Category;
}

/**
 * Convert lat/lng to a percentage position on a simple equirectangular projection.
 * Returns { x, y } in percent (0-100).
 */
function geoToPercent(lat: number, lng: number): { x: number; y: number } {
  // lng: -180..180 → 0..100
  const x = ((lng + 180) / 360) * 100;
  // lat: 90..-60 → 0..100 (clip at -60 to exclude Antarctica)
  const y = ((90 - lat) / 150) * 100;
  return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
}

export const MiniMap = memo(function MiniMap({ location, category }: MiniMapProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const markerColor = CATEGORY_COLORS[category];
  const markerGlow = CATEGORY_GLOW[category];

  const handleClose = useCallback(() => setIsExpanded(false), []);
  const handleToggle = useCallback(() => setIsExpanded((v) => !v), []);

  // Close on Escape key
  useEffect(() => {
    if (!isExpanded) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsExpanded(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded]);

  const { x, y } = geoToPercent(location.lat, location.lng);

  return (
    <>
      {/* Mini circular map */}
      <div className="p-1 rounded-full bg-black/30 backdrop-blur-sm">
        <button
          onClick={handleToggle}
          className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-white/40 ring-2 ring-black/40 shadow-lg shadow-black/50 hover:border-white/60 transition-colors bg-slate-800"
          style={{ boxShadow: `${markerGlow}, 0 4px 12px rgba(0, 0, 0, 0.5)` }}
        >
          {/* Marker dot – always centered in the mini circle */}
          <span
            className="absolute w-3 h-3 rounded-full animate-pulse"
            style={{
              backgroundColor: markerColor,
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              boxShadow: `0 0 8px ${markerColor}`,
            }}
          />
          <div className="absolute bottom-0.5 right-0.5 bg-black/50 rounded-full p-0.5">
            <Maximize2 className="w-2.5 h-2.5 text-white/80" />
          </div>
        </button>
      </div>

      {/* Expanded overlay - CSS transitions instead of framer-motion */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-200"
        style={{
          opacity: isExpanded ? 1 : 0,
          pointerEvents: isExpanded ? 'auto' : 'none',
          backgroundColor: 'rgba(0, 0, 0, 0.95)',
        }}
        onClick={handleClose}
      >
        <div
          className="relative w-[300px] rounded-xl overflow-hidden border border-white/20 bg-slate-900 transition-transform duration-200"
          style={{
            transform: isExpanded ? 'scale(1)' : 'scale(0.8)',
            boxShadow: markerGlow,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Static map area */}
          <div className="relative h-[220px] bg-slate-800">
            {/* Marker */}
            <span
              className="absolute rounded-full"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <span
                className="absolute w-8 h-8 rounded-full animate-ping -translate-x-1/2 -translate-y-1/2"
                style={{ backgroundColor: markerColor, opacity: 0.15 }}
              />
              <span
                className="absolute w-5 h-5 rounded-full animate-pulse -translate-x-1/2 -translate-y-1/2"
                style={{ backgroundColor: markerColor, opacity: 0.4 }}
              />
              <span
                className="absolute w-3 h-3 rounded-full border-2 border-white -translate-x-1/2 -translate-y-1/2"
                style={{ backgroundColor: markerColor }}
              />
            </span>
          </div>

          {/* Label */}
          <div className="px-4 py-3 bg-slate-800/90 border-t border-white/10">
            <p className="text-sm text-slate-300 font-mono uppercase tracking-wider text-center flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: markerColor }} />
              {location.name}
            </p>
          </div>
        </div>
      </div>
    </>
  );
});
