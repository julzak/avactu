import { useCallback, useEffect, useRef, useState } from 'react';

export function useActiveStory(storyIds: string[]) {
  const [activeStoryId, setActiveStoryId] = useState<string | null>(
    storyIds[0] ?? null
  );
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const storyId = entry.target.getAttribute('data-story-id');
            if (storyId) {
              setActiveStoryId(storyId);
              // Haptic feedback - refined
              if (navigator.vibrate) {
                navigator.vibrate(15);
              }
            }
          }
        });
      },
      {
        threshold: 0.5,
        rootMargin: '-20% 0px -20% 0px',
      }
    );

    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  // Set initial active story when storyIds first populate
  useEffect(() => {
    if (storyIds.length > 0 && activeStoryId === null) {
      setActiveStoryId(storyIds[0]);
    }
  }, [storyIds, activeStoryId]);

  const observe = useCallback((element: HTMLElement | null) => {
    if (element && observerRef.current) {
      observerRef.current.observe(element);
    }
  }, []);

  const unobserve = useCallback((element: HTMLElement | null) => {
    if (element && observerRef.current) {
      observerRef.current.unobserve(element);
    }
  }, []);

  return { activeStoryId, observe, unobserve };
}
