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
    const el = container.querySelector(`[data-story-id="${CSS.escape(initialStoryId)}"]`) as HTMLElement | null;
    if (el) {
      // Disable both snap and smooth scroll to prevent them from fighting
      container.style.scrollSnapType = 'none';
      container.style.scrollBehavior = 'auto';
      container.scrollTop = el.offsetTop;
      // Restore after browser has applied the scroll position
      requestAnimationFrame(() => {
        container.style.scrollSnapType = '';
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
