import { useState, useEffect } from 'react';
import type { Edition, Story } from '@/types';

interface UseStoriesResult {
  stories: Story[];
  edition: Edition | null;
  loading: boolean;
  error: Error | null;
}

export function useStories(): UseStoriesResult {
  const [edition, setEdition] = useState<Edition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchStories() {
      try {
        const response = await fetch('/data/stories.json', { cache: 'no-cache' });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data: Edition = await response.json();
        setEdition(data);
      } catch (e) {
        setError(e instanceof Error ? e : new Error('Failed to fetch stories'));
      } finally {
        setLoading(false);
      }
    }

    fetchStories();
  }, []);

  return {
    stories: edition?.stories ?? [],
    edition,
    loading,
    error,
  };
}
