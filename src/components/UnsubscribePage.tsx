import { useState } from 'react';
import { AvactuLogo } from '@/components/ui/AvactuLogo';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export function UnsubscribePage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleUnsubscribe = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) return;

    setStatus('loading');

    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/subscribers?email=eq.${encodeURIComponent(email)}`, {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
      });

      if (response.ok) {
        setStatus('success');
        setMessage('Tu as bien ete desabonne. A bientot !');
      } else {
        setStatus('error');
        setMessage('Une erreur est survenue. Reessaie plus tard.');
      }
    } catch {
      setStatus('error');
      setMessage('Une erreur est survenue. Reessaie plus tard.');
    }
  };

  return (
    <div className="min-h-screen bg-obsidian-950 flex flex-col items-center justify-center px-4">
      <div className="max-w-sm w-full">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <AvactuLogo size={64} />
        </div>

        {/* Title */}
        <h1 className="font-serif text-2xl font-bold text-slate-50 text-center mb-2">
          Se desabonner
        </h1>
        <p className="text-slate-500 text-sm text-center mb-8">
          Entre ton email pour te desabonner de la newsletter.
        </p>

        {status === 'success' ? (
          <div className="text-center">
            <p className="text-green-400 font-mono text-sm mb-4">{message}</p>
            <a
              href="/"
              className="text-indigo-400 hover:text-indigo-300 font-mono text-sm underline"
            >
              Retour a Avactu
            </a>
          </div>
        ) : (
          <form onSubmit={handleUnsubscribe} className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ton@email.com"
              className="w-full px-4 py-3 bg-obsidian-900 border border-slate-800 rounded-lg text-slate-50 placeholder-slate-600 font-mono text-sm focus:outline-none focus:border-indigo-500"
              required
            />

            {status === 'error' && (
              <p className="text-red-400 font-mono text-xs">{message}</p>
            )}

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full px-4 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-lg text-slate-50 font-mono text-sm uppercase tracking-wider transition-colors"
            >
              {status === 'loading' ? 'Chargement...' : 'Se desabonner'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
