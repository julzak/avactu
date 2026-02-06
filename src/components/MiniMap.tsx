import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Maximize2 } from 'lucide-react';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
} from 'react-simple-maps';
import type { GeographyType } from 'react-simple-maps';
import type { Location, Category } from '@/types';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

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

export function MiniMap({ location, category }: MiniMapProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const markerColor = CATEGORY_COLORS[category];
  const markerGlow = CATEGORY_GLOW[category];

  // Close on Escape key
  useEffect(() => {
    if (!isExpanded) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsExpanded(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded]);

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
  };

  const handleClose = () => {
    setIsExpanded(false);
  };

  // Abstract map style - lands blend with card
  const landFill = '#1E293B';
  const landStroke = '#334155';

  return (
    <>
      {/* Mini circular map - with contrast for any background */}
      <div className="p-1 rounded-full bg-black/30 backdrop-blur-sm">
        <button
          onClick={handleToggle}
          className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-white/40 ring-2 ring-black/40 shadow-lg shadow-black/50 hover:border-white/60 transition-colors"
          style={{ boxShadow: `${markerGlow}, 0 4px 12px rgba(0, 0, 0, 0.5)` }}
        >
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{
            scale: 400,
            center: [location.lng, location.lat],
          }}
          style={{ width: '100%', height: '100%', background: 'transparent' }}
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }: { geographies: GeographyType[] }) =>
              geographies
                .filter((geo) => geo.properties.name !== 'Antarctica')
                .map((geo: GeographyType) => (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={landFill}
                    stroke={landStroke}
                    strokeWidth={0.3}
                    style={{
                      default: { outline: 'none' },
                      hover: { outline: 'none' },
                      pressed: { outline: 'none' },
                    }}
                  />
                ))
            }
          </Geographies>
          <Marker coordinates={[location.lng, location.lat]}>
            <circle r={8} fill={markerColor} opacity={0.4} className="animate-ping" />
            <circle r={5} fill={markerColor} opacity={0.6} className="animate-pulse" />
            <circle r={3} fill={markerColor} stroke="#fff" strokeWidth={1} />
          </Marker>
        </ComposableMap>
          <div className="absolute bottom-0.5 right-0.5 bg-black/50 rounded-full p-0.5">
            <Maximize2 className="w-2.5 h-2.5 text-white/80" />
          </div>
        </button>
      </div>

      {/* Expanded overlay - fully opaque background */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black"
            onClick={handleClose}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-[300px] rounded-xl overflow-hidden border border-white/20 bg-slate-900"
              style={{ boxShadow: markerGlow }}
            >
              {/* Map container */}
              <div className="h-[220px]">
                <ComposableMap
                  projection="geoMercator"
                  projectionConfig={{
                    scale: 800,
                    center: [location.lng, location.lat],
                  }}
                  style={{ width: '100%', height: '100%', background: 'transparent' }}
                >
                  <Geographies geography={GEO_URL}>
                    {({ geographies }: { geographies: GeographyType[] }) =>
                      geographies
                        .filter((geo) => geo.properties.name !== 'Antarctica')
                        .map((geo: GeographyType) => (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            fill={landFill}
                            stroke={landStroke}
                            strokeWidth={0.5}
                            style={{
                              default: { outline: 'none' },
                              hover: { outline: 'none' },
                              pressed: { outline: 'none' },
                            }}
                          />
                        ))
                    }
                  </Geographies>
                  <Marker coordinates={[location.lng, location.lat]}>
                    <circle r={16} fill={markerColor} opacity={0.2} className="animate-ping" />
                    <circle r={10} fill={markerColor} opacity={0.4} className="animate-pulse" />
                    <circle r={6} fill={markerColor} stroke="#fff" strokeWidth={2} />
                  </Marker>
                </ComposableMap>
              </div>

              {/* Label inside container */}
              <div className="px-4 py-3 bg-slate-800/90 border-t border-white/10">
                <p className="text-sm text-slate-300 font-mono uppercase tracking-wider text-center flex items-center justify-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: markerColor }} />
                  {location.name}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
