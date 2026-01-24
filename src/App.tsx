import { useStories } from '@/hooks/useStories';
import { useActiveStory } from '@/hooks/useActiveStory';
import { useOffline } from '@/hooks/useOffline';
import { BriefStack } from '@/components/BriefStack';
import { AvactuLogo } from '@/components/ui/AvactuLogo';
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
      {/* Header - Compact Brand Identity */}
      <header className="shrink-0 flex items-center justify-center gap-3 px-4 py-2 bg-gradient-to-b from-obsidian-900 to-transparent">
        {/* Logo avec halo violet */}
        <div className="relative">
          {/* Glow layer violet */}
          <div
            className="absolute inset-0 blur-xl opacity-30"
            style={{
              background: 'radial-gradient(circle, #6366f1 0%, transparent 60%)',
              transform: 'scale(2.5)',
            }}
          />
          {/* Logo SVG animé */}
          <AvactuLogo size={48} className="relative" />
        </div>

        {/* Title + Date */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-xl font-bold tracking-tight text-slate-50">
              Avactu
            </h1>
            {isOffline && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                <WifiOff className="w-2.5 h-2.5 text-amber-500" />
              </div>
            )}
          </div>
          {edition && (
            <p className="text-slate-500 text-[10px] font-mono uppercase tracking-wider">
              {new Date(edition.date).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
              })}
            </p>
          )}
        </div>
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
