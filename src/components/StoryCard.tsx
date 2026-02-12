import { useState, memo } from 'react';
import { MapPin, Globe, TrendingUp, Landmark } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Story, Category } from '@/types';

const CATEGORY_LABELS = {
  geopolitique: 'Géopolitique',
  economie: 'Économie',
  politique: 'Politique',
} as const;

const CATEGORY_ICONS = {
  geopolitique: Globe,
  economie: TrendingUp,
  politique: Landmark,
} as const;

const CATEGORY_COLORS = {
  geopolitique: 'from-rose-900/80 to-rose-950',
  economie: 'from-sky-900/80 to-sky-950',
  politique: 'from-violet-900/80 to-violet-950',
} as const;

interface StoryCardProps {
  story: Story;
  onClick?: () => void;
}

export const StoryCard = memo(function StoryCard({ story, onClick }: StoryCardProps) {
  const [imageError, setImageError] = useState(false);
  const CategoryIcon = CATEGORY_ICONS[story.category];

  return (
    <article
      onClick={onClick}
      className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group"
    >
      {/* Background image or fallback */}
      {!imageError ? (
        <img
          src={story.imageUrl}
          alt=""
          loading="lazy"
          onError={() => setImageError(true)}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 bg-slate-800"
        />
      ) : (
        <FallbackBackground category={story.category} Icon={CategoryIcon} />
      )}

      {/* Top gradient for badge readability */}
      <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/60 to-transparent" />

      {/* Bottom gradient for title readability */}
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/90 via-black/60 to-transparent" />

      {/* Badge */}
      <div className="absolute top-3 left-3 z-10">
        <Badge variant={story.category}>
          {CATEGORY_LABELS[story.category]}
        </Badge>
      </div>

      {/* Title and location */}
      <div className="absolute inset-x-0 bottom-0 p-4">
        <h3 className="font-semibold text-[15px] leading-snug text-white mb-1.5 line-clamp-2">
          {story.title}
        </h3>
        <div className="flex items-center gap-1 text-slate-300 text-xs">
          <MapPin className="w-3 h-3" />
          <span>{story.location.name}</span>
        </div>
      </div>
    </article>
  );
});

interface FallbackBackgroundProps {
  category: Category;
  Icon: typeof Globe;
}

function FallbackBackground({ category, Icon }: FallbackBackgroundProps) {
  return (
    <div
      className={`absolute inset-0 bg-gradient-to-br ${CATEGORY_COLORS[category]} flex items-center justify-center`}
    >
      <Icon className="w-16 h-16 text-white/20" strokeWidth={1} />
    </div>
  );
}
