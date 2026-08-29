// src/components/Auth.jsx
// Login / Register képernyő — email + jelszó.
import React, { useState } from 'react';
import { useAuth } from '../auth.jsx';
import { Button, Icon, Header } from './ui.jsx';

export default function Auth() {
  const { login, register, loading, error } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError(null);
    if (!email.trim() || !password) {
      setLocalError('Töltsd ki az email és jelszó mezőket.');
      return;
    }
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password);
      }
    } catch {
      // hiba már az auth context-ben van (error state)
    }
  };

  const displayError = localError || error;

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-8 w-full min-h-screen flex flex-col justify-center">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-600 text-white mb-4 shadow-lg shadow-brand-500/25">
          <Icon name="book" size={32} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">VizsgaMester</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {mode === 'login' ? 'Jelentkezz be a szinkronizáláshoz' : 'Hozz létre fiókot a szinkronizáláshoz'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="te@peldamu.hu"
            autoComplete="email"
            className="w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-3 text-sm outline-none focus:border-brand-400 transition-colors"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">Jelszó</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            className="w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-3 text-sm outline-none focus:border-brand-400 transition-colors"
            disabled={loading}
          />
          {mode === 'register' && (
            <p className="text-xs text-slate-400 mt-1">Legalább 6 karakter.</p>
          )}
        </div>

        {displayError && (
          <div className="rounded-xl bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 px-4 py-2.5 text-sm text-rose-700 dark:text-rose-300">
            {displayError}
          </div>
        )}

        <Button
          type="submit"
          label={loading ? 'Folyamatban...' : mode === 'login' ? 'Bejelentkezés' : 'Regisztráció'}
          variant="primary"
          disabled={loading}
          className="w-full"
        />
      </form>

      <div className="text-center mt-4">
        <button
          onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setLocalError(null); }}
          className="text-sm text-brand-600 dark:text-brand-400 hover:underline font-medium"
        >
          {mode === 'login' ? 'Még nincs fiókod? Regisztrálj!' : 'Van már fiókod? Jelentkezz be!'}
        </button>
      </div>

      <div className="text-center mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
        <button
          onClick={() => {
            // Vendég mód: bejelentkezés nélkül, csak localStorage
            // Egyszerűen beállítjuk a user-t vendégként
            localStorage.setItem('vm.user', JSON.stringify({ id: 0, email: 'vendég' }));
            window.location.reload();
          }}
          className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-medium"
        >
          Folytatás vendégként (csak ezen az eszközön)
        </button>
      </div>
    </div>
  );
}
