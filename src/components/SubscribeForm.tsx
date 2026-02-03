import { useState } from 'react';
import { Mail, Loader2, Check, AlertCircle, ChevronDown } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

type SubscribeState = 'idle' | 'loading' | 'success' | 'error';
type Frequency = 'daily' | 'biweekly' | 'weekly';

interface FrequencyOption {
  value: Frequency;
  label: string;
  description: string;
}

const FREQUENCY_OPTIONS: FrequencyOption[] = [
  { value: 'daily', label: 'Quotidien', description: 'Tous les jours' },
  { value: 'biweekly', label: 'Bi-hebdo', description: 'Tous les 2 jours' },
  { value: 'weekly', label: 'Hebdo', description: 'Chaque samedi' },
];

const FREQUENCY_CONFIRMATION: Record<Frequency, string> = {
  daily: 'Tu recevras Avactu tous les jours',
  biweekly: 'Tu recevras Avactu tous les 2 jours',
  weekly: 'Tu recevras Avactu chaque samedi (10 actus)',
};

export function SubscribeForm() {
  const [email, setEmail] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('biweekly');
  const [showFrequencyDropdown, setShowFrequencyDropdown] = useState(false);
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
          confirmed: true,
          frequency,
        },
      ]);

      if (error) {
        // Handle duplicate email - update frequency instead
        if (error.code === '23505') {
          const { error: updateError } = await supabase!
            .from('subscribers')
            .update({ frequency })
            .eq('email', email.toLowerCase().trim());

          if (updateError) throw updateError;
        } else {
          throw error;
        }
      }

      setState('success');
      setEmail('');
    } catch (err) {
      console.error('Subscribe error:', err);
      setState('error');
      setErrorMessage('Une erreur est survenue');
    }
  };

  const selectedOption = FREQUENCY_OPTIONS.find((opt) => opt.value === frequency)!;

  if (state === 'success') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
        <Check className="w-4 h-4 text-emerald-400" />
        <span className="text-emerald-400 text-xs font-mono">
          {FREQUENCY_CONFIRMATION[frequency]}
        </span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      {/* Email input */}
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
          className={`pl-8 pr-3 py-1.5 w-36 text-xs rounded-lg bg-white/5 border transition-colors placeholder:text-slate-600 text-slate-300 focus:outline-none focus:ring-1 ${
            state === 'error'
              ? 'border-red-500/50 focus:ring-red-500/50'
              : 'border-white/10 focus:border-indigo-500/50 focus:ring-indigo-500/50'
          }`}
          disabled={state === 'loading'}
        />
      </div>

      {/* Frequency selector */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowFrequencyDropdown(!showFrequencyDropdown)}
          className="flex items-center gap-1 px-2 py-1.5 text-xs font-mono rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 hover:border-white/20 transition-colors"
          disabled={state === 'loading'}
        >
          <span>{selectedOption.label}</span>
          <ChevronDown className="w-3 h-3" />
        </button>

        {showFrequencyDropdown && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowFrequencyDropdown(false)}
            />
            {/* Dropdown */}
            <div className="absolute top-full left-0 mt-1 z-20 w-44 py-1 rounded-lg bg-slate-900 border border-white/10 shadow-xl">
              {FREQUENCY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setFrequency(option.value);
                    setShowFrequencyDropdown(false);
                  }}
                  className={`w-full px-3 py-2 text-left hover:bg-white/5 transition-colors ${
                    frequency === option.value ? 'bg-indigo-500/10' : ''
                  }`}
                >
                  <div className="text-xs font-mono text-slate-300">
                    {option.label}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {option.description}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Submit button */}
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
