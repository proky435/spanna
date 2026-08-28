// src/components/ui.jsx
// Újrahasználható UI elemek: Badge, ProgressBar, Button, IconButton, Icon, Header, EmptyState, Toast.
// Modernizált: lágy árnyékok, mikro-interakciók (active:scale), finom gradiensek.

import React from 'react';

const TONES = {
  slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  brand: 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200',
  green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  red:   'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
};

export function Badge({ text, tone = 'slate', title }) {
  return (
    <span
      title={title || text}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone] || TONES.slate}`}
    >
      {text}
    </span>
  );
}

export function ProgressBar({ current, total }) {
  const p = total ? Math.min(100, Math.round((current / total) * 100)) : 0;
  return (
    <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
      <div
        className="progress-bar h-full bg-gradient-to-r from-brand-500 to-brand-400 rounded-full"
        style={{ width: `${p}%` }}
      />
    </div>
  );
}

const VARIANTS = {
  primary:   'bg-brand-600 hover:bg-brand-700 text-white shadow-sm shadow-brand-500/25 btn-press disabled:opacity-50',
  secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 btn-press disabled:opacity-50',
  ghost:     'bg-transparent hover:bg-slate-100 text-slate-700 dark:hover:bg-slate-800 dark:text-slate-200 btn-press',
  danger:    'bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-500/25 btn-press',
  success:   'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-500/25 btn-press',
};

export function Button({ label, onClick, variant = 'primary', icon, type = 'button', disabled, title, className = '' }) {
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
    >
      {icon}
      {label}
    </button>
  );
}

const ICON_VARIANTS = {
  ghost:  'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 btn-press',
  active: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300',
};

export function IconButton({ icon, onClick, title, variant = 'ghost', className = '' }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`inline-flex items-center justify-center w-10 h-10 rounded-xl transition-all ${ICON_VARIANTS[variant]} ${className}`}
    >
      {icon}
    </button>
  );
}

const ICON_PATHS = {
  sun:  <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" /></>,
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  star: <path d="M12 17.3l-6.2 3.7 1.6-7L2 9.2l7.1-.6L12 2l2.9 6.6 7.1.6-5.4 4.8 1.6 7z" />,
  starFilled: <path d="M12 17.3l-6.2 3.7 1.6-7L2 9.2l7.1-.6L12 2l2.9 6.6 7.1.6-5.4 4.8 1.6 7z" fill="currentColor" stroke="none" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  arrowLeft:  <path d="M19 12H5M11 6l-6 6 6 6" />,
  check:  <path d="M20 6L9 17l-5-5" />,
  x:      <path d="M18 6L6 18M6 6l12 12" />,
  shuffle:<path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />,
  refresh:<path d="M21 12a9 9 0 1 1-3-6.7M21 3v6h-6" />,
  book:   <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z" />,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
  list:   <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  home:   <path d="M3 11l9-8 9 8M5 10v10h14V10" />,
};

export function Icon({ name, size = 20, className = '' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`inline-block shrink-0 ${className}`}
    >
      {ICON_PATHS[name] || null}
    </svg>
  );
}

export function Header({ title, subtitle, onBack, right }) {
  return (
    <header className="flex items-center gap-3 mb-6">
      {onBack && <IconButton icon={<Icon name="arrowLeft" />} onClick={onBack} title="Vissza" />}
      <div className="flex-1 min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{subtitle}</p>}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </header>
  );
}

export function EmptyState({ icon, title, hint }) {
  return (
    <div className="text-center py-16 px-4">
      {icon && (
        <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold">{title || 'Nincs találat'}</h3>
      {hint && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  );
}

// Toast: egyszerű, lokális state-en alapuló megoldás (App-ban renderelve).
export const ToastContext = React.createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = React.useState([]);

  const push = React.useCallback((message, tone = 'slate', ms = 2200) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, ms);
  }, []);

  const tones = {
    slate: 'bg-slate-800 text-white',
    success: 'bg-emerald-600 text-white',
    danger: 'bg-rose-600 text-white',
    brand: 'bg-brand-600 text-white',
  };

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium animate-fade-in ${tones[t.tone] || tones.slate}`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  return ctx || (() => {});
}
