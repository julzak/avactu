import { useStories } from '@/hooks/useStories';
import { useActiveStory } from '@/hooks/useActiveStory';
import { useOffline } from '@/hooks/useOffline';
import { BriefStack } from '@/components/BriefStack';
import { AvactuLogo } from '@/components/icons/AvactuLogo';
import { WifiOff } from 'lucide-react';

function App() {
  const { stories, edition, loading, error } = useStories();
  const { activeStoryId, observe } = useActiveStory(stories.map((s) => s.id));
  const isOffline = useOffline();

  if (loading) {
    return (
      <div className="min-h-screen bg-obsidian-950 flex items-center justify-center">
        <p className="text-slate-600 font-mono text-sm uppercase tracking-widest">Chargement...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-obsidian-950 flex items-center justify-center">
        <p className="text-red-400/80 font-mono text-sm">Erreur: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-obsidian-950 text-slate-50 flex flex-col overflow-hidden">
      {/* Header - Brand Identity */}
      <header className="shrink-0 flex flex-col items-center justify-center pt-6 pb-4 bg-gradient-to-b from-obsidian-900 to-transparent shadow-[0_4px_20px_-5px_rgba(6,182,212,0.15)]">
        {/* Logo */}
        <AvactuLogo className="w-10 h-10 mb-2 text-cyan-400" />

        {/* Title */}
        <div className="flex items-center gap-2">
          <h1 className="font-serif text-2xl font-bold tracking-tight text-slate-50">
            Avactu
          </h1>
          {isOffline && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
              <WifiOff className="w-3 h-3 text-amber-500" />
              <span className="text-[10px] text-amber-500 font-mono uppercase">Hors ligne</span>
            </div>
          )}
        </div>

        {/* Date */}
        {edition && (
          <p className="mt-1 text-slate-500 text-xs font-mono uppercase tracking-wider">
            {new Date(edition.date).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        )}
      </header>

      {/* Brief Stack - full height with snap scrolling */}
      <main className="flex-1 overflow-hidden">
        <BriefStack
          stories={stories}
          activeStoryId={activeStoryId}
          onObserve={observe}
        />
      </main>
    </div>
  );
}

export default App;
