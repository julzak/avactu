import { BriefCard } from '@/components/BriefCard';
import type { Story } from '@/types';

interface BriefStackProps {
  stories: Story[];
  activeStoryId: string | null;
  onObserve: (element: HTMLElement | null) => void;
}

export function BriefStack({ stories, activeStoryId, onObserve }: BriefStackProps) {
  return (
    <div className="h-full overflow-y-auto snap-y snap-mandatory scroll-smooth">
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
