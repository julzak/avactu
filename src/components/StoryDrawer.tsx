import { MapPin } from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import type { Story } from '@/types';

const CATEGORY_LABELS = {
  geopolitique: 'Géopolitique',
  economie: 'Économie',
  politique: 'Politique',
} as const;

interface StoryDrawerProps {
  story: Story | null;
  open: boolean;
  onClose: () => void;
}

export function StoryDrawer({ story, open, onClose }: StoryDrawerProps) {
  if (!story) return null;

  return (
    <Drawer open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DrawerContent className="h-[85vh] bg-slate-900">
        <div className="overflow-y-auto h-full">
          {/* Header image */}
          <div className="relative h-48 w-full">
            <div
              className="absolute inset-0 bg-slate-800 bg-cover bg-center"
              style={{ backgroundImage: `url(${story.imageUrl})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent" />
          </div>

          {/* Content */}
          <div className="px-4 -mt-12 relative">
            <DrawerHeader className="px-0">
              {/* Badge and location */}
              <div className="flex items-center gap-2 mb-2">
                <Badge variant={story.category}>
                  {CATEGORY_LABELS[story.category]}
                </Badge>
                <div className="flex items-center gap-1 text-slate-400 text-xs">
                  <MapPin className="w-3 h-3" />
                  <span>{story.location.name}</span>
                </div>
              </div>

              {/* Title */}
              <DrawerTitle className="text-xl font-bold text-slate-50 text-left">
                {story.title}
              </DrawerTitle>

              {/* Sources */}
              <p className="text-xs text-slate-500 mt-2">
                Sources : {story.sources.join(', ')}
              </p>
            </DrawerHeader>

            {/* En bref */}
            <section className="mt-6">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">
                En bref
              </h3>
              <ul className="space-y-2">
                {story.bullets.map((bullet, index) => (
                  <li
                    key={index}
                    className="flex gap-2 text-sm text-slate-300"
                  >
                    <span className="text-slate-500 shrink-0">•</span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Comprendre */}
            <section className="mt-6 pb-8">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">
                Comprendre
              </h3>
              <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                {story.execSummary}
              </div>
            </section>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
