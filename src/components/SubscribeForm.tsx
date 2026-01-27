import { useState } from 'react';
import { Mail, Loader2, Check, AlertCircle } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

type SubscribeState = 'idle' | 'loading' | 'success' | 'error';

export function SubscribeForm() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<SubscribeState>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Don't render if Supabase is not configured
  if (!isSupabaseConfigured) {
    return null;
  }

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
      const { error } = await supabase!.from('subscribers').insert([
        {
          email: email.toLowerCase().trim(),
          subscribed_at: new Date().toISOString(),
          confirmed: true, // Auto-confirm for simplicity
        },
      ]);

      if (error) {
        // Handle duplicate email
        if (error.code === '23505') {
          setState('success');
          return;
        }
        throw error;
      }

      setState('success');
      setEmail('');
    } catch (err) {
      console.error('Subscribe error:', err);
      setState('error');
      setErrorMessage('Une erreur est survenue');
    }
  };

  if (state === 'success') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
        <Check className="w-4 h-4 text-emerald-400" />
        <span className="text-emerald-400 text-xs font-mono">
          Merci ! Tu recevras Avactu tous les 2 jours
        </span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <div className="relative">
        <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (state === 'error') setState('idle');
          }}
          placeholder="ton@email.fr"
          className={`pl-8 pr-3 py-1.5 w-40 text-xs rounded-lg bg-white/5 border transition-colors placeholder:text-slate-600 text-slate-300 focus:outline-none focus:ring-1 ${
            state === 'error'
              ? 'border-red-500/50 focus:ring-red-500/50'
              : 'border-white/10 focus:border-indigo-500/50 focus:ring-indigo-500/50'
          }`}
          disabled={state === 'loading'}
        />
      </div>

      <button
        type="submit"
        disabled={state === 'loading' || !email}
        className="px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/30 hover:border-indigo-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
      >
        {state === 'loading' ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          "S'abonner"
        )}
      </button>

      {state === 'error' && (
        <div className="flex items-center gap-1 text-red-400 text-[10px]">
          <AlertCircle className="w-3 h-3" />
          {errorMessage}
        </div>
      )}
    </form>
  );
}
