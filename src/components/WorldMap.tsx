import { useMemo } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from 'react-simple-maps';
import type { GeographyType } from 'react-simple-maps';
import type { Story } from '@/types';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

const CATEGORY_COLORS = {
  geopolitique: { fill: '#f43f5e', pulse: '#f43f5e' },
  economie: { fill: '#0ea5e9', pulse: '#0ea5e9' },
  politique: { fill: '#8b5cf6', pulse: '#8b5cf6' },
} as const;

interface WorldMapProps {
  stories: Story[];
  activeStoryId: string | null;
  onMarkerClick?: (storyId: string) => void;
}

export function WorldMap({ stories, activeStoryId, onMarkerClick }: WorldMapProps) {
  const activeStory = useMemo(
    () => stories.find((s) => s.id === activeStoryId),
    [stories, activeStoryId]
  );

  const center: [number, number] = useMemo(() => {
    if (activeStory) {
      return [activeStory.location.lng, activeStory.location.lat];
    }
    return [30, 35];
  }, [activeStory]);

  return (
    <div className="w-full h-full bg-slate-900 rounded-lg overflow-hidden">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 130, center: [30, 35] }}
        style={{ width: '100%', height: '100%' }}
      >
        <ZoomableGroup
          center={center}
          zoom={1}
          minZoom={1}
          maxZoom={1}
          translateExtent={[
            [-Infinity, -Infinity],
            [Infinity, Infinity],
          ]}
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }: { geographies: GeographyType[] }) =>
              geographies
                .filter((geo) => geo.properties.name !== 'Antarctica')
                .map((geo: GeographyType) => (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill="#334155"
                    stroke="#475569"
                    strokeWidth={0.5}
                    style={{
                      default: {
                        outline: 'none',
                        opacity: activeStoryId ? 0.4 : 1,
                        transition: 'opacity 0.3s ease',
                      },
                      hover: { outline: 'none', fill: '#3f4f63' },
                      pressed: { outline: 'none' },
                    }}
                  />
                ))
            }
          </Geographies>

          {stories.map((story) => {
            const colors = CATEGORY_COLORS[story.category];
            const isActive = story.id === activeStoryId;

            return (
              <Marker
                key={story.id}
                coordinates={[story.location.lng, story.location.lat]}
                onClick={() => onMarkerClick?.(story.id)}
                style={{ cursor: 'pointer' }}
              >
                {/* Pulse animations - only for active */}
                {isActive && (
                  <>
                    <circle
                      r={16}
                      fill={colors.pulse}
                      opacity={0.15}
                      className="animate-ping"
                    />
                    <circle
                      r={10}
                      fill={colors.pulse}
                      opacity={0.25}
                      className="animate-pulse"
                    />
                  </>
                )}
                {/* Main marker */}
                <circle
                  r={isActive ? 7 : 5}
                  fill={colors.fill}
                  stroke="#fff"
                  strokeWidth={isActive ? 2 : 1}
                  opacity={isActive ? 1 : 0.5}
                  style={{
                    transition: 'all 0.3s ease',
                    filter: isActive ? 'drop-shadow(0 0 8px rgba(255,255,255,0.3))' : 'none',
                  }}
                />
              </Marker>
            );
          })}
        </ZoomableGroup>
      </ComposableMap>
    </div>
  );
}
