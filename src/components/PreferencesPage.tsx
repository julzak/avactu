import { useState } from 'react';
import { Mail, Loader2, Check, AlertCircle, ArrowLeft, Settings } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { AvactuLogo } from '@/components/ui/AvactuLogo';

type PageState = 'lookup' | 'loading' | 'edit' | 'success' | 'error' | 'not_found';
type Frequency = 'daily' | 'biweekly' | 'weekly';

interface FrequencyOption {
  value: Frequency;
  label: string;
  description: string;
}

const FREQUENCY_OPTIONS: FrequencyOption[] = [
  { value: 'daily', label: 'Quotidien', description: 'Recevoir Avactu tous les jours' },
  { value: 'biweekly', label: 'Tous les 2 jours', description: 'Recevoir Avactu un jour sur deux (par defaut)' },
  { value: 'weekly', label: 'Hebdomadaire', description: 'Recevoir 10 actus chaque samedi' },
];

export function PreferencesPage() {
  const [email, setEmail] = useState('');
  const [currentFrequency, setCurrentFrequency] = useState<Frequency | null>(null);
  const [selectedFrequency, setSelectedFrequency] = useState<Frequency>('biweekly');
  const [state, setState] = useState<PageState>('lookup');
  const [errorMessage, setErrorMessage] = useState('');

  const validateEmail = (email: string): boolean => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateEmail(email)) {
      setState('error');
      setErrorMessage('Email invalide');
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setState('error');
      setErrorMessage('Service non disponible');
      return;
    }

    setState('loading');

    try {
      const { data, error } = await supabase
        .from('subscribers')
        .select('frequency')
        .eq('email', email.toLowerCase().trim())
        .single();

      if (error || !data) {
        setState('not_found');
        return;
      }

      setCurrentFrequency(data.frequency || 'biweekly');
      setSelectedFrequency(data.frequency || 'biweekly');
      setState('edit');
    } catch (err) {
      console.error('Lookup error:', err);
      setState('error');
      setErrorMessage('Une erreur est survenue');
    }
  };

  const handleUpdate = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setState('error');
      setErrorMessage('Service non disponible');
      return;
    }

    setState('loading');

    try {
      const { error } = await supabase
        .from('subscribers')
        .update({ frequency: selectedFrequency })
        .eq('email', email.toLowerCase().trim());

      if (error) throw error;

      setCurrentFrequency(selectedFrequency);
      setState('success');
    } catch (err) {
      console.error('Update error:', err);
      setState('error');
      setErrorMessage('Une erreur est survenue');
    }
  };

  const handleReset = () => {
    setEmail('');
    setCurrentFrequency(null);
    setSelectedFrequency('biweekly');
    setState('lookup');
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
                  Mes preferences
                </h2>
                <p className="text-xs text-slate-500">
                  Modifier la frequence de reception
                </p>
              </div>
            </div>

            {/* Lookup form */}
            {(state === 'lookup' || state === 'error') && (
              <form onSubmit={handleLookup} className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-2">
                    Entre ton email pour acceder a tes preferences
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (state === 'error') setState('lookup');
                      }}
                      placeholder="ton@email.fr"
                      className="w-full pl-10 pr-4 py-3 text-sm rounded-lg bg-white/5 border border-white/10 text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-colors"
                      autoFocus
                    />
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
                  className="w-full py-3 text-sm font-mono uppercase tracking-wider rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/30 hover:border-indigo-500/50 transition-all"
                >
                  Continuer
                </button>
              </form>
            )}

            {/* Loading */}
            {state === 'loading' && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
              </div>
            )}

            {/* Not found */}
            {state === 'not_found' && (
              <div className="text-center py-4">
                <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
                <p className="text-slate-300 mb-2">Email non trouve</p>
                <p className="text-sm text-slate-500 mb-6">
                  Cet email n'est pas inscrit a la newsletter.
                </p>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 mx-auto text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Reessayer
                </button>
              </div>
            )}

            {/* Edit form */}
            {state === 'edit' && (
              <div className="space-y-6">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Email</p>
                  <p className="text-sm text-slate-300 font-mono">{email}</p>
                </div>

                <div>
                  <p className="text-xs text-slate-500 mb-3">Frequence de reception</p>
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
                        {currentFrequency === option.value && (
                          <span className="inline-block mt-2 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded bg-slate-700 text-slate-400">
                            Actuel
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleReset}
                    className="flex-1 py-3 text-sm font-mono uppercase tracking-wider rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 hover:border-white/20 transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleUpdate}
                    disabled={selectedFrequency === currentFrequency}
                    className="flex-1 py-3 text-sm font-mono uppercase tracking-wider rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/30 hover:border-indigo-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Enregistrer
                  </button>
                </div>
              </div>
            )}

            {/* Success */}
            {state === 'success' && (
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-6 h-6 text-emerald-400" />
                </div>
                <p className="text-slate-300 mb-2">Preferences mises a jour</p>
                <p className="text-sm text-slate-500 mb-6">
                  Tu recevras maintenant Avactu{' '}
                  {selectedFrequency === 'daily' && 'tous les jours'}
                  {selectedFrequency === 'biweekly' && 'tous les 2 jours'}
                  {selectedFrequency === 'weekly' && 'chaque samedi'}
                  .
                </p>
                <a
                  href="/"
                  className="inline-flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Retour a Avactu
                </a>
              </div>
            )}
          </div>

          {/* Footer link */}
          <div className="mt-4 text-center">
            <a
              href="/unsubscribe"
              className="text-xs text-slate-600 hover:text-slate-500 transition-colors"
            >
              Se desabonner
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
