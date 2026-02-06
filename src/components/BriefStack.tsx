import { useLayoutEffect, useRef } from 'react';
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

  useLayoutEffect(() => {
    if (!initialStoryId || !containerRef.current) return;
    const container = containerRef.current;
    const el = container.querySelector(`[data-story-id="${CSS.escape(initialStoryId)}"]`);
    if (!el) return;

    // Disable snap temporarily, scroll instantly, re-enable
    container.style.scrollSnapType = 'none';
    (el as HTMLElement).style.scrollSnapAlign = 'none';
    el.scrollIntoView({ behavior: 'instant' as ScrollBehavior, block: 'start' });

    // Re-enable snap after scroll position is committed
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        container.style.scrollSnapType = '';
        (el as HTMLElement).style.scrollSnapAlign = '';
      });
    });
  }, [initialStoryId, stories]);

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
