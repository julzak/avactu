import { useEffect, useRef } from 'react';
import { BriefCard } from '@/components/BriefCard';
import type { Story } from '@/types';

interface BriefStackProps {
  stories: Story[];
  activeStoryId: string | null;
  onObserve: (element: HTMLElement | null) => void;
  initialStoryId?: string | null;
}

export function BriefStack({ stories, activeStoryId, onObserve, initialStoryId }: BriefStackProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!initialStoryId || !containerRef.current) return;
    const container = containerRef.current;
    const el = container.querySelector(`[data-story-id="${CSS.escape(initialStoryId)}"]`);
    if (el) {
      // Override CSS scroll-smooth to force instant scroll (smooth + snap-mandatory conflict)
      container.style.scrollBehavior = 'auto';
      el.scrollIntoView({ block: 'start' });
      // Restore smooth scroll for user interactions
      requestAnimationFrame(() => {
        container.style.scrollBehavior = '';
      });
    }
  }, [initialStoryId]);

  return (
    <div ref={containerRef} className="h-full overflow-y-auto snap-y snap-mandatory scroll-smooth">
      {stories.map((story) => (
        <BriefCard
          key={story.id}
          story={story}
          isActive={story.id === activeStoryId}
          onObserve={onObserve}
        />
      ))}
      {/* Bottom padding for last card */}
      <div className="h-[30vh]" />
    </div>
  );
}
