import { useState } from 'react';
import { Mail, Loader2, Check, AlertCircle, ArrowLeft, Settings } from 'lucide-react';
import { AvactuLogo } from '@/components/ui/AvactuLogo';

type PageState = 'input' | 'loading' | 'success' | 'error';
type Frequency = 'daily' | 'biweekly' | 'weekly';

interface FrequencyOption {
  value: Frequency;
  label: string;
  description: string;
}

const FREQUENCY_OPTIONS: FrequencyOption[] = [
  { value: 'daily', label: 'Quotidien', description: 'Recevoir Avactu tous les jours' },
  { value: 'biweekly', label: 'Tous les 2 jours', description: 'Recevoir Avactu un jour sur deux' },
  { value: 'weekly', label: 'Hebdomadaire', description: 'Recevoir 10 actus chaque samedi' },
];

export function PreferencesPage() {
  const [email, setEmail] = useState('');
  const [selectedFrequency, setSelectedFrequency] = useState<Frequency>('biweekly');
  const [state, setState] = useState<PageState>('input');
  const [errorMessage, setErrorMessage] = useState('');

  const validateEmail = (email: string): boolean => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateEmail(email)) {
      setState('error');
      setErrorMessage('Email invalide');
      return;
    }

    setState('loading');

    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          frequency: selectedFrequency,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Une erreur est survenue');
      }

      setState('success');
    } catch (err) {
      console.error('Subscribe error:', err);
      setState('error');
      setErrorMessage(err instanceof Error ? err.message : 'Une erreur est survenue');
    }
  };

  const handleReset = () => {
    setEmail('');
    setSelectedFrequency('biweekly');
    setState('input');
    setErrorMessage('');
  };

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
          <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-6">
            {/* Title */}
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                <Settings className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  Mes préférences
                </h2>
                <p className="text-xs text-slate-500">
                  Modifier la fréquence de réception
                </p>
              </div>
            </div>

            {/* Input form */}
            {(state === 'input' || state === 'error') && (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Email input */}
                <div>
                  <label className="block text-xs text-slate-400 mb-2">
                    Ton email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (state === 'error') setState('input');
                      }}
                      placeholder="ton@email.fr"
                      className="w-full pl-10 pr-4 py-3 text-sm rounded-lg bg-white/5 border border-white/10 text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-colors"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Frequency selection */}
                <div>
                  <p className="text-xs text-slate-400 mb-3">Fréquence de réception</p>
                  <div className="space-y-2">
                    {FREQUENCY_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setSelectedFrequency(option.value)}
                        className={`w-full p-3 rounded-lg border text-left transition-all ${
                          selectedFrequency === option.value
                            ? 'bg-indigo-500/10 border-indigo-500/50'
                            : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-200">
                            {option.label}
                          </span>
                          {selectedFrequency === option.value && (
                            <Check className="w-4 h-4 text-indigo-400" />
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {option.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {state === 'error' && (
                  <div className="flex items-center gap-2 text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    {errorMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!email}
                  className="w-full py-3 text-sm font-mono uppercase tracking-wider rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/30 hover:border-indigo-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Enregistrer
                </button>
              </form>
            )}

            {/* Loading */}
            {state === 'loading' && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
              </div>
            )}

            {/* Success */}
            {state === 'success' && (
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-6 h-6 text-emerald-400" />
                </div>
                <p className="text-slate-300 mb-2">Email envoyé !</p>
                <p className="text-sm text-slate-500 mb-6">
                  Clique sur le lien dans l'email pour confirmer le changement.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleReset}
                    className="flex-1 py-3 text-sm font-mono uppercase tracking-wider rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 hover:border-white/20 transition-all"
                  >
                    Autre email
                  </button>
                  <a
                    href="/"
                    className="flex-1 inline-flex items-center justify-center gap-2 py-3 text-sm font-mono uppercase tracking-wider rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/30 hover:border-indigo-500/50 transition-all"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Avactu
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Footer link */}
          <div className="mt-4 text-center">
            <a
              href="/unsubscribe"
              className="text-xs text-slate-600 hover:text-slate-500 transition-colors"
            >
              Se désabonner
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
