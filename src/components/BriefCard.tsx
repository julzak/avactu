import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { MiniMap } from '@/components/MiniMap';
import type { Story } from '@/types';

const CATEGORY_LABELS = {
  geopolitique: 'Géopolitique',
  economie: 'Économie',
  politique: 'Politique',
} as const;

const BULLET_GLOW = {
  geopolitique: 'shadow-glow-geopo-sm',
  economie: 'shadow-glow-eco-sm',
  politique: 'shadow-glow-politique-sm',
} as const;

const BULLET_TEXT = {
  geopolitique: 'text-rose-400',
  economie: 'text-cyan-400',
  politique: 'text-violet-400',
} as const;

interface BriefCardProps {
  story: Story;
  isActive: boolean;
  onObserve: (element: HTMLElement | null) => void;
}

export function BriefCard({ story, isActive, onObserve }: BriefCardProps) {
  const [showAnalysis, setShowAnalysis] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onObserve(cardRef.current);
  }, [onObserve]);

  // Reset state when card becomes inactive
  useEffect(() => {
    if (!isActive) {
      setShowAnalysis(false);
    }
  }, [isActive]);

  const bulletGlow = BULLET_GLOW[story.category];
  const bulletText = BULLET_TEXT[story.category];

  return (
    <div
      ref={cardRef}
      data-story-id={story.id}
      className="h-[70vh] snap-start snap-always flex-shrink-0 px-4 py-2"
    >
      <div
        className={`h-full rounded-2xl border backdrop-blur-xl transition-all duration-300 overflow-hidden flex flex-col ${
          isActive
            ? 'bg-white/[0.03] border-white/10'
            : 'bg-white/[0.02] border-white/5'
        }`}
      >
        {/* Header Image */}
        <div className="relative h-32 shrink-0 overflow-hidden">
          <div
            className="absolute inset-0 bg-obsidian-800 bg-cover bg-center scale-105"
            style={{ backgroundImage: `url(${story.imageUrl})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-obsidian-950 via-obsidian-950/50 to-transparent" />

          {/* Badge over image */}
          <div className="absolute top-3 left-3">
            <Badge variant={story.category}>
              {CATEGORY_LABELS[story.category]}
            </Badge>
          </div>

          {/* Mini Map */}
          <div className="absolute top-2 right-2">
            <MiniMap location={story.location} category={story.category} />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col p-4 pt-2 overflow-hidden">
          {/* Location */}
          <p className="text-slate-500 text-xs mb-2 font-mono tracking-wide shrink-0">
            {story.location.name.toUpperCase()}
          </p>

          {/* Title */}
          <h2 className="font-serif text-lg font-semibold text-slate-50 leading-tight mb-4 tracking-editorial shrink-0">
            {story.title}
          </h2>

          {/* Accordion Content - Only one visible at a time */}
          <div className="flex-1 overflow-y-auto min-h-0 relative">
            {/* Bullets View */}
            <div
              className={`transition-all duration-300 ease-out ${
                showAnalysis ? 'opacity-0 pointer-events-none absolute inset-0' : 'opacity-100'
              }`}
            >
              <ul className="space-y-2.5">
                {story.bullets.map((bullet, index) => (
                  <li key={index} className="flex gap-3 text-sm">
                    <span
                      className={`${bulletText} ${bulletGlow} font-mono font-medium text-[10px] w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5 bg-white/5`}
                    >
                      {index + 1}
                    </span>
                    <span className="text-slate-400 leading-relaxed text-[13px]">
                      {bullet}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Analysis View */}
            <div
              className={`transition-all duration-300 ease-out ${
                showAnalysis ? 'opacity-100' : 'opacity-0 pointer-events-none absolute inset-0'
              }`}
            >
              {/* Sources */}
              <p className="text-[10px] text-slate-600 mb-4 font-mono uppercase tracking-wider">
                Sources : {story.sources.join(' • ')}
              </p>

              {/* Exec Summary */}
              <p className="text-slate-400 leading-relaxed whitespace-pre-line text-[13px]">
                {story.execSummary}
              </p>
            </div>
          </div>

          {/* Toggle Button */}
          <button
            onClick={() => setShowAnalysis(!showAnalysis)}
            className={`mt-3 w-full py-2.5 px-4 rounded-lg font-mono text-xs uppercase tracking-widest transition-all border flex items-center justify-center gap-2 shrink-0 ${
              isActive
                ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/20'
                : 'bg-transparent border-white/5 text-slate-600'
            }`}
          >
            {showAnalysis ? (
              <>
                <ChevronUp className="w-4 h-4" />
                Voir les points clés
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                Analyse stratégique
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
