import { StoryCard } from '@/components/StoryCard';
import type { Story } from '@/types';

interface StoryStackProps {
  stories: Story[];
  onStoryClick?: (storyId: string) => void;
}

export function StoryStack({ stories, onStoryClick }: StoryStackProps) {
  return (
    <div className="grid grid-cols-2 gap-3 overflow-y-auto">
      {stories.map((story) => (
        <StoryCard
          key={story.id}
          story={story}
          onClick={() => onStoryClick?.(story.id)}
        />
      ))}
    </div>
  );
}
