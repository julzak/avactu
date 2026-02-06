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
    const targetIndex = stories.findIndex(s => s.id === initialStoryId);
    if (targetIndex <= 0) return;

    const targetCard = container.children[targetIndex] as HTMLElement | undefined;
    if (!targetCard) return;

    // Use getBoundingClientRect for the VISUAL position (not offsetTop which is
    // inflated by react-simple-maps SVGs to ~75000px per card)
    const containerRect = container.getBoundingClientRect();
    const cardRect = targetCard.getBoundingClientRect();
    const scrollPos = cardRect.top - containerRect.top;

    // Disable snap + smooth, scroll, then restore
    container.style.scrollSnapType = 'none';
    container.style.scrollBehavior = 'auto';
    container.scrollTop = scrollPos;
    setTimeout(() => {
      container.style.scrollSnapType = '';
      container.style.scrollBehavior = '';
    }, 300);
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
