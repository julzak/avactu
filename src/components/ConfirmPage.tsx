import { useState, useEffect } from 'react';
import { Loader2, Check, AlertCircle, ArrowLeft } from 'lucide-react';
import { AvactuLogo } from '@/components/ui/AvactuLogo';

type ConfirmState = 'loading' | 'success' | 'error';
type Frequency = 'daily' | 'biweekly' | 'weekly';

interface ConfirmResult {
  email: string;
  frequency: Frequency;
  wasNewSubscriber: boolean;
}

const FREQUENCY_LABELS: Record<Frequency, string> = {
  daily: 'tous les jours',
  biweekly: 'tous les 2 jours',
  weekly: 'chaque samedi',
};

export function ConfirmPage() {
  const [state, setState] = useState<ConfirmState>('loading');
  const [result, setResult] = useState<ConfirmResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const confirmSubscription = async () => {
      // Get token from URL
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');

      if (!token) {
        setState('error');
        setErrorMessage('Lien invalide : token manquant');
        return;
      }

      try {
        const response = await fetch(`/api/confirm?token=${token}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || data.error || 'Une erreur est survenue');
        }

        setResult({
          email: data.email,
          frequency: data.frequency,
          wasNewSubscriber: data.wasNewSubscriber,
        });
        setState('success');
      } catch (err) {
        console.error('Confirm error:', err);
        setState('error');
        setErrorMessage(err instanceof Error ? err.message : 'Une erreur est survenue');
      }
    };

    confirmSubscription();
  }, []);

  return (
    <div className="min-h-screen bg-obsidian-950 text-slate-50 flex flex-col">
      {/* Header */}
      <header className="shrink-0 px-4 py-4 bg-gradient-to-b from-obsidian-900 to-transparent">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <a href="/" className="flex items-center gap-3">
            <div className="relative">
              <div
                className="absolute inset-0 blur-xl opacity-30"
                style={{
                  background: 'radial-gradient(circle, #6366f1 0%, transparent 60%)',
                  transform: 'scale(2.5)',
                }}
              />
              <AvactuLogo size={40} className="relative" />
            </div>
            <h1 className="font-serif text-xl font-bold tracking-tight text-slate-50">
              Avactu
            </h1>
          </a>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-8 text-center">
            {/* Loading */}
            {state === 'loading' && (
              <div className="py-8">
                <Loader2 className="w-12 h-12 text-indigo-400 animate-spin mx-auto mb-4" />
                <p className="text-slate-400">Confirmation en cours...</p>
              </div>
            )}

            {/* Success */}
            {state === 'success' && result && (
              <div className="py-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                  <Check className="w-8 h-8 text-emerald-400" />
                </div>

                <h2 className="text-xl font-semibold text-slate-100 mb-2">
                  {result.wasNewSubscriber ? 'Inscription confirmée !' : 'Préférences mises à jour !'}
                </h2>

                <p className="text-slate-400 mb-6">
                  Tu recevras Avactu <span className="text-slate-200 font-medium">{FREQUENCY_LABELS[result.frequency]}</span>
                  <br />
                  <span className="text-slate-500 text-sm">({result.email})</span>
                </p>

                <a
                  href="/"
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-mono uppercase tracking-wider rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/30 hover:border-indigo-500/50 transition-all"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Aller sur Avactu
                </a>
              </div>
            )}

            {/* Error */}
            {state === 'error' && (
              <div className="py-4">
                <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
                  <AlertCircle className="w-8 h-8 text-red-400" />
                </div>

                <h2 className="text-xl font-semibold text-slate-100 mb-2">
                  Erreur de confirmation
                </h2>

                <p className="text-slate-400 mb-6">
                  {errorMessage}
                </p>

                <a
                  href="/"
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-mono uppercase tracking-wider rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 hover:border-white/20 transition-all"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Retour à Avactu
                </a>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
