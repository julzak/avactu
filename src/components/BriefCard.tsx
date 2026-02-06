import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, Share2, Check } from 'lucide-react';
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
  const [copied, setCopied] = useState(false);
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

          {/* Mini Map + Share */}
          <div className="absolute top-2 right-2 flex flex-col items-center gap-2">
            <MiniMap location={story.location} category={story.category} />
            <button
              onClick={async () => {
                const url = `https://avactu.com/s/${story.id}`;
                try {
                  if (navigator.share) {
                    await navigator.share({ title: story.title, url });
                  } else {
                    await navigator.clipboard.writeText(url);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }
                } catch {
                  // User cancelled share dialog
                }
              }}
              className="w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center hover:bg-black/50 transition-colors"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <Share2 className="w-4 h-4 text-white/70" />
              )}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col p-4 pt-2 overflow-hidden">
          {/* Location */}
          <p className="text-slate-500 text-xs mb-2 font-mono tracking-wide">
            {story.location.name.toUpperCase()}
          </p>

          {/* Title */}
          <h2 className="font-serif text-lg font-semibold text-slate-50 leading-tight mb-4 tracking-editorial">
            {story.title}
          </h2>

          {/* Content - Bullets or Analysis */}
          {!showAnalysis ? (
            /* Bullets View - hauteur auto, pas de scroll */
            <ul className="space-y-2.5 mb-3">
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
          ) : (
            /* Analysis View - scroll si contenu long */
            <div className="max-h-[45vh] overflow-y-auto mb-3">
              {/* Sources */}
              <p className="text-[10px] text-slate-600 mb-4 font-mono uppercase tracking-wider">
                Sources : {story.sources.join(' • ')}
              </p>

              {/* Exec Summary */}
              <p className="text-slate-400 leading-relaxed whitespace-pre-line text-[13px]">
                {story.execSummary}
              </p>
            </div>
          )}

          {/* Toggle Button - toujours collé au contenu */}
          <button
            onClick={() => setShowAnalysis(!showAnalysis)}
            className={`w-full py-2.5 px-4 rounded-lg font-mono text-xs uppercase tracking-widest transition-all border flex items-center justify-center gap-2 ${
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
